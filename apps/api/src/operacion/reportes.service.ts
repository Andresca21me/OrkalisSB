import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, gte, inArray, lt, lte, ne, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { EstadoCita, type MetodoPago, type PanelResumen, type ReporteAnalisis } from '@orkalis/shared';
import { runInTenantTx } from '../db/tx';
import {
  atencion,
  atencionPago,
  atencionProducto,
  cita,
  citaServicio,
  cliente,
  especialista,
  especialistaSucursal,
  gasto,
  servicio,
  ventaProducto,
} from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { round2 } from '../finanzas/calculo';

/** Clave de día/mes en zona Bogotá (UTC-5) para agrupar series temporales. */
function bogotaKey(d: Date, porDia: boolean): string {
  const shifted = new Date(d.getTime() - 5 * 3600_000).toISOString();
  return porDia ? shifted.slice(0, 10) : shifted.slice(0, 7);
}

/** Medianoche Bogotá (UTC-5) de una fecha 'YYYY-MM-DD', como instante UTC. */
function bogotaMidnight(fechaIso: string): Date {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 5, 0, 0));
}

export interface ReporteFinanciero {
  desde: string;
  hasta: string;
  ingresos: number;
  gastos: number;
  gananciaNeta: number;
  margen: number; // 0..1
  salud: 'sin_datos' | 'saludable' | 'ajustada' | 'en_perdida';
}

/** Reportes financieros (FASE-10, RF-042/RF-044). Período sin datos → ceros. */
@Injectable()
export class ReportesService {
  async financiero(
    ctx: TenantContext,
    desde: Date,
    hasta: Date,
    sucursalId?: string,
  ): Promise<ReporteFinanciero> {
    return runInTenantTx(ctx, async (tx) => {
      const sumNum = (col: PgColumn) => sql<number>`coalesce(sum(${col}), 0)`.mapWith(Number);

      const [{ ingAt }] = await tx
        .select({ ingAt: sumNum(atencion.total) })
        .from(atencion)
        .where(
          and(
            gte(atencion.creadoEn, desde),
            lte(atencion.creadoEn, hasta),
            sucursalId ? eq(atencion.sucursalId, sucursalId) : undefined,
          ),
        );

      const [{ ingVenta }] = await tx
        .select({ ingVenta: sumNum(ventaProducto.total) })
        .from(ventaProducto)
        .where(
          and(
            gte(ventaProducto.creadoEn, desde),
            lte(ventaProducto.creadoEn, hasta),
            sucursalId ? eq(ventaProducto.sucursalId, sucursalId) : undefined,
          ),
        );

      const [{ gas }] = await tx
        .select({ gas: sumNum(gasto.monto) })
        .from(gasto)
        .where(
          and(
            eq(gasto.activo, true),
            gte(gasto.creadoEn, desde),
            lte(gasto.creadoEn, hasta),
            sucursalId ? eq(gasto.sucursalId, sucursalId) : undefined,
          ),
        );

      const ingresos = round2((ingAt ?? 0) + (ingVenta ?? 0));
      const gastos = round2(gas ?? 0);
      const gananciaNeta = round2(ingresos - gastos);
      const margen = ingresos > 0 ? round2(gananciaNeta / ingresos) : 0;

      let salud: ReporteFinanciero['salud'];
      if (ingresos === 0 && gastos === 0) salud = 'sin_datos';
      else if (gananciaNeta < 0) salud = 'en_perdida';
      else if (margen < 0.2) salud = 'ajustada';
      else salud = 'saludable';

      return {
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
        ingresos,
        gastos,
        gananciaNeta,
        margen,
        salud,
      };
    });
  }

  /**
   * Análisis financiero del período con desgloses y series (FASE-08, H7).
   * Derivado de atenciones/ventas/gastos; sin tablas nuevas. Las ganancias del
   * profesional NO son egreso (ya separadas en origen por la repartición).
   */
  async analisis(
    ctx: TenantContext,
    desde: Date,
    hasta: Date,
    sucursalId?: string,
    filtros?: { especialistaId?: string; servicioId?: string },
  ): Promise<ReporteAnalisis> {
    return runInTenantTx(ctx, async (tx) => {
      // Filtros de transparencia (Plan-Finanzas F4). Con filtro de servicio, las
      // ventas DIRECTAS de mostrador quedan fuera (no llevan servicio). Los
      // gastos no se filtran: son del negocio, no de un especialista.
      const condAtencion = and(
        gte(atencion.creadoEn, desde),
        lte(atencion.creadoEn, hasta),
        sucursalId ? eq(atencion.sucursalId, sucursalId) : undefined,
        filtros?.especialistaId ? eq(atencion.especialistaId, filtros.especialistaId) : undefined,
        filtros?.servicioId
          ? sql`EXISTS (SELECT 1 FROM ${citaServicio} cs WHERE cs.cita_id = ${atencion.citaId} AND cs.servicio_id = ${filtros.servicioId})`
          : undefined,
      );
      const ats = await tx
        .select({
          total: atencion.total,
          ganProf: atencion.ganProf,
          ganSalon: atencion.ganSalon,
          especialistaId: atencion.especialistaId,
          citaId: atencion.citaId,
          creadoEn: atencion.creadoEn,
        })
        .from(atencion)
        .where(condAtencion);

      // "Por método de pago" desde el desglose real (soporta pago dividido).
      const pagos = await tx
        .select({ metodo: atencionPago.metodo, monto: atencionPago.monto })
        .from(atencionPago)
        .innerJoin(atencion, eq(atencion.id, atencionPago.atencionId))
        .where(condAtencion);

      const ventas = filtros?.servicioId
        ? []
        : await tx
            .select({ total: ventaProducto.total, comisionProf: ventaProducto.comisionProf, creadoEn: ventaProducto.creadoEn })
            .from(ventaProducto)
            .where(
              and(
                gte(ventaProducto.creadoEn, desde),
                lte(ventaProducto.creadoEn, hasta),
                sucursalId ? eq(ventaProducto.sucursalId, sucursalId) : undefined,
                filtros?.especialistaId ? eq(ventaProducto.especialistaId, filtros.especialistaId) : undefined,
              ),
            );

      // Productos vendidos DENTRO de citas (para el KPI informativo de ventas de
      // producto). Su ingreso ya está en `atencion.total`, así que NO se suma a
      // `ingresosTotales`: solo alimenta `ventasProducto` para que el KPI refleje
      // también lo vendido en el cobro de la cita.
      const [ventasCita] = await tx
        .select({
          valor: sql<number>`coalesce(sum(${atencionProducto.valor} * ${atencionProducto.cantidad}), 0)`.mapWith(Number),
        })
        .from(atencionProducto)
        .innerJoin(atencion, eq(atencion.id, atencionProducto.atencionId))
        .where(condAtencion);

      const gastos = await tx
        .select({ tipo: gasto.tipo, monto: gasto.monto })
        .from(gasto)
        .where(and(eq(gasto.activo, true), gte(gasto.creadoEn, desde), lte(gasto.creadoEn, hasta), sucursalId ? eq(gasto.sucursalId, sucursalId) : undefined));

      let ingAten = 0;
      let ganProf = 0;
      let ganSalon = 0;
      const porMetodo = new Map<string, number>();
      const porEspId = new Map<string, number>();
      for (const a of ats) {
        ingAten += Number(a.total);
        ganProf += Number(a.ganProf);
        ganSalon += Number(a.ganSalon);
        porEspId.set(a.especialistaId, (porEspId.get(a.especialistaId) ?? 0) + Number(a.ganProf));
      }
      for (const p of pagos) {
        porMetodo.set(p.metodo, (porMetodo.get(p.metodo) ?? 0) + Number(p.monto));
      }

      let ventasTotal = 0;
      let ventasComision = 0;
      for (const v of ventas) {
        ventasTotal += Number(v.total);
        ventasComision += Number(v.comisionProf);
      }

      let gastosFijos = 0;
      let gastosVariables = 0;
      for (const g of gastos) {
        if (g.tipo === 'fijo') gastosFijos += Number(g.monto);
        else gastosVariables += Number(g.monto);
      }

      const ingresosTotales = round2(ingAten + ventasTotal);
      const ingresosSalon = round2(ganSalon + (ventasTotal - ventasComision));
      const ganProfesionales = round2(ganProf + ventasComision);
      const egresos = round2(gastosFijos + gastosVariables);
      const gananciaNeta = round2(ingresosSalon - egresos);
      const margen = ingresosSalon > 0 ? round2(gananciaNeta / ingresosSalon) : 0;

      let salud: ReporteAnalisis['salud'];
      if (ingresosTotales === 0 && egresos === 0) salud = 'sin_datos';
      else if (gananciaNeta < 0) salud = 'en_perdida';
      else if (margen < 0.2) salud = 'ajustada';
      else salud = 'saludable';

      // Desglose por servicio (precio aplicado en las citas con atención).
      const citaIds = [...new Set(ats.map((a) => a.citaId))];
      const porServ = new Map<string, number>();
      if (citaIds.length) {
        const filas = await tx
          .select({ nombre: servicio.nombre, precio: citaServicio.precioAplicado })
          .from(citaServicio)
          .innerJoin(servicio, eq(servicio.id, citaServicio.servicioId))
          .where(inArray(citaServicio.citaId, citaIds));
        for (const f of filas) porServ.set(f.nombre, (porServ.get(f.nombre) ?? 0) + Number(f.precio));
      }

      const espNombres = new Map(
        (await tx.select({ id: especialista.id, nombre: especialista.nombre }).from(especialista)).map((e) => [e.id, e.nombre]),
      );

      // Serie temporal: por día si el rango ≤ 45 días; si no, por mes.
      const dias = Math.ceil((hasta.getTime() - desde.getTime()) / 86400_000);
      const porDia = dias <= 45;
      const fmtDia = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' });
      const fmtMes = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', month: 'short' });
      const buckets = new Map<string, { etiqueta: string; total: number }>();
      const addBucket = (d: Date, monto: number) => {
        const key = bogotaKey(d, porDia);
        const etiqueta = (porDia ? fmtDia : fmtMes).format(d);
        const cur = buckets.get(key) ?? { etiqueta, total: 0 };
        cur.total += monto;
        buckets.set(key, cur);
      };
      for (const a of ats) addBucket(a.creadoEn, Number(a.total));
      for (const v of ventas) addBucket(v.creadoEn, Number(v.total));
      const tendencia = [...buckets.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, v]) => ({ etiqueta: v.etiqueta, total: round2(v.total) }));

      return {
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
        ingresosTotales,
        ingresosSalon,
        ganProfesionales,
        ventasProducto: round2(ventasTotal + (ventasCita?.valor ?? 0)),
        servicios: ats.length,
        gastosFijos: round2(gastosFijos),
        gastosVariables: round2(gastosVariables),
        egresos,
        gananciaNeta,
        margen,
        salud,
        porMetodoPago: [...porMetodo.entries()].map(([metodo, total]) => ({ metodo: metodo as MetodoPago, total: round2(total) })).sort((a, b) => b.total - a.total),
        porServicio: [...porServ.entries()].map(([nombre, total]) => ({ nombre, total: round2(total) })).sort((a, b) => b.total - a.total),
        porEspecialista: [...porEspId.entries()].map(([id, ingresos]) => ({ nombre: espNombres.get(id) ?? '—', ingresos: round2(ingresos) })).sort((a, b) => b.ingresos - a.ingresos),
        tendencia,
      };
    });
  }

  /** Resumen del panel admin (FASE-05, H2): KPIs del día + resumen del mes. */
  async panel(ctx: TenantContext, fechaIso: string, sucursalId?: string): Promise<PanelResumen> {
    const hoy0 = bogotaMidnight(fechaIso);
    const manana0 = new Date(hoy0.getTime() + 24 * 3600_000);
    const ayer0 = new Date(hoy0.getTime() - 24 * 3600_000);
    const [y, m] = fechaIso.split('-').map(Number);
    const mes0 = new Date(Date.UTC(y, m - 1, 1, 5, 0, 0));
    const ahora = new Date();

    const sucCita = sucursalId ? eq(cita.sucursalId, sucursalId) : undefined;
    const num = (col: PgColumn) => sql<number>`coalesce(sum(${col}), 0)`.mapWith(Number);
    const cnt = sql<number>`count(*)`.mapWith(Number);

    return runInTenantTx(ctx, async (tx) => {
      // Citas de hoy / ayer (cualquier estado).
      const [{ c: citasHoy }] = await tx.select({ c: cnt }).from(cita).where(and(sucCita, gte(cita.inicio, hoy0), lt(cita.inicio, manana0)));
      const [{ c: citasAyer }] = await tx.select({ c: cnt }).from(cita).where(and(sucCita, gte(cita.inicio, ayer0), lt(cita.inicio, hoy0)));

      // Ingresos estimados de hoy (citas no canceladas/no-asistió).
      const [{ ing, n }] = await tx
        .select({ ing: num(cita.precioEst), n: cnt })
        .from(cita)
        .where(
          and(
            sucCita,
            gte(cita.inicio, hoy0),
            lt(cita.inicio, manana0),
            ne(cita.estado, EstadoCita.Cancelada),
            ne(cita.estado, EstadoCita.NoAsistio),
          ),
        );
      const ticket = n > 0 ? round2(ing / n) : 0;

      // Especialistas en alcance (total / disponibles).
      const espBase = sucursalId
        ? tx
            .select({ id: especialista.id, disponible: especialista.disponible })
            .from(especialista)
            .innerJoin(especialistaSucursal, eq(especialistaSucursal.especialistaId, especialista.id))
            .where(and(eq(especialista.activo, true), eq(especialistaSucursal.sucursalId, sucursalId)))
        : tx
            .select({ id: especialista.id, disponible: especialista.disponible })
            .from(especialista)
            .where(eq(especialista.activo, true));
      const esps = await espBase;
      const especialistasTotal = esps.length;
      const especialistasDisponibles = esps.filter((e) => e.disponible).length;

      // Próxima cita futura de hoy (confirmada/solicitada/en progreso).
      const [prox] = await tx
        .select({ inicio: cita.inicio, clienteNombre: cliente.nombre })
        .from(cita)
        .leftJoin(cliente, eq(cliente.id, cita.clienteId))
        .where(
          and(
            sucCita,
            gt(cita.inicio, ahora),
            lt(cita.inicio, manana0),
            sql`${cita.estado} in (${EstadoCita.Confirmada}, ${EstadoCita.Solicitada}, ${EstadoCita.EnProgreso})`,
          ),
        )
        .orderBy(asc(cita.inicio))
        .limit(1);

      // Resumen del mes (motor financiero).
      const sucAt = sucursalId ? eq(atencion.sucursalId, sucursalId) : undefined;
      const sucVp = sucursalId ? eq(ventaProducto.sucursalId, sucursalId) : undefined;
      const [at] = await tx
        .select({ total: num(atencion.total), prof: num(atencion.ganProf), salon: num(atencion.ganSalon) })
        .from(atencion)
        .where(and(sucAt, gte(atencion.creadoEn, mes0), lte(atencion.creadoEn, ahora)));
      const [{ vp }] = await tx
        .select({ vp: num(ventaProducto.total) })
        .from(ventaProducto)
        .where(and(sucVp, gte(ventaProducto.creadoEn, mes0), lte(ventaProducto.creadoEn, ahora)));

      const etiqueta = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', month: 'long', year: 'numeric' }).format(hoy0);

      return {
        fecha: fechaIso,
        citasHoy,
        citasAyer,
        ingresosEstimadosHoy: round2(ing).toFixed(2),
        ticketPromedioHoy: ticket.toFixed(2),
        especialistasTotal,
        especialistasDisponibles,
        proximaCita: prox ? { inicio: prox.inicio.toISOString(), clienteNombre: prox.clienteNombre } : null,
        mes: {
          etiqueta,
          ingresos: round2(at.total).toFixed(2),
          ganProfesionales: round2(at.prof).toFixed(2),
          ganSalon: round2(at.salon).toFixed(2),
          valorProductos: round2(vp).toFixed(2),
        },
      };
    });
  }
}
