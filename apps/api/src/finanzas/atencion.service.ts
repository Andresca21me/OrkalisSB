import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { EstadoCita, MetodoPago, SplitType } from '@orkalis/shared';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import { atencion, atencionPago, atencionProducto, cita, citaServicio, movimientoInventario, producto, servicio } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { ConfigResolverService } from '../config-module/config-resolver.service';
import { ModuloGate } from '../operacion/modulo-gate.service';
import { transicionar } from '../agendamiento/cita-state-machine';
import { METRICAS, MetricsService } from '../observability/metrics.service';
import {
  calcularAtencion,
  type ComisionProductoTipo,
  type ParametrosFinancieros,
  type ProductoReal,
  type ServicioReal,
} from './calculo';

export interface CompletarInput {
  /** Desglose del pago: uno o más métodos que deben sumar el total. */
  pagos: { metodo: MetodoPago; monto: number }[];
  /** Servicios reales (opcional: por defecto los ya registrados en la cita). */
  servicios?: { servicioId: string; precio?: number }[];
  /** Productos vendidos/consumidos (si inventario activo). */
  productos?: { productoId: string; cantidad: number }[];
}

/** Tolerancia de redondeo al validar que los pagos suman el total (1 peso). */
const TOLERANCIA_PAGO = 1;

/** Método dominante (mayor monto) para el campo legacy `atencion.metodo_pago`. */
function metodoDominante(pagos: { metodo: MetodoPago; monto: number }[]): MetodoPago {
  return pagos.reduce((max, p) => (p.monto > max.monto ? p : max)).metodo;
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
    private readonly gate: ModuloGate,
  ) {}

  /** Completa el turno: calcula, persiste atención + stock, transiciona. */
  async completar(ctx: TenantContext, citaId: string, input: CompletarInput): Promise<Atencion> {
    if (!input.pagos?.length) {
      throw new BadRequestException('No se puede completar sin registrar el pago.');
    }
    if (input.pagos.some((p) => !(p.monto > 0))) {
      throw new BadRequestException('Cada método de pago debe tener un monto mayor a cero.');
    }

    // Carga la cita y resuelve parámetros ANTES de abrir la transacción de cierre.
    const c = await this.cargarCita(ctx, citaId);
    if (c.estado !== EstadoCita.EnProgreso) {
      // Valida la transición (lanza claro si el estado no permite completar).
      transicionar(c.estado as EstadoCita, 'completar');
    }
    const params = await this.resolverParametros(ctx, c.sucursalId);
    // Con productos pero sin el módulo (por plan o por config apagada) se rechaza
    // en claro: ignorarlos en silencio dejaría un producto "vendido" sin registrar
    // ni cobrar (Plan-Inventario, §2.5).
    if (input.productos?.length && !params.inventarioActivo) {
      throw new BadRequestException('El módulo de inventario no está activo.');
    }
    const permitirStockNegativo = params.inventarioActivo
      ? await this.config.resolverModulo(ctx.negocioId, c.sucursalId, 'inventario.permitir_stock_negativo')
      : false;

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

      // Productos (solo si inventario activo): descuenta stock. Se guarda el costo
      // unitario actual como snapshot (margen inmune a cambios de costo, D9).
      const productosReales: ProductoReal[] = [];
      const lineasProducto: { productoId: string; cantidad: number; valor: number; costoUnitario: number }[] = [];
      if (params.inventarioActivo && input.productos?.length) {
        for (const pr of input.productos) {
          const [prod] = await tx
            .select({ cantidad: producto.cantidad, precioVenta: producto.precioVenta, costo: producto.costo })
            .from(producto)
            .where(eq(producto.id, pr.productoId))
            .limit(1);
          if (!prod) throw new NotFoundException('Producto no encontrado.');
          if (prod.cantidad < pr.cantidad && !permitirStockNegativo) {
            throw new BadRequestException('Stock insuficiente para el producto.');
          }
          const valor = Number(prod.precioVenta);
          productosReales.push({ cantidad: pr.cantidad, valor });
          lineasProducto.push({ productoId: pr.productoId, cantidad: pr.cantidad, valor, costoUnitario: Number(prod.costo) });
        }
      }

      const r = calcularAtencion(servicios, productosReales, input.pagos, params);

      // El desglose de pago debe cuadrar con el total cobrado (± redondeo).
      const sumaPagos = input.pagos.reduce((s, p) => s + p.monto, 0);
      if (Math.abs(sumaPagos - r.total) > TOLERANCIA_PAGO) {
        throw new BadRequestException(
          `La suma de los pagos (${sumaPagos.toFixed(2)}) no coincide con el total (${r.total.toFixed(2)}).`,
        );
      }

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
          comisionProductos: r.comisionProductos.toFixed(2),
          metodoPago: metodoDominante(input.pagos), // legacy: método dominante
          snapshotParam: r.snapshot,
        })
        .returning();

      // Desglose de pago (uno o varios métodos).
      await tx.insert(atencionPago).values(
        input.pagos.map((p) => ({ atencionId: at.id, metodo: p.metodo, monto: p.monto.toFixed(2) })),
      );

      // Productos: registrar (con costo y comisión snapshot), descontar stock y
      // dejar el movimiento de salida en el kardex (D5).
      for (let i = 0; i < lineasProducto.length; i++) {
        const lp = lineasProducto[i];
        await tx.insert(atencionProducto).values({
          atencionId: at.id,
          productoId: lp.productoId,
          cantidad: lp.cantidad,
          valor: lp.valor.toFixed(2),
          costoUnitario: lp.costoUnitario.toFixed(2),
          comision: (r.comisionesPorLinea[i] ?? 0).toFixed(2),
        });
        const [prodAct] = await tx
          .update(producto)
          .set({ cantidad: sqlDecrement(lp.cantidad), actualizadoEn: new Date() })
          .where(eq(producto.id, lp.productoId))
          .returning({ cantidad: producto.cantidad });
        await tx.insert(movimientoInventario).values({
          negocioId: ctx.negocioId,
          sucursalId: c.sucursalId,
          productoId: lp.productoId,
          tipoMov: 'salida',
          cantidad: lp.cantidad,
          motivo: 'Venta en cita',
          stockResultante: prodAct?.cantidad ?? null,
        });
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

  /**
   * Revierte una atención completada: deshace el cierre y reabre el turno,
   * reponiendo el stock salvo que se indique lo contrario (D8). NO se gatea por
   * módulo: debe funcionar aunque el inventario se haya apagado tras el cobro.
   *
   * `reponerStock=false` es para productos ya usados/dañados que no vuelven al
   * inventario; la salida original queda como registro fiel (no se borra su
   * movimiento de kardex).
   */
  async revertir(ctx: TenantContext, citaId: string, reponerStock = true): Promise<void> {
    const c = await this.cargarCita(ctx, citaId);
    const nuevoEstado = transicionar(c.estado as EstadoCita, 'revertir'); // valida completada→en_progreso

    await runInTenantTx(ctx, async (tx) => {
      const [at] = await tx.select({ id: atencion.id }).from(atencion).where(eq(atencion.citaId, citaId)).limit(1);
      if (!at) throw new ConflictException('No hay atención que revertir.');

      const lineas = await tx
        .select({ productoId: atencionProducto.productoId, cantidad: atencionProducto.cantidad })
        .from(atencionProducto)
        .where(eq(atencionProducto.atencionId, at.id));
      if (reponerStock) {
        for (const l of lineas) {
          const [prodAct] = await tx
            .update(producto)
            .set({ cantidad: sqlIncrement(l.cantidad), actualizadoEn: new Date() })
            .where(eq(producto.id, l.productoId))
            .returning({ cantidad: producto.cantidad });
          await tx.insert(movimientoInventario).values({
            negocioId: ctx.negocioId,
            sucursalId: c.sucursalId,
            productoId: l.productoId,
            tipoMov: 'entrada',
            cantidad: l.cantidad,
            motivo: 'Reversión de cobro',
            stockResultante: prodAct?.cantidad ?? null,
          });
        }
      }

      await tx.delete(atencionProducto).where(eq(atencionProducto.atencionId, at.id));
      await tx.delete(atencion).where(eq(atencion.id, at.id));
      await tx.update(cita).set({ estado: nuevoEstado, actualizadoEn: new Date() }).where(eq(cita.id, citaId));
    });
    this.metrics.inc(METRICAS.turnosRevertidos);
  }

  private async resolverParametros(ctx: TenantContext, sucursalId: string): Promise<ParametrosFinancieros> {
    const negocioId = ctx.negocioId;
    const [
      reparticionProfesional,
      reparticionSalon,
      deduccionAdministrativa,
      comisionBancaria,
      tarifaClienteProfesional,
      particionPorEspecialista,
      // `inventarioActivo` es plan ∧ config: si el negocio ya no tiene el módulo
      // por su plan, aunque el toggle siga encendido, NO se venden productos
      // (Plan-Inventario §1.3/D11). Antes esto miraba solo la config.
      inventarioActivo,
      comisionProductoTipoRaw,
      comisionProductoValor,
    ] = await Promise.all([
      this.config.resolverNumero(negocioId, sucursalId, 'finanzas.reparticion_profesional'),
      this.config.resolverNumero(negocioId, sucursalId, 'finanzas.reparticion_salon'),
      this.config.resolverNumero(negocioId, sucursalId, 'finanzas.deduccion_administrativa'),
      this.config.resolverNumero(negocioId, sucursalId, 'finanzas.comision_bancaria'),
      this.config.resolverNumero(negocioId, sucursalId, 'finanzas.tarifa_cliente_profesional'),
      this.config.resolverModulo(negocioId, sucursalId, 'modulo.particion_por_especialista'),
      this.gate.estaActivo(ctx, 'modulo.inventario', sucursalId),
      this.config.resolver(negocioId, sucursalId, 'finanzas.comision_producto_tipo'),
      this.config.resolverNumero(negocioId, sucursalId, 'finanzas.comision_producto_valor'),
    ]);
    return {
      reparticionProfesional,
      reparticionSalon,
      deduccionAdministrativa,
      comisionBancaria,
      tarifaClienteProfesional,
      particionPorEspecialista,
      inventarioActivo,
      comisionProductoTipo: (comisionProductoTipoRaw.valor as ComisionProductoTipo) ?? 'porcentaje',
      comisionProductoValor,
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
