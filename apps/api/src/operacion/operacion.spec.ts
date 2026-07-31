import { config as loadEnv } from 'dotenv';
loadEnv();

import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq } from 'drizzle-orm';
import { EstadoCita, MetodoPago, NivelConfig, OrigenCita, PerfilNegocio, PlanSuscripcion, TipoGasto, TipoProducto } from '@orkalis/shared';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { atencion, atencionProducto, cita, especialista, especialistaSucursal, gasto, liquidacion, negocio, producto, sucursal, suscripcion } from '../db/schema';
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
    inventario = new InventarioService(gate, resolver);
    gastos = new GastosService();
    liquidaciones = new LiquidacionesService(gate);
    reportes = new ReportesService();
    cierre = new CierreService(gate, reportes, liquidaciones);
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
    await expect(inventario.listarMovimientos(ctx, {})).rejects.toThrow();
    await expect(inventario.listarVentas(ctx, {})).rejects.toThrow();
    await writer.remove(ctx, NivelConfig.Negocio, negocioId, 'modulo.inventario');
  });

  it('recarga de stock actualiza el costo al promedio ponderado', async () => {
    const p = await inventario.crear(ctx, {
      sucursalId,
      nombre: 'Tinte',
      tipo: TipoProducto.Venta,
      cantidad: 10,
      costo: 1000, // 10 uds a 1000
      precioVenta: 5000,
      generaGasto: false,
    });
    // Compra 10 uds más por 20000 → 20000/10 = 2000 c/u. Promedio: (10×1000 + 20000)/20 = 1500.
    await inventario.movimiento(ctx, { productoId: p.id, tipoMov: 'entrada', cantidad: 10, costoTotal: 20000 });
    const [prod] = await adminDb.select({ costo: producto.costo }).from(producto).where(eq(producto.id, p.id));
    expect(Number(prod.costo)).toBe(1500);
  });

  it('entrada sin costo NO recalcula el costo del producto', async () => {
    const p = await inventario.crear(ctx, {
      sucursalId, nombre: 'Gel', tipo: TipoProducto.Venta, cantidad: 5, costo: 800, precioVenta: 3000, generaGasto: false,
    });
    await inventario.movimiento(ctx, { productoId: p.id, tipoMov: 'entrada', cantidad: 5 });
    const [prod] = await adminDb.select({ costo: producto.costo }).from(producto).where(eq(producto.id, p.id));
    expect(Number(prod.costo)).toBe(800);
  });

  it('crear producto con stock inicial genera gasto y movimiento', async () => {
    const p = await inventario.crear(ctx, {
      sucursalId, nombre: 'Mascarilla', tipo: TipoProducto.Venta, cantidad: 8, costo: 2500, precioVenta: 6000,
    });
    const lista = await gastos.listar(ctx, sucursalId);
    expect(lista.some((g) => g.categoria === 'Compra de inventario' && Number(g.monto) === 20000)).toBe(true);
    const { items } = await inventario.listarMovimientos(ctx, { productoId: p.id });
    const inicial = items.find((m) => m.motivo === 'Stock inicial');
    expect(inicial).toBeTruthy();
    expect(inicial!.stockResultante).toBe(8);
    expect(Number(inicial!.costoTotal)).toBe(20000);
  });

  it('venta directa toma la comisión de la configuración (no del request)', async () => {
    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'finanzas.comision_producto_valor', 20);
    const p = await inventario.crear(ctx, {
      sucursalId, nombre: 'Serum', tipo: TipoProducto.Venta, cantidad: 10, costo: 4000, precioVenta: 10000, generaGasto: false,
    });
    const { total, comision } = await inventario.vender(ctx, { productoId: p.id, cantidad: 2, especialistaId: espId });
    expect(total).toBe(20000);
    expect(comision).toBe(4000); // 20% de 20000
    await writer.remove(ctx, NivelConfig.Negocio, negocioId, 'finanzas.comision_producto_valor');
  });

  it('sin especialista no hay comisión en la venta directa', async () => {
    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'finanzas.comision_producto_valor', 20);
    const p = await inventario.crear(ctx, {
      sucursalId, nombre: 'Aceite', tipo: TipoProducto.Venta, cantidad: 10, costo: 4000, precioVenta: 10000, generaGasto: false,
    });
    const { comision } = await inventario.vender(ctx, { productoId: p.id, cantidad: 1 });
    expect(comision).toBe(0);
    await writer.remove(ctx, NivelConfig.Negocio, negocioId, 'finanzas.comision_producto_valor');
  });

  it('stock insuficiente: bloquea con flag OFF, permite negativo con flag ON', async () => {
    const p = await inventario.crear(ctx, {
      sucursalId, nombre: 'Locion', tipo: TipoProducto.Venta, cantidad: 1, costo: 1000, precioVenta: 3000, generaGasto: false,
    });
    await expect(inventario.vender(ctx, { productoId: p.id, cantidad: 5 })).rejects.toThrow(/insuficiente/i);

    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'inventario.permitir_stock_negativo', true);
    const { total } = await inventario.vender(ctx, { productoId: p.id, cantidad: 5 });
    expect(total).toBe(15000);
    const [prod] = await adminDb.select({ cantidad: producto.cantidad }).from(producto).where(eq(producto.id, p.id));
    expect(prod.cantidad).toBe(-4); // 1 − 5
    await writer.remove(ctx, NivelConfig.Negocio, negocioId, 'inventario.permitir_stock_negativo');
  });

  it('historial de ventas une venta directa y venta en cita sin duplicar', async () => {
    const p = await inventario.crear(ctx, {
      sucursalId, nombre: 'Balsamo', tipo: TipoProducto.Venta, cantidad: 20, costo: 1000, precioVenta: 5000, generaGasto: false,
    });
    // Venta directa.
    await inventario.vender(ctx, { productoId: p.id, cantidad: 1, especialistaId: espId });
    // Venta en cita: se siembra una atención con su línea de producto.
    const [c] = await adminDb.insert(cita).values({
      negocioId, sucursalId, especialistaId: espId,
      inicio: new Date('2031-01-10T14:00:00Z'), fin: new Date('2031-01-10T14:30:00Z'),
      estado: EstadoCita.Completada, origen: OrigenCita.CreacionInterna,
    }).returning();
    const [at] = await adminDb.insert(atencion).values({
      negocioId, sucursalId, citaId: c.id, especialistaId: espId,
      total: '5000.00', ganProf: '0.00', ganSalon: '5000.00', metodoPago: MetodoPago.Efectivo,
      snapshotParam: {}, creadoEn: new Date('2031-01-10T15:00:00Z'),
    }).returning();
    await adminDb.insert(atencionProducto).values({
      atencionId: at.id, productoId: p.id, cantidad: 1, valor: '5000.00', costoUnitario: '1000.00', comision: '0.00',
    });

    const hist = await inventario.listarVentas(ctx, { productoId: p.id });
    expect(hist.items).toHaveLength(2);
    expect(hist.items.some((i) => i.origen === 'directa')).toBe(true);
    expect(hist.items.some((i) => i.origen === 'cita')).toBe(true);
    expect(hist.totales.unidades).toBe(2);
    expect(hist.totales.total).toBe(10000);
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
    // D3 (Plan-Finanzas F5): la comisión bancaria la absorbió el salón EN EL
    // COBRO; la liquidación ya no la descuenta OTRA VEZ al especialista. Antes
    // aquí se esperaba descuento=1000 (2% recalculado sobre el método
    // dominante): era un doble cobro de la misma comisión.
    expect(mia!.descuento).toBe(0);
    expect(mia!.neto).toBe(50000);

    // La fila persistida guarda el rango real y el desglose (F5).
    const [persistida] = await adminDb
      .select()
      .from(liquidacion)
      .where(and(eq(liquidacion.especialistaId, espId), eq(liquidacion.periodo, '2030-03')))
      .orderBy(desc(liquidacion.creadoEn))
      .limit(1);
    expect(persistida.desde).toEqual(new Date('2030-03-01'));
    expect(Number(persistida.comisionServicios)).toBe(50000);

    // Consolidado (sin sucursal): incluye al menos lo mismo que la sede.
    const consolidado = await liquidaciones.preview(ctx, { desde: new Date('2030-03-01'), hasta: new Date('2030-04-01') });
    const miaCons = consolidado.find((r) => r.especialistaId === espId);
    expect(miaCons!.bruto).toBeGreaterThanOrEqual(50000);

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

  it('cierre F6: rangos por ancla en Bogotá, tipo correcto, archivo completo y anti-solape', async () => {
    // Módulo OFF → bloqueado.
    await expect(cierre.cerrar(ctx, { tipo: 'mensual', ancla: '2030-03-01', sucursalId })).rejects.toThrow();

    await writer.upsert(ctx, NivelConfig.Negocio, negocioId, 'modulo.cierre_periodo', true);

    // El BACKEND deriva el rango del ancla (antes lo mandaba el navegador y el
    // tipo siempre llegaba 'mensual').
    const q1 = await cierre.cerrar(ctx, { tipo: 'quincenal', ancla: '2030-03-07', sucursalId });
    expect(q1.tipo).toBe('quincenal');
    expect(q1.desde.toISOString()).toBe('2030-03-01T05:00:00.000Z'); // 1 mar 00:00 Bogotá
    expect(q1.hasta.toISOString()).toBe('2030-03-16T04:59:59.999Z'); // 15 mar 23:59 Bogotá

    // El archivo lleva el análisis COMPLETO + la liquidación del período.
    const archivo = q1.datosArchivados as { analisis?: { ingresosTotales: number }; liquidaciones?: unknown[] };
    expect(archivo.analisis).toBeDefined();
    expect(Array.isArray(archivo.liquidaciones)).toBe(true);

    // Anti-solape: el mes que contiene la quincena cerrada choca → 409.
    await expect(cierre.cerrar(ctx, { tipo: 'mensual', ancla: '2030-03-01', sucursalId })).rejects.toMatchObject({ status: 409 });
    // La segunda quincena NO choca.
    const q2 = await cierre.cerrar(ctx, { tipo: 'quincenal', ancla: '2030-03-16', sucursalId });
    expect(q2.desde.toISOString()).toBe('2030-03-16T05:00:00.000Z');
    expect(q2.hasta.toISOString()).toBe('2030-04-01T04:59:59.999Z'); // 31 mar 23:59 Bogotá
    // Y el consolidado (sin sucursal) es OTRO alcance: puede cerrar el mismo mes.
    const cons = await cierre.cerrar(ctx, { tipo: 'mensual', ancla: '2030-03-01' });
    expect(cons.sucursalId).toBeNull();

    await writer.remove(ctx, NivelConfig.Negocio, negocioId, 'modulo.cierre_periodo');
  });
});
