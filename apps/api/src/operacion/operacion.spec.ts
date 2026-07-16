import { config as loadEnv } from 'dotenv';
loadEnv();

import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { EstadoCita, MetodoPago, NivelConfig, OrigenCita, PerfilNegocio, PlanSuscripcion, TipoGasto, TipoProducto } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { atencion, cita, especialista, especialistaSucursal, gasto, negocio, sucursal, suscripcion } from '../db/schema';
import { PlanService } from '../plans/plan.service';
import type { TenantContext } from '../db/tenant-context';
import { CONFIG_UPDATED, ConfigResolverService, type ConfigUpdatedEvent } from '../config-module/config-resolver.service';
import { ConfigWriteService } from '../config-module/config-write.service';
import { ModuloGate } from './modulo-gate.service';
import { InventarioService } from './inventario.service';
import { GastosService } from './gastos.service';
import { LiquidacionesService } from './liquidaciones.service';
import { ReportesService } from './reportes.service';
import { CierreService } from './cierre.service';

describe('Operación interna (FASE-10)', () => {
  const NOMBRE = 'Negocio OPERACION TEST';
  let negocioId: string;
  let sucursalId: string;
  let espId: string;
  let ctx: TenantContext;

  let resolver: ConfigResolverService;
  let writer: ConfigWriteService;
  let inventario: InventarioService;
  let gastos: GastosService;
  let liquidaciones: LiquidacionesService;
  let reportes: ReportesService;
  let cierre: CierreService;

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Salon }).returning();
    negocioId = neg.id;
    // Plan Pro: incluye inventario / partición / cierre (FASE-08 los gatea por plan).
    await adminDb.insert(suscripcion).values({ negocioId, plan: PlanSuscripcion.Pro, numEspecialistas: 4 });
    const [suc] = await adminDb.insert(sucursal).values({ negocioId, nombre: 'Sede' }).returning();
    sucursalId = suc.id;
    const [esp] = await adminDb.insert(especialista).values({ negocioId, nombre: 'Esp' }).returning();
    espId = esp.id;
    await adminDb.insert(especialistaSucursal).values({ especialistaId: espId, sucursalId });

    ctx = { negocioId, sucursalIds: null, rol: 'admin' };
    const events = new EventEmitter2();
    resolver = new ConfigResolverService();
    events.on(CONFIG_UPDATED, (p: ConfigUpdatedEvent) => resolver.invalidar(p.negocioId));
    writer = new ConfigWriteService(resolver, events);
    const gate = new ModuloGate(resolver, new PlanService());
    inventario = new InventarioService(gate);
    gastos = new GastosService();
    liquidaciones = new LiquidacionesService(gate);
    reportes = new ReportesService();
    cierre = new CierreService(gate, reportes);
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  it('inventario ON (salón): salida descuenta stock y dispara alerta de stock bajo', async () => {
    const p = await inventario.crear(ctx, {
      sucursalId,
      nombre: 'Shampoo',
      tipo: TipoProducto.Venta,
      cantidad: 10,
      stockMin: 5,
      costo: 3000,
      precioVenta: 8000,
    });
    const { stock } = await inventario.movimiento(ctx, { productoId: p.id, tipoMov: 'salida', cantidad: 6 });
    expect(stock).toBe(4);
    const alertas = await inventario.alertasStockBajo(ctx, sucursalId);
    expect(alertas.some((a) => a.id === p.id)).toBe(true); // 4 < 5
  });

  it('entrada por compra genera un gasto variable asociado', async () => {
    const p = await inventario.crear(ctx, { sucursalId, nombre: 'Cera', tipo: TipoProducto.Venta, cantidad: 0 });
    const { gastoId } = await inventario.movimiento(ctx, {
      productoId: p.id,
      tipoMov: 'entrada',
      cantidad: 20,
      generaGasto: true,
      costoTotal: 60000,
    });
    expect(gastoId).toBeDefined();
    const lista = await gastos.listar(ctx, sucursalId);
    expect(lista.some((g) => g.id === gastoId && g.categoria === 'Compra de inventario')).toBe(true);
  });

  it('con inventario OFF el módulo no está disponible (gating)', async () => {
    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'modulo.inventario', false);
    await expect(inventario.listar(ctx, sucursalId)).rejects.toThrow();
    await writer.remove(ctx, NivelConfig.Negocio, negocioId, 'modulo.inventario');
  });

  it('eliminar un gasto = inactivar (no borra el histórico)', async () => {
    const g = await gastos.crear(ctx, { sucursalId, tipo: TipoGasto.Fijo, categoria: 'Arriendo', monto: 1000000 });
    await gastos.desactivar(ctx, g.id);
    const activos = await gastos.listar(ctx, sucursalId);
    expect(activos.some((x) => x.id === g.id)).toBe(false);
    const [persiste] = await adminDb.select().from(gasto).where(eq(gasto.id, g.id));
    expect(persiste.activo).toBe(false); // sigue existiendo (histórico intacto)
  });

  it('liquidación: no disponible con partición OFF', async () => {
    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'modulo.particion_por_especialista', false);
    await expect(
      liquidaciones.generar(ctx, { periodo: '2030-01', desde: new Date('2030-01-01'), hasta: new Date('2030-02-01'), sucursalId }),
    ).rejects.toThrow();
    await writer.remove(ctx, NivelConfig.Negocio, negocioId, 'modulo.particion_por_especialista');
  });

  it('liquidación con partición ON aplica descuento por transferencia y desglosa', async () => {
    // Atención pagada por transferencia con comisión 2% en el snapshot.
    const [c] = await adminDb
      .insert(cita)
      .values({
        negocioId,
        sucursalId,
        especialistaId: espId,
        inicio: new Date('2030-03-10T14:00:00Z'),
        fin: new Date('2030-03-10T14:30:00Z'),
        estado: EstadoCita.Completada,
        origen: OrigenCita.CreacionInterna,
      })
      .returning();
    await adminDb.insert(atencion).values({
      negocioId,
      sucursalId,
      citaId: c.id,
      especialistaId: espId,
      total: '50000.00',
      ganProf: '50000.00',
      ganSalon: '0.00',
      metodoPago: MetodoPago.Transferencia,
      snapshotParam: { parametros: { comisionBancaria: 2 } },
      creadoEn: new Date('2030-03-10T15:00:00Z'), // dentro del período liquidado
    });

    const res = await liquidaciones.generar(ctx, {
      periodo: '2030-03',
      desde: new Date('2030-03-01'),
      hasta: new Date('2030-04-01'),
      sucursalId,
    });
    const mia = res.find((r) => r.especialistaId === espId);
    expect(mia).toBeDefined();
    expect(mia!.bruto).toBe(50000);
    expect(mia!.descuento).toBe(1000); // 2% de 50000
    expect(mia!.neto).toBe(49000);

    const csv = liquidaciones.exportarCsv(res);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
  });

  it('reportes: período sin datos devuelve ceros sin romperse', async () => {
    const r = await reportes.financiero(ctx, new Date('2040-01-01'), new Date('2040-02-01'), sucursalId);
    expect(r.ingresos).toBe(0);
    expect(r.gastos).toBe(0);
    expect(r.gananciaNeta).toBe(0);
    expect(r.salud).toBe('sin_datos');
  });

  it('cierre: no disponible con módulo OFF; disponible con ON', async () => {
    await expect(
      cierre.cerrar(ctx, { tipo: 'mensual', desde: new Date('2030-03-01'), hasta: new Date('2030-04-01'), sucursalId }),
    ).rejects.toThrow();

    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'modulo.cierre_periodo', true);
    const c = await cierre.cerrar(ctx, {
      tipo: 'mensual',
      desde: new Date('2030-03-01'),
      hasta: new Date('2030-04-01'),
      sucursalId,
    });
    expect(c.id).toBeDefined();
    expect(c.datosArchivados).toBeTruthy();
    await writer.remove(ctx, NivelConfig.Negocio, negocioId, 'modulo.cierre_periodo');
  });
});
