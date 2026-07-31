import { config as loadEnv } from 'dotenv';
loadEnv();

import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { EstadoCita, MetodoPago, NivelConfig, OrigenCita, PerfilNegocio, PlanSuscripcion, RolUsuario, SplitType } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { atencionServicio, cita, citaServicio, cliente, especialista, negocio, producto, servicio, sucursal, suscripcion, usuario } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { CONFIG_UPDATED, ConfigResolverService, type ConfigUpdatedEvent } from '../config-module/config-resolver.service';
import { ConfigWriteService } from '../config-module/config-write.service';
import { ModuloGate } from '../operacion/modulo-gate.service';
import { PlanService } from '../plans/plan.service';
import { MetricsService } from '../observability/metrics.service';
import { AtencionService } from './atencion.service';
import { DesgloseService } from './desglose.service';
import { round2 } from './calculo';

/**
 * Transparencia por transacción (Plan-Finanzas F1): el desglose expone EXACTO
 * lo que `calcularAtencion` congeló, el arqueo cuadra en agregado y el candado
 * D9 bloquea métodos electrónicos sin comisión bancaria asignada.
 */
describe('DesgloseService + candado D9 (Plan-Finanzas F1)', () => {
  const NOMBRE = 'Negocio DESGLOSE TEST';
  let negocioId: string;
  let sucursalId: string;
  let espId: string;
  let servPropioId: string; // porcentaje propio 60%
  let servFijoId: string;   // valor fijo 20.000
  let servGlobalId: string; // hereda el % global
  let prodId: string;
  let clienteId: string;
  let ctx: TenantContext;
  let writer: ConfigWriteService;
  let atenciones: AtencionService;
  let desglose: DesgloseService;

  async function citaEnProgreso(servicios: { id: string; precio: number }[], hora = 1): Promise<string> {
    const inicio = new Date(Date.now() + hora * 3600_000);
    const [c] = await adminDb
      .insert(cita)
      .values({
        negocioId,
        sucursalId,
        especialistaId: espId,
        clienteId,
        inicio,
        fin: new Date(inicio.getTime() + 30 * 60000),
        estado: EstadoCita.EnProgreso,
        origen: OrigenCita.CreacionInterna,
      })
      .returning();
    await adminDb
      .insert(citaServicio)
      .values(servicios.map((s) => ({ citaId: c.id, servicioId: s.id, precioAplicado: s.precio.toFixed(2) })));
    return c.id;
  }

  beforeAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    const [neg] = await adminDb.insert(negocio).values({ nombre: NOMBRE, perfil: PerfilNegocio.Salon }).returning();
    negocioId = neg.id;
    await adminDb.insert(suscripcion).values({ negocioId, plan: PlanSuscripcion.Pro, numEspecialistas: 2 });
    const [suc] = await adminDb.insert(sucursal).values({ negocioId, nombre: 'Sede' }).returning();
    sucursalId = suc.id;
    const [esp] = await adminDb.insert(especialista).values({ negocioId, nombre: 'Diana' }).returning();
    espId = esp.id;
    const [cli] = await adminDb.insert(cliente).values({ negocioId, nombre: 'Cliente Fiel', telefono: '+573000000001' }).returning();
    clienteId = cli.id;
    const [s1] = await adminDb
      .insert(servicio)
      .values({ negocioId, nombre: 'Color premium', precio: '40000.00', duracionMin: 60, splitType: SplitType.Porcentaje, splitValor: '60.00' })
      .returning();
    servPropioId = s1.id;
    const [s2] = await adminDb
      .insert(servicio)
      .values({ negocioId, nombre: 'Manicure fijo', precio: '30000.00', duracionMin: 30, splitType: SplitType.ValorFijo, splitValor: '20000.00' })
      .returning();
    servFijoId = s2.id;
    const [s3] = await adminDb
      .insert(servicio)
      .values({ negocioId, nombre: 'Corte básico', precio: '25000.00', duracionMin: 30 })
      .returning();
    servGlobalId = s3.id;
    const [prod] = await adminDb
      .insert(producto)
      .values({ negocioId, sucursalId, nombre: 'Shampoo', tipo: 'venta', cantidad: 20, precioVenta: '10000.00', costo: '6000.00' })
      .returning();
    prodId = prod.id;

    ctx = { negocioId, sucursalIds: null, rol: 'admin' };
    const events = new EventEmitter2();
    const resolver = new ConfigResolverService();
    events.on(CONFIG_UPDATED, (p: ConfigUpdatedEvent) => resolver.invalidar(p.negocioId));
    writer = new ConfigWriteService(resolver, events);
    atenciones = new AtencionService(resolver, new MetricsService(), new ModuloGate(resolver, new PlanService()));
    desglose = new DesgloseService(resolver);
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await adminClient.end();
    await client.end();
  });

  it('D9: sin comisión bancaria ASIGNADA, cobrar con tarjeta → 409 y efectivo pasa', async () => {
    const citaTarjeta = await citaEnProgreso([{ id: servGlobalId, precio: 25000 }]);
    await expect(
      atenciones.completar(ctx, citaTarjeta, { pagos: [{ metodo: MetodoPago.Tarjeta, monto: 25000 }] }),
    ).rejects.toMatchObject({ status: 409, response: expect.objectContaining({ codigo: 'COMISION_BANCARIA_SIN_CONFIGURAR' }) });

    // Efectivo no genera comisión: pasa sin asignarla.
    const citaEfectivo = await citaEnProgreso([{ id: servGlobalId, precio: 25000 }], 2);
    const at = await atenciones.completar(ctx, citaEfectivo, { pagos: [{ metodo: MetodoPago.Efectivo, monto: 25000 }] });
    expect(Number(at.total)).toBe(25000);

    // Asignar 0 explícito ES asignar: la tarjeta queda habilitada.
    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'finanzas.comision_bancaria', 0);
    const citaTarjeta2 = await citaEnProgreso([{ id: servGlobalId, precio: 25000 }], 3);
    const at2 = await atenciones.completar(ctx, citaTarjeta2, { pagos: [{ metodo: MetodoPago.Tarjeta, monto: 25000 }] });
    expect(Number(at2.total)).toBe(25000);
  });

  it('el desglose expone regla por servicio, productos, ajustes y la fila de cuadre', async () => {
    // Parámetros con "de todo": comisión bancaria 3.5, deducción 10, tarifa 5.
    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'finanzas.comision_bancaria', 3.5);
    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'finanzas.deduccion_administrativa', 10);
    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'finanzas.tarifa_cliente_profesional', 5);
    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'finanzas.comision_producto_valor', 10);

    const citaId = await citaEnProgreso(
      [
        { id: servPropioId, precio: 40000 },
        { id: servFijoId, precio: 30000 },
        { id: servGlobalId, precio: 25000 },
      ],
      4,
    );
    // total servicios 95000, tarifa 5% = 4750, producto 2×10000 = 20000 → total 119750.
    // Pago dividido: 60000 efectivo + 59750 tarjeta.
    await atenciones.completar(ctx, citaId, {
      pagos: [
        { metodo: MetodoPago.Efectivo, monto: 60000 },
        { metodo: MetodoPago.Tarjeta, monto: 59750 },
      ],
      productos: [{ productoId: prodId, cantidad: 2 }],
    });

    const d = await desglose.desglosePorCita(ctx, citaId);

    // Reglas por línea, con su origen.
    const porNombre = new Map(d.servicios.map((s) => [s.nombre, s]));
    expect(porNombre.get('Color premium')).toMatchObject({
      precio: 40000,
      regla: { tipo: 'porcentaje', valor: 60, origen: 'servicio' },
      ganProf: 24000,
    });
    expect(porNombre.get('Manicure fijo')).toMatchObject({
      precio: 30000,
      regla: { tipo: 'valor_fijo', valor: 20000, origen: 'servicio' },
      ganProf: 20000,
    });
    const global = porNombre.get('Corte básico')!;
    expect(global.regla.origen).toBe('global');
    expect(global.ganProf).toBe(round2((25000 * global.regla.valor) / 100));
    expect(d.servicios.every((s) => !s.aproximado)).toBe(true);

    // Producto con su comisión congelada (10% de 20000 = 2000).
    expect(d.productos).toEqual([
      expect.objectContaining({ nombre: 'Shampoo', cantidad: 2, precioUnitario: 10000, total: 20000, comision: 2000 }),
    ]);

    // Ajustes del snapshot y pagos.
    expect(d.tarifaCliente).toBe(4750);
    expect(d.deduccionAdmin).toBeGreaterThan(0);
    expect(d.comisionBancaria).toBe(round2((59750 * 3.5) / 100));
    expect(d.pagos).toHaveLength(2);

    // La fila de cuadre: total = negocio + especialista + comisión bancaria.
    expect(round2(d.totales.ganSalon + d.totales.ganProf + d.comisionBancaria)).toBe(d.totales.total);
    expect(d.totales.total).toBe(119750);
  });

  it('D2: un especialista solo ve el desglose de SUS atenciones', async () => {
    const [uEsp] = await adminDb
      .insert(usuario)
      .values({ negocioId, nombre: 'Diana', email: `desglose-esp-${Date.now()}@orkalis-test.local`, passwordHash: 'x', rol: RolUsuario.Especialista })
      .returning();
    await adminDb.update(especialista).set({ usuarioId: uEsp.id }).where(eq(especialista.id, espId));
    const [otro] = await adminDb
      .insert(usuario)
      .values({ negocioId, nombre: 'Otro', email: `desglose-otro-${Date.now()}@orkalis-test.local`, passwordHash: 'x', rol: RolUsuario.Especialista })
      .returning();

    const citaId = await citaEnProgreso([{ id: servGlobalId, precio: 25000 }], 5);
    // 25000 + tarifa cliente 5% (activa desde el test anterior) = 26250.
    await atenciones.completar(ctx, citaId, { pagos: [{ metodo: MetodoPago.Efectivo, monto: 26250 }] });

    const ctxDueno: TenantContext = { negocioId, sucursalIds: [sucursalId], rol: RolUsuario.Especialista, usuarioId: uEsp.id };
    const ctxAjeno: TenantContext = { negocioId, sucursalIds: [sucursalId], rol: RolUsuario.Especialista, usuarioId: otro.id };
    expect((await desglose.desglosePorCita(ctxDueno, citaId)).atencionId).toBeTruthy();
    await expect(desglose.desglosePorCita(ctxAjeno, citaId)).rejects.toMatchObject({ status: 403 });
  });

  it('atención VIEJA (sin atencion_servicio): el desglose se reconstruye marcado aproximado', async () => {
    const citaId = await citaEnProgreso([{ id: servPropioId, precio: 40000 }], 6);
    await atenciones.completar(ctx, citaId, { pagos: [{ metodo: MetodoPago.Efectivo, monto: 42000 }] }); // 40000 + tarifa 5%
    // Simula una atención anterior al plan: sin líneas congeladas.
    const d0 = await desglose.desglosePorCita(ctx, citaId);
    await adminDb.delete(atencionServicio).where(eq(atencionServicio.atencionId, d0.atencionId));

    const d = await desglose.desglosePorCita(ctx, citaId);
    expect(d.servicios[0].aproximado).toBe(true);
    expect(d.servicios[0].regla).toMatchObject({ tipo: 'porcentaje', valor: 60 });
    // Los totales congelados no cambian aunque la línea sea reconstruida.
    expect(round2(d.totales.ganSalon + d.totales.ganProf + d.comisionBancaria)).toBe(d.totales.total);
  });

  it('F2: el detalle de ganancias cuadra con sus agregados y respeta el candado D2', async () => {
    const { EquipoService } = await import('../negocio/equipo.service');
    const { PlanService: PS } = await import('../plans/plan.service');
    const equipo = new EquipoService(new PS(), { encolarAviso: async () => {} } as never);

    const desdeR = new Date(Date.now() - 3600_000);
    const hastaR = new Date(Date.now() + 24 * 3600_000);
    const det = await equipo.gananciasDetalle(ctx, espId, desdeR, hastaR);

    // La lista SIEMPRE suma lo que dice la cabecera (misma fuente).
    const sumaNetos = round2(det.transacciones.reduce((s, t) => s + t.neto, 0));
    expect(sumaNetos).toBe(round2(det.total));
    expect(det.transacciones.length).toBeGreaterThanOrEqual(4);
    // La transacción con productos resume su regla con el sufijo de comisión.
    const conProductos = det.transacciones.find((t) => t.reglaResumen.includes('comisión productos'));
    expect(conProductos).toBeDefined();
    expect(conProductos!.concepto).toContain('Color premium');

    // Candado D2 también en ganancias: un especialista no consulta las ajenas.
    const [ajeno] = await adminDb
      .insert(usuario)
      .values({ negocioId, nombre: 'Fisgón', email: `desglose-fisgon-${Date.now()}@orkalis-test.local`, passwordHash: 'x', rol: RolUsuario.Especialista })
      .returning();
    const ctxFisgon: TenantContext = { negocioId, sucursalIds: [sucursalId], rol: RolUsuario.Especialista, usuarioId: ajeno.id };
    await expect(equipo.gananciasDetalle(ctxFisgon, espId, desdeR, hastaR)).rejects.toMatchObject({ status: 403 });
  });

  it('el arqueo pagina, filtra y sus totales cuadran con las filas', async () => {
    const desde = new Date(Date.now() - 3600_000);
    const hasta = new Date(Date.now() + 24 * 3600_000);
    const r = await desglose.arqueo(ctx, { desde, hasta, limit: 100, offset: 0 });

    expect(r.totales.transacciones).toBeGreaterThanOrEqual(5);
    expect(r.filas.length).toBe(r.totales.transacciones);
    const sumaTotal = round2(r.filas.reduce((s, f) => s + f.total, 0));
    expect(sumaTotal).toBe(r.totales.total);
    // La fila con productos los reporta, con sus métodos de pago.
    const conProductos = r.filas.find((f) => f.numProductos > 0)!;
    expect(conProductos.numProductos).toBe(2);
    expect(conProductos.metodos).toEqual(expect.arrayContaining([MetodoPago.Efectivo, MetodoPago.Tarjeta]));

    // Filtro por método: solo transacciones que incluyeron tarjeta.
    const soloTarjeta = await desglose.arqueo(ctx, { desde, hasta, metodo: MetodoPago.Tarjeta, limit: 100, offset: 0 });
    expect(soloTarjeta.filas.length).toBeGreaterThanOrEqual(2);
    expect(soloTarjeta.filas.every((f) => f.metodos.includes(MetodoPago.Tarjeta))).toBe(true);

    // Filtro por servicio: solo las citas que llevaron el servicio "Color premium".
    const soloColor = await desglose.arqueo(ctx, { desde, hasta, servicioId: servPropioId, limit: 100, offset: 0 });
    expect(soloColor.filas.length).toBeGreaterThanOrEqual(2);
    expect(soloColor.totales.transacciones).toBe(soloColor.filas.length);

    // Paginación: página de 2 con más disponible.
    const pagina = await desglose.arqueo(ctx, { desde, hasta, limit: 2, offset: 0 });
    expect(pagina.filas).toHaveLength(2);
    expect(pagina.hayMas).toBe(true);
    expect(pagina.totales.transacciones).toBe(r.totales.transacciones); // totales = rango, no página
  });
});
