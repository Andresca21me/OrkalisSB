import { config as loadEnv } from 'dotenv';
loadEnv();

import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { EstadoCita, MetodoPago, NivelConfig, OrigenCita, PerfilNegocio } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { atencion, cita, citaServicio, especialista, especialistaSucursal, negocio, producto, servicio, sucursal } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { CONFIG_UPDATED, ConfigResolverService, type ConfigUpdatedEvent } from '../config-module/config-resolver.service';
import { ConfigWriteService } from '../config-module/config-write.service';
import { AtencionService } from './atencion.service';
import { MetricsService } from '../observability/metrics.service';

describe('AtencionService (completar / revertir transaccional)', () => {
  const NOMBRE = 'Negocio FINANZAS TEST';
  let negocioId: string;
  let sucursalId: string;
  let espId: string;
  let servId: string;
  let prodId: string;
  let ctx: TenantContext;
  let resolver: ConfigResolverService;
  let writer: ConfigWriteService;
  let service: AtencionService;

  // Crea una cita en_progreso con N líneas del servicio (precio 25000 c/u).
  async function citaEnProgreso(hora: number, lineas = 2): Promise<string> {
    const inicio = new Date(Date.now() + hora * 3600_000);
    const fin = new Date(inicio.getTime() + 30 * 60000);
    const [c] = await adminDb
      .insert(cita)
      .values({
        negocioId,
        sucursalId,
        especialistaId: espId,
        inicio,
        fin,
        estado: EstadoCita.EnProgreso,
        origen: OrigenCita.CreacionInterna,
      })
      .returning();
    await adminDb
      .insert(citaServicio)
      .values(Array.from({ length: lineas }, () => ({ citaId: c.id, servicioId: servId, precioAplicado: '25000.00' })));
    return c.id;
  }

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    // SALON → inventario ON por defecto.
    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Salon }).returning();
    negocioId = neg.id;
    const [suc] = await adminDb.insert(sucursal).values({ negocioId, nombre: 'Sede' }).returning();
    sucursalId = suc.id;
    const [esp] = await adminDb.insert(especialista).values({ negocioId, nombre: 'Esp' }).returning();
    espId = esp.id;
    await adminDb.insert(especialistaSucursal).values({ especialistaId: espId, sucursalId });
    const [serv] = await adminDb
      .insert(servicio)
      .values({ negocioId, nombre: 'Corte', precio: '25000.00', duracionMin: 30 })
      .returning();
    servId = serv.id;
    const [prod] = await adminDb
      .insert(producto)
      .values({ negocioId, sucursalId, nombre: 'Cera', tipo: 'venta', cantidad: 10, precioVenta: '10000.00' })
      .returning();
    prodId = prod.id;

    ctx = { negocioId, sucursalIds: null, rol: 'admin' };
    const events = new EventEmitter2();
    resolver = new ConfigResolverService();
    events.on(CONFIG_UPDATED, (p: ConfigUpdatedEvent) => resolver.invalidar(p.negocioId));
    writer = new ConfigWriteService(resolver, events);
    service = new AtencionService(resolver, new MetricsService());
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  it('completar con 2 servicios + 1 producto calcula gan y descuenta stock', async () => {
    const citaId = await citaEnProgreso(1);
    const at = await service.completar(ctx, citaId, {
      metodoPago: MetodoPago.Efectivo,
      productos: [{ productoId: prodId, cantidad: 2 }],
    });
    expect(Number(at.total)).toBe(70000); // 50000 servicios + 20000 producto
    expect(Number(at.ganProf)).toBe(25000);
    expect(Number(at.ganSalon)).toBe(45000); // 25000 + 20000

    const [c] = await adminDb.select({ estado: cita.estado }).from(cita).where(eq(cita.id, citaId));
    expect(c.estado).toBe(EstadoCita.Completada);
    const [p] = await adminDb.select({ cantidad: producto.cantidad }).from(producto).where(eq(producto.id, prodId));
    expect(p.cantidad).toBe(8); // 10 - 2
  });

  it('completar sin método de pago es rechazado (guard de pago)', async () => {
    const citaId = await citaEnProgreso(2);
    await expect(
      // @ts-expect-error metodoPago ausente a propósito
      service.completar(ctx, citaId, { metodoPago: undefined }),
    ).rejects.toThrow();
  });

  it('completar dos veces el mismo turno no duplica la atención', async () => {
    const citaId = await citaEnProgreso(3);
    await service.completar(ctx, citaId, { metodoPago: MetodoPago.Efectivo });
    await expect(service.completar(ctx, citaId, { metodoPago: MetodoPago.Efectivo })).rejects.toThrow();
  });

  it('revertir repone stock, deshace la atención y reabre el turno', async () => {
    const citaId = await citaEnProgreso(4);
    await service.completar(ctx, citaId, { metodoPago: MetodoPago.Efectivo, productos: [{ productoId: prodId, cantidad: 3 }] });
    let [p] = await adminDb.select({ cantidad: producto.cantidad }).from(producto).where(eq(producto.id, prodId));
    const tras = p.cantidad;

    await service.revertir(ctx, citaId);
    [p] = await adminDb.select({ cantidad: producto.cantidad }).from(producto).where(eq(producto.id, prodId));
    expect(p.cantidad).toBe(tras + 3); // stock repuesto

    const [c] = await adminDb.select({ estado: cita.estado }).from(cita).where(eq(cita.id, citaId));
    expect(c.estado).toBe(EstadoCita.EnProgreso);
    const ats = await adminDb.select().from(atencion).where(eq(atencion.citaId, citaId));
    expect(ats).toHaveLength(0); // atención deshecha
  });

  it('cambiar parámetros después de completar NO altera el snapshot previo', async () => {
    const citaId = await citaEnProgreso(5);
    const at = await service.completar(ctx, citaId, { metodoPago: MetodoPago.Efectivo });
    const ganProfOriginal = Number(at.ganProf);

    // Cambia la repartición a 70/30 después de completar.
    await writer.setReparticion(ctx, NivelConfig.Negocio, negocioId, 70, 30);

    const [persistida] = await adminDb.select().from(atencion).where(eq(atencion.id, at.id));
    expect(Number(persistida.ganProf)).toBe(ganProfOriginal); // snapshot intacto
  });

  it('con partición por especialista OFF no se calcula ganancia individual', async () => {
    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'modulo.particion_por_especialista', false);
    const citaId = await citaEnProgreso(6);
    const at = await service.completar(ctx, citaId, { metodoPago: MetodoPago.Efectivo });
    expect(Number(at.ganProf)).toBe(0);
    expect(Number(at.ganSalon)).toBe(50000);
    await writer.remove(ctx, NivelConfig.Negocio, negocioId, 'modulo.particion_por_especialista');
  });
});
