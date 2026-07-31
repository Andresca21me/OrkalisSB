import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import {
  NivelConfig,
  RolUsuario,
  type ArqueoFila,
  type ArqueoResp,
  type ContextoCobro,
  type DesgloseAtencion,
  type DesgloseServicio,
  type MetodoPago,
} from '@orkalis/shared';
import { ConfigResolverService } from '../config-module/config-resolver.service';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import {
  atencion,
  atencionPago,
  atencionProducto,
  atencionServicio,
  cita,
  citaServicio,
  cliente,
  especialista,
  producto,
  servicio,
} from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { round2 } from './calculo';

export interface ArqueoFiltros {
  desde: Date;
  hasta: Date;
  sucursalId?: string;
  especialistaId?: string;
  servicioId?: string;
  productoId?: string;
  metodo?: MetodoPago;
  limit: number;
  offset: number;
}

/** Forma persistida del snapshot de la atención (ver `calculo.ts`). */
interface SnapshotAtencion {
  parametros?: { reparticionProfesional?: number; particionPorEspecialista?: boolean };
  totalServicios?: number;
  totalProductos?: number;
  deduccion?: number;
  tarifa?: number;
  comisionBancaria?: number;
}

/**
 * Lectura de la transparencia financiera (Plan-Finanzas F1): el desglose exacto
 * de UNA transacción y el arqueo del período. No calcula nada nuevo — expone lo
 * que `calcularAtencion` congeló al cobrar.
 */
@Injectable()
export class DesgloseService {
  constructor(private readonly config: ConfigResolverService) {}

  /**
   * Lo que la pantalla de cobro necesita saber ANTES de elegir método (D9): si
   * la comisión bancaria ya fue asignada (procedencia ≠ default del sistema) y
   * su % vigente. Sin asignar, la UI bloquea tarjeta/transferencia/Nequi y el
   * backend igualmente rechaza en `completar` (doble barrera).
   */
  async contextoCobro(ctx: TenantContext, sucursalId: string | null): Promise<ContextoCobro> {
    const cb = await this.config.resolver(ctx.negocioId, sucursalId, 'finanzas.comision_bancaria');
    return {
      comisionBancariaConfigurada: cb.procedencia !== NivelConfig.Sistema,
      comisionBancaria: typeof cb.valor === 'number' ? cb.valor : Number(cb.valor),
    };
  }

  /**
   * Desglose completo de la atención de una cita. El admin ve cualquiera; un
   * especialista SOLO la suya (D2) — recepción no llega aquí (roles del
   * controller).
   */
  async desglosePorCita(ctx: TenantContext, citaId: string): Promise<DesgloseAtencion> {
    return runInTenantTx(ctx, async (tx) => {
      const [fila] = await tx
        .select({
          at: atencion,
          clienteNombre: cliente.nombre,
          especialistaNombre: especialista.nombre,
          especialistaUsuarioId: especialista.usuarioId,
        })
        .from(atencion)
        .innerJoin(cita, eq(cita.id, atencion.citaId))
        .innerJoin(especialista, eq(especialista.id, atencion.especialistaId))
        .leftJoin(cliente, eq(cliente.id, cita.clienteId))
        .where(eq(atencion.citaId, citaId))
        .limit(1);
      if (!fila) throw new NotFoundException('Esta cita no tiene un cobro registrado.');

      if (ctx.rol === RolUsuario.Especialista && fila.especialistaUsuarioId !== ctx.usuarioId) {
        throw new ForbiddenException('Solo puedes ver el desglose de tus propias atenciones.');
      }

      const at = fila.at;
      const snap = (at.snapshotParam ?? {}) as SnapshotAtencion;

      const servicios = await this.serviciosDe(tx, at.id, citaId, snap);

      const lineasProducto = await tx
        .select({
          nombre: producto.nombre,
          cantidad: atencionProducto.cantidad,
          valor: atencionProducto.valor,
          comision: atencionProducto.comision,
        })
        .from(atencionProducto)
        .innerJoin(producto, eq(producto.id, atencionProducto.productoId))
        .where(eq(atencionProducto.atencionId, at.id));

      const pagos = await tx
        .select({ metodo: atencionPago.metodo, monto: atencionPago.monto })
        .from(atencionPago)
        .where(eq(atencionPago.atencionId, at.id));

      return {
        atencionId: at.id,
        citaId,
        fecha: at.creadoEn.toISOString(),
        clienteNombre: fila.clienteNombre ?? null,
        especialista: { id: at.especialistaId, nombre: fila.especialistaNombre },
        servicios,
        productos: lineasProducto.map((l) => ({
          nombre: l.nombre,
          cantidad: l.cantidad,
          precioUnitario: Number(l.valor),
          total: round2(l.cantidad * Number(l.valor)),
          comision: Number(l.comision),
        })),
        pagos: pagos.map((p) => ({ metodo: p.metodo as MetodoPago, monto: Number(p.monto) })),
        tarifaCliente: Number(snap.tarifa ?? 0),
        deduccionAdmin: Number(snap.deduccion ?? 0),
        comisionBancaria: Number(snap.comisionBancaria ?? 0),
        totales: {
          total: Number(at.total),
          totalServicios: Number(snap.totalServicios ?? 0),
          totalProductos: Number(snap.totalProductos ?? 0),
          ganProf: Number(at.ganProf),
          ganSalon: Number(at.ganSalon),
        },
      };
    });
  }

  /** Arqueo por rango con filtros (Admin). Página + totales del rango completo. */
  async arqueo(ctx: TenantContext, f: ArqueoFiltros): Promise<ArqueoResp> {
    return runInTenantTx(ctx, async (tx) => {
      const condiciones: SQL[] = [gte(atencion.creadoEn, f.desde), lte(atencion.creadoEn, f.hasta)];
      if (f.sucursalId) condiciones.push(eq(atencion.sucursalId, f.sucursalId));
      if (f.especialistaId) condiciones.push(eq(atencion.especialistaId, f.especialistaId));
      if (f.servicioId) {
        condiciones.push(
          sql`EXISTS (SELECT 1 FROM ${citaServicio} cs WHERE cs.cita_id = ${atencion.citaId} AND cs.servicio_id = ${f.servicioId})`,
        );
      }
      if (f.productoId) {
        condiciones.push(
          sql`EXISTS (SELECT 1 FROM ${atencionProducto} ap WHERE ap.atencion_id = ${atencion.id} AND ap.producto_id = ${f.productoId})`,
        );
      }
      if (f.metodo) {
        condiciones.push(
          sql`EXISTS (SELECT 1 FROM ${atencionPago} pg WHERE pg.atencion_id = ${atencion.id} AND pg.metodo = ${f.metodo})`,
        );
      }
      const where = and(...condiciones);

      const pagina = await tx
        .select({
          at: atencion,
          clienteNombre: cliente.nombre,
          especialistaNombre: especialista.nombre,
        })
        .from(atencion)
        .innerJoin(cita, eq(cita.id, atencion.citaId))
        .innerJoin(especialista, eq(especialista.id, atencion.especialistaId))
        .leftJoin(cliente, eq(cliente.id, cita.clienteId))
        .where(where)
        .orderBy(desc(atencion.creadoEn))
        .limit(f.limit + 1)
        .offset(f.offset);
      const hayMas = pagina.length > f.limit;
      const visibles = pagina.slice(0, f.limit);

      // Datos satélite de la página en 3 consultas (no por fila).
      const ids = visibles.map((v) => v.at.id);
      const nombresServicios = new Map<string, string[]>();
      const numProductos = new Map<string, number>();
      const metodos = new Map<string, MetodoPago[]>();
      if (ids.length) {
        const servRows = await tx
          .select({ atencionId: atencionServicio.atencionId, nombre: atencionServicio.nombre })
          .from(atencionServicio)
          .where(sql`${atencionServicio.atencionId} IN ${ids}`);
        for (const r of servRows) {
          nombresServicios.set(r.atencionId, [...(nombresServicios.get(r.atencionId) ?? []), r.nombre]);
        }
        // Atenciones previas a la tabla: nombres desde cita_servicio.
        const sinLineas = visibles.filter((v) => !nombresServicios.has(v.at.id));
        if (sinLineas.length) {
          const viejas = await tx
            .select({ citaId: citaServicio.citaId, nombre: servicio.nombre })
            .from(citaServicio)
            .innerJoin(servicio, eq(servicio.id, citaServicio.servicioId))
            .where(sql`${citaServicio.citaId} IN ${sinLineas.map((v) => v.at.citaId)}`);
          const porCita = new Map<string, string[]>();
          for (const r of viejas) porCita.set(r.citaId, [...(porCita.get(r.citaId) ?? []), r.nombre]);
          for (const v of sinLineas) nombresServicios.set(v.at.id, porCita.get(v.at.citaId) ?? []);
        }
        const prodRows = await tx
          .select({ atencionId: atencionProducto.atencionId, n: sql<number>`sum(${atencionProducto.cantidad})`.mapWith(Number) })
          .from(atencionProducto)
          .where(sql`${atencionProducto.atencionId} IN ${ids}`)
          .groupBy(atencionProducto.atencionId);
        for (const r of prodRows) numProductos.set(r.atencionId, r.n);
        const pagoRows = await tx
          .select({ atencionId: atencionPago.atencionId, metodo: atencionPago.metodo, monto: atencionPago.monto })
          .from(atencionPago)
          .where(sql`${atencionPago.atencionId} IN ${ids}`)
          .orderBy(desc(atencionPago.monto));
        for (const r of pagoRows) {
          const arr = metodos.get(r.atencionId) ?? [];
          if (!arr.includes(r.metodo as MetodoPago)) arr.push(r.metodo as MetodoPago);
          metodos.set(r.atencionId, arr);
        }
      }

      // Totales del RANGO completo (agregación SQL, independiente de la página).
      // totalServicios/totalProductos/comisionBancaria viven en el snapshot jsonb.
      const [tot] = await tx
        .select({
          transacciones: sql<number>`count(*)`.mapWith(Number),
          total: sql<number>`coalesce(sum(${atencion.total}), 0)`.mapWith(Number),
          ganProf: sql<number>`coalesce(sum(${atencion.ganProf}), 0)`.mapWith(Number),
          ganSalon: sql<number>`coalesce(sum(${atencion.ganSalon}), 0)`.mapWith(Number),
          totalServicios: sql<number>`coalesce(sum((${atencion.snapshotParam}->>'totalServicios')::numeric), 0)`.mapWith(Number),
          totalProductos: sql<number>`coalesce(sum((${atencion.snapshotParam}->>'totalProductos')::numeric), 0)`.mapWith(Number),
          comisionBancaria: sql<number>`coalesce(sum((${atencion.snapshotParam}->>'comisionBancaria')::numeric), 0)`.mapWith(Number),
        })
        .from(atencion)
        .where(where);

      const filas: ArqueoFila[] = visibles.map((v) => ({
        atencionId: v.at.id,
        citaId: v.at.citaId,
        fecha: v.at.creadoEn.toISOString(),
        clienteNombre: v.clienteNombre ?? null,
        especialista: { id: v.at.especialistaId, nombre: v.especialistaNombre },
        servicios: nombresServicios.get(v.at.id) ?? [],
        numProductos: numProductos.get(v.at.id) ?? 0,
        metodos: metodos.get(v.at.id) ?? [],
        total: Number(v.at.total),
        ganProf: Number(v.at.ganProf),
        ganSalon: Number(v.at.ganSalon),
      }));

      return {
        filas,
        hayMas,
        totales: {
          transacciones: tot.transacciones,
          total: round2(tot.total),
          totalServicios: round2(tot.totalServicios),
          totalProductos: round2(tot.totalProductos),
          ganProf: round2(tot.ganProf),
          ganSalon: round2(tot.ganSalon),
          comisionBancaria: round2(tot.comisionBancaria),
        },
      };
    });
  }

  // ── Interno ─────────────────────────────────────────────────────────────────

  /**
   * Líneas de servicio del desglose. Con filas en `atencion_servicio` son
   * EXACTAS (regla congelada al cobrar); sin ellas (atenciones previas al plan)
   * se reconstruyen con la regla ACTUAL del catálogo y se marcan `aproximado`.
   */
  private async serviciosDe(tx: DrizzleTx, atencionId: string, citaId: string, snap: SnapshotAtencion): Promise<DesgloseServicio[]> {
    const exactas = await tx
      .select()
      .from(atencionServicio)
      .where(eq(atencionServicio.atencionId, atencionId));
    if (exactas.length) {
      return exactas.map((l) => ({
        nombre: l.nombre,
        precio: Number(l.precio),
        regla: { tipo: l.reglaTipo, valor: Number(l.reglaValor), origen: l.reglaOrigen },
        ganProf: Number(l.ganProf),
      }));
    }

    const viejas = await tx
      .select({ nombre: servicio.nombre, precio: citaServicio.precioAplicado, splitType: servicio.splitType, splitValor: servicio.splitValor })
      .from(citaServicio)
      .innerJoin(servicio, eq(servicio.id, citaServicio.servicioId))
      .where(eq(citaServicio.citaId, citaId));
    const pctGlobal = Number(snap.parametros?.reparticionProfesional ?? 0);
    const particion = snap.parametros?.particionPorEspecialista !== false;
    return viejas.map((l) => {
      const precio = Number(l.precio);
      const propio = Number(l.splitValor) > 0;
      const esFijo = l.splitType === 'valor_fijo';
      const valor = esFijo ? Number(l.splitValor) : propio ? Number(l.splitValor) : pctGlobal;
      const gan = esFijo ? Math.min(valor, precio) : round2((precio * valor) / 100);
      return {
        nombre: l.nombre,
        precio,
        regla: { tipo: esFijo ? 'valor_fijo' : 'porcentaje', valor, origen: esFijo || propio ? 'servicio' : 'global' },
        ganProf: particion ? gan : 0,
        aproximado: true,
      };
    });
  }
}
