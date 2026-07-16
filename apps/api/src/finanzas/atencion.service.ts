import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { EstadoCita, MetodoPago, SplitType } from '@orkalis/shared';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import { atencion, atencionProducto, cita, citaServicio, producto, servicio } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { ConfigResolverService } from '../config-module/config-resolver.service';
import { transicionar } from '../agendamiento/cita-state-machine';
import { METRICAS, MetricsService } from '../observability/metrics.service';
import {
  calcularAtencion,
  type ParametrosFinancieros,
  type ProductoReal,
  type ServicioReal,
} from './calculo';

export interface CompletarInput {
  metodoPago: MetodoPago;
  /** Servicios reales (opcional: por defecto los ya registrados en la cita). */
  servicios?: { servicioId: string; precio?: number }[];
  /** Productos vendidos/consumidos (si inventario activo). */
  productos?: { productoId: string; cantidad: number }[];
}

type Atencion = typeof atencion.$inferSelect;

/**
 * Cierre financiero del turno (FASE-09, ADR-006). Corre al completar sobre el
 * cierre REAL, persiste snapshot auditable y permite reversión transaccional.
 */
@Injectable()
export class AtencionService {
  constructor(
    private readonly config: ConfigResolverService,
    private readonly metrics: MetricsService,
  ) {}

  /** Completa el turno: calcula, persiste atención + stock, transiciona. */
  async completar(ctx: TenantContext, citaId: string, input: CompletarInput): Promise<Atencion> {
    if (!input.metodoPago) {
      throw new BadRequestException('No se puede completar sin registrar el pago.');
    }

    // Carga la cita y resuelve parámetros ANTES de abrir la transacción de cierre.
    const c = await this.cargarCita(ctx, citaId);
    if (c.estado !== EstadoCita.EnProgreso) {
      // Valida la transición (lanza claro si el estado no permite completar).
      transicionar(c.estado as EstadoCita, 'completar');
    }
    const params = await this.resolverParametros(ctx.negocioId, c.sucursalId);

    const at = await runInTenantTx(ctx, async (tx) => {
      // Idempotencia: no duplicar atención.
      const [existe] = await tx
        .select({ id: atencion.id })
        .from(atencion)
        .where(eq(atencion.citaId, citaId))
        .limit(1);
      if (existe) throw new ConflictException('El turno ya fue completado.');

      // Servicios reales: los del input (si vienen) o los ya registrados.
      const servicios = await this.resolverServiciosReales(tx, citaId, input.servicios);
      if (servicios.length === 0) {
        throw new BadRequestException('Debe registrar al menos un servicio realizado.');
      }

      // Productos (solo si inventario activo): descuenta stock.
      const productosReales: ProductoReal[] = [];
      const lineasProducto: { productoId: string; cantidad: number; valor: number }[] = [];
      if (params.inventarioActivo && input.productos?.length) {
        for (const pr of input.productos) {
          const [prod] = await tx
            .select({ cantidad: producto.cantidad, precioVenta: producto.precioVenta })
            .from(producto)
            .where(eq(producto.id, pr.productoId))
            .limit(1);
          if (!prod) throw new NotFoundException('Producto no encontrado.');
          if (prod.cantidad < pr.cantidad) {
            throw new BadRequestException('Stock insuficiente para el producto.');
          }
          const valor = Number(prod.precioVenta);
          productosReales.push({ cantidad: pr.cantidad, valor });
          lineasProducto.push({ productoId: pr.productoId, cantidad: pr.cantidad, valor });
        }
      }

      const r = calcularAtencion(servicios, productosReales, input.metodoPago, params);

      // Persistir cita_servicio finales si se enviaron servicios explícitos.
      if (input.servicios?.length) {
        await tx.delete(citaServicio).where(eq(citaServicio.citaId, citaId));
        await tx.insert(citaServicio).values(
          servicios.map((s, i) => ({
            citaId,
            servicioId: input.servicios![i].servicioId,
            precioAplicado: s.precio.toFixed(2),
          })),
        );
      }

      const [at] = await tx
        .insert(atencion)
        .values({
          negocioId: ctx.negocioId,
          sucursalId: c.sucursalId,
          citaId,
          especialistaId: c.especialistaId,
          total: r.total.toFixed(2),
          ganProf: r.ganProf.toFixed(2),
          ganSalon: r.ganSalon.toFixed(2),
          metodoPago: input.metodoPago,
          snapshotParam: r.snapshot,
        })
        .returning();

      // Productos: registrar y descontar stock.
      for (const lp of lineasProducto) {
        await tx
          .insert(atencionProducto)
          .values({ atencionId: at.id, productoId: lp.productoId, cantidad: lp.cantidad, valor: lp.valor.toFixed(2) });
        await tx
          .update(producto)
          .set({ cantidad: sqlDecrement(lp.cantidad), actualizadoEn: new Date() })
          .where(eq(producto.id, lp.productoId));
      }

      await tx
        .update(cita)
        .set({ estado: EstadoCita.Completada, actualizadoEn: new Date() })
        .where(eq(cita.id, citaId));

      return at;
    });
    this.metrics.inc(METRICAS.turnosCompletados);
    return at;
  }

  /** Revierte una atención completada: repone stock, deshace y reabre el turno. */
  async revertir(ctx: TenantContext, citaId: string): Promise<void> {
    const c = await this.cargarCita(ctx, citaId);
    const nuevoEstado = transicionar(c.estado as EstadoCita, 'revertir'); // valida completada→en_progreso

    await runInTenantTx(ctx, async (tx) => {
      const [at] = await tx.select({ id: atencion.id }).from(atencion).where(eq(atencion.citaId, citaId)).limit(1);
      if (!at) throw new ConflictException('No hay atención que revertir.');

      // Repone stock de cada producto de la atención.
      const lineas = await tx
        .select({ productoId: atencionProducto.productoId, cantidad: atencionProducto.cantidad })
        .from(atencionProducto)
        .where(eq(atencionProducto.atencionId, at.id));
      for (const l of lineas) {
        await tx
          .update(producto)
          .set({ cantidad: sqlIncrement(l.cantidad), actualizadoEn: new Date() })
          .where(eq(producto.id, l.productoId));
      }

      await tx.delete(atencionProducto).where(eq(atencionProducto.atencionId, at.id));
      await tx.delete(atencion).where(eq(atencion.id, at.id));
      await tx.update(cita).set({ estado: nuevoEstado, actualizadoEn: new Date() }).where(eq(cita.id, citaId));
    });
    this.metrics.inc(METRICAS.turnosRevertidos);
  }

  private async resolverParametros(negocioId: string, sucursalId: string): Promise<ParametrosFinancieros> {
    const [
      reparticionProfesional,
      reparticionSalon,
      deduccionAdministrativa,
      comisionBancaria,
      tarifaClienteProfesional,
      particionPorEspecialista,
      inventarioActivo,
    ] = await Promise.all([
      this.config.resolverNumero(negocioId, sucursalId, 'finanzas.reparticion_profesional'),
      this.config.resolverNumero(negocioId, sucursalId, 'finanzas.reparticion_salon'),
      this.config.resolverNumero(negocioId, sucursalId, 'finanzas.deduccion_administrativa'),
      this.config.resolverNumero(negocioId, sucursalId, 'finanzas.comision_bancaria'),
      this.config.resolverNumero(negocioId, sucursalId, 'finanzas.tarifa_cliente_profesional'),
      this.config.resolverModulo(negocioId, sucursalId, 'modulo.particion_por_especialista'),
      this.config.resolverModulo(negocioId, sucursalId, 'modulo.inventario'),
    ]);
    return {
      reparticionProfesional,
      reparticionSalon,
      deduccionAdministrativa,
      comisionBancaria,
      tarifaClienteProfesional,
      particionPorEspecialista,
      inventarioActivo,
    };
  }

  private async resolverServiciosReales(
    tx: DrizzleTx,
    citaId: string,
    override?: { servicioId: string; precio?: number }[],
  ): Promise<ServicioReal[]> {
    if (override?.length) {
      const ids = override.map((o) => o.servicioId);
      const defs = await tx
        .select({ id: servicio.id, precio: servicio.precio, splitType: servicio.splitType, splitValor: servicio.splitValor })
        .from(servicio)
        .where(inArray(servicio.id, ids));
      const byId = new Map(defs.map((d) => [d.id, d]));
      return override.map((o) => {
        const d = byId.get(o.servicioId);
        if (!d) throw new NotFoundException('Servicio no encontrado.');
        return {
          precio: o.precio ?? Number(d.precio),
          splitType: d.splitType as SplitType,
          splitValor: Number(d.splitValor),
        };
      });
    }
    const lineas = await tx
      .select({ precio: citaServicio.precioAplicado, splitType: servicio.splitType, splitValor: servicio.splitValor })
      .from(citaServicio)
      .innerJoin(servicio, eq(servicio.id, citaServicio.servicioId))
      .where(eq(citaServicio.citaId, citaId));
    return lineas.map((l) => ({
      precio: Number(l.precio),
      splitType: l.splitType as SplitType,
      splitValor: Number(l.splitValor),
    }));
  }

  private async cargarCita(ctx: TenantContext, citaId: string): Promise<typeof cita.$inferSelect> {
    const [c] = await runInTenantTx(ctx, (tx) =>
      tx.select().from(cita).where(eq(cita.id, citaId)).limit(1),
    );
    if (!c) throw new NotFoundException('Cita no encontrada.');
    return c;
  }
}

// Helpers SQL de stock (evitan leer-modificar-escribir; atómicos en la fila).
function sqlDecrement(n: number) {
  return sql`${producto.cantidad} - ${n}`;
}
function sqlIncrement(n: number) {
  return sql`${producto.cantidad} + ${n}`;
}
