import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import type { MovimientoInventarioItem, HistorialVentasResp, VentaProductoHistorial } from '@orkalis/shared';
import { TipoGasto, TipoProducto } from '@orkalis/shared';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import {
  atencion,
  atencionProducto,
  cita,
  cliente,
  especialista,
  gasto,
  movimientoInventario,
  producto,
  ventaProducto,
} from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { diaBogota } from './gastos.calculo';
import { ConfigResolverService } from '../config-module/config-resolver.service';
import { comisionProducto, round2, type ComisionProductoTipo } from '../finanzas/calculo';
import { ModuloGate } from './modulo-gate.service';

type Producto = typeof producto.$inferSelect;
type TipoMov = 'entrada' | 'salida' | 'ajuste';

/** Inventario — módulo OPCIONAL (FASE-10, RF-037/RF-038/RF-039). */
@Injectable()
export class InventarioService {
  constructor(
    private readonly gate: ModuloGate,
    private readonly config: ConfigResolverService,
  ) {}

  private async assert(ctx: TenantContext): Promise<void> {
    await this.gate.assertActivo(ctx, 'modulo.inventario');
  }

  /** ¿Este negocio/sucursal permite dejar el stock en negativo al vender? (D7) */
  private permitirStockNegativo(ctx: TenantContext, sucursalId: string): Promise<boolean> {
    return this.config.resolverModulo(ctx.negocioId, sucursalId, 'inventario.permitir_stock_negativo');
  }

  /** Comisión por venta de producto configurada para este negocio/sucursal (D2). */
  private async comisionConfig(
    ctx: TenantContext,
    sucursalId: string,
  ): Promise<{ tipo: ComisionProductoTipo; valor: number }> {
    const [tipo, valor] = await Promise.all([
      this.config.resolver(ctx.negocioId, sucursalId, 'finanzas.comision_producto_tipo'),
      this.config.resolverNumero(ctx.negocioId, sucursalId, 'finanzas.comision_producto_valor'),
    ]);
    return { tipo: (tipo.valor as ComisionProductoTipo) ?? 'porcentaje', valor };
  }

  async listar(ctx: TenantContext, sucursalId?: string): Promise<Producto[]> {
    await this.assert(ctx);
    return runInTenantTx(ctx, (tx) =>
      tx
        .select()
        .from(producto)
        .where(and(eq(producto.activo, true), sucursalId ? eq(producto.sucursalId, sucursalId) : undefined)),
    );
  }

  async crear(
    ctx: TenantContext,
    input: {
      sucursalId: string;
      nombre: string;
      tipo: TipoProducto;
      cantidad?: number;
      stockMin?: number;
      costo?: number;
      precioVenta?: number;
      generaGasto?: boolean;
    },
  ): Promise<Producto> {
    await this.assert(ctx);
    const cantidad = input.cantidad ?? 0;
    const costo = input.costo ?? 0;
    return runInTenantTx(ctx, async (tx) => {
      const [p] = await tx
        .insert(producto)
        .values({
          negocioId: ctx.negocioId,
          sucursalId: input.sucursalId,
          nombre: input.nombre,
          tipo: input.tipo,
          cantidad,
          stockMin: input.stockMin ?? 0,
          costo: costo.toFixed(2),
          precioVenta: (input.precioVenta ?? 0).toFixed(2),
        })
        .returning();

      // Stock inicial: deja traza (movimiento) y, si se pidió, el egreso de la
      // compra inicial. Sin esto el stock aparecería de la nada, sin costo ni gasto.
      if (cantidad > 0) {
        const costoTotal = round2(cantidad * costo);
        let gastoId: string | undefined;
        const generaGasto = input.generaGasto ?? true;
        if (generaGasto && costoTotal > 0) {
          const [g] = await tx
            .insert(gasto)
            .values({
              negocioId: ctx.negocioId,
              sucursalId: input.sucursalId,
              tipo: TipoGasto.Variable,
              categoria: 'Compra de inventario',
              monto: costoTotal.toFixed(2),
              fecha: diaBogota(new Date()),
            })
            .returning({ id: gasto.id });
          gastoId = g.id;
        }
        await tx.insert(movimientoInventario).values({
          negocioId: ctx.negocioId,
          sucursalId: input.sucursalId,
          productoId: p.id,
          tipoMov: 'entrada',
          cantidad,
          motivo: 'Stock inicial',
          gastoId,
          costoTotal: costoTotal > 0 ? costoTotal.toFixed(2) : null,
          stockResultante: cantidad,
        });
      }
      return p;
    });
  }

  /** Edición de la ficha del producto (no toca stock; eso va por movimientos). */
  async editar(
    ctx: TenantContext,
    id: string,
    cambios: { nombre?: string; tipo?: TipoProducto; stockMin?: number; costo?: number; precioVenta?: number },
  ): Promise<Producto> {
    await this.assert(ctx);
    const set: Record<string, unknown> = { actualizadoEn: new Date() };
    if (cambios.nombre !== undefined) set.nombre = cambios.nombre;
    if (cambios.tipo !== undefined) set.tipo = cambios.tipo;
    if (cambios.stockMin !== undefined) set.stockMin = cambios.stockMin;
    if (cambios.costo !== undefined) set.costo = cambios.costo.toFixed(2);
    if (cambios.precioVenta !== undefined) set.precioVenta = cambios.precioVenta.toFixed(2);
    const [p] = await runInTenantTx(ctx, (tx) =>
      tx.update(producto).set(set).where(eq(producto.id, id)).returning(),
    );
    if (!p) throw new NotFoundException('Producto no encontrado.');
    return p;
  }

  /** Borrado lógico del producto (conserva movimientos ya registrados). */
  async desactivar(ctx: TenantContext, id: string): Promise<void> {
    await this.assert(ctx);
    const [p] = await runInTenantTx(ctx, (tx) =>
      tx.update(producto).set({ activo: false, actualizadoEn: new Date() }).where(eq(producto.id, id)).returning(),
    );
    if (!p) throw new NotFoundException('Producto no encontrado.');
  }

  /**
   * Movimiento de inventario. `entrada`/`salida` ajustan delta; `ajuste` fija el
   * stock absoluto. Una entrada por compra puede generar un gasto variable (RF-038).
   */
  async movimiento(
    ctx: TenantContext,
    input: {
      productoId: string;
      tipoMov: TipoMov;
      cantidad: number;
      motivo?: string;
      generaGasto?: boolean;
      costoTotal?: number;
    },
  ): Promise<{ stock: number; gastoId?: string }> {
    await this.assert(ctx);
    const permitirNegativo = await this.permitirStockNegativoDeProducto(ctx, input.productoId);
    return runInTenantTx(ctx, async (tx) => {
      const [prod] = await tx
        .select({ cantidad: producto.cantidad, sucursalId: producto.sucursalId, costo: producto.costo })
        .from(producto)
        .where(eq(producto.id, input.productoId))
        .limit(1);
      if (!prod) throw new NotFoundException('Producto no encontrado.');

      let nuevoStock: number;
      if (input.tipoMov === 'entrada') nuevoStock = prod.cantidad + input.cantidad;
      else if (input.tipoMov === 'salida') nuevoStock = prod.cantidad - input.cantidad;
      else nuevoStock = input.cantidad; // ajuste = stock absoluto
      // Solo la salida manual puede quedar negativa (y solo si el negocio lo
      // permite); ajuste y entrada nunca deberían producir negativos.
      if (nuevoStock < 0 && !(input.tipoMov === 'salida' && permitirNegativo)) {
        throw new BadRequestException('El stock no puede quedar negativo.');
      }

      // Costo promedio ponderado (D1): solo en entradas con costo real declarado.
      // Salidas, ajustes y entradas sin costo NO tocan el costo del producto.
      const set: Record<string, unknown> = { cantidad: nuevoStock, actualizadoEn: new Date() };
      if (input.tipoMov === 'entrada' && input.costoTotal && input.costoTotal > 0) {
        const stockPrevio = Math.max(0, prod.cantidad);
        const valorPrevio = stockPrevio * Number(prod.costo);
        const nuevoCosto = round2((valorPrevio + input.costoTotal) / (stockPrevio + input.cantidad));
        set.costo = nuevoCosto.toFixed(2);
      }

      // Gasto variable por compra (entrada).
      let gastoId: string | undefined;
      if (input.tipoMov === 'entrada' && input.generaGasto && input.costoTotal) {
        const [g] = await tx
          .insert(gasto)
          .values({
            negocioId: ctx.negocioId,
            sucursalId: prod.sucursalId,
            tipo: TipoGasto.Variable,
            categoria: 'Compra de inventario',
            monto: input.costoTotal.toFixed(2),
            fecha: diaBogota(new Date()),
          })
          .returning({ id: gasto.id });
        gastoId = g.id;
      }

      await tx.update(producto).set(set).where(eq(producto.id, input.productoId));

      await tx.insert(movimientoInventario).values({
        negocioId: ctx.negocioId,
        sucursalId: prod.sucursalId,
        productoId: input.productoId,
        tipoMov: input.tipoMov,
        cantidad: input.cantidad,
        motivo: input.motivo,
        gastoId,
        costoTotal: input.costoTotal && input.costoTotal > 0 ? input.costoTotal.toFixed(2) : null,
        stockResultante: nuevoStock,
      });

      return { stock: nuevoStock, gastoId };
    });
  }

  /** Resuelve el flag de stock negativo leyendo la sucursal del producto. */
  private async permitirStockNegativoDeProducto(ctx: TenantContext, productoId: string): Promise<boolean> {
    const [prod] = await runInTenantTx(ctx, (tx) =>
      tx.select({ sucursalId: producto.sucursalId }).from(producto).where(eq(producto.id, productoId)).limit(1),
    );
    if (!prod) return false;
    return this.permitirStockNegativo(ctx, prod.sucursalId);
  }

  /** Alertas de stock bajo: `cantidad < stock_min` (HU-ADM-007). */
  async alertasStockBajo(ctx: TenantContext, sucursalId?: string): Promise<Producto[]> {
    await this.assert(ctx);
    return runInTenantTx(ctx, (tx) =>
      tx
        .select()
        .from(producto)
        .where(
          and(
            eq(producto.activo, true),
            lt(producto.cantidad, producto.stockMin),
            sucursalId ? eq(producto.sucursalId, sucursalId) : undefined,
          ),
        ),
    );
  }

  /** Valoración del inventario: Σ cantidad × costo. */
  async valoracion(ctx: TenantContext, sucursalId?: string): Promise<number> {
    await this.assert(ctx);
    const [{ valor }] = await runInTenantTx(ctx, (tx) =>
      tx
        .select({ valor: sql<number>`coalesce(sum(${producto.cantidad} * ${producto.costo}), 0)`.mapWith(Number) })
        .from(producto)
        .where(and(eq(producto.activo, true), sucursalId ? eq(producto.sucursalId, sucursalId) : undefined)),
    );
    return valor ?? 0;
  }

  /**
   * Venta suelta de producto (RF-039): descuenta stock y acredita la comisión del
   * especialista, que se calcula SIEMPRE en el servidor con la configuración del
   * negocio (D2) — nunca llega del cliente. Congela el costo unitario para el margen.
   */
  async vender(
    ctx: TenantContext,
    input: { productoId: string; cantidad: number; especialistaId?: string },
  ): Promise<{ ventaId: string; total: number; comision: number }> {
    await this.assert(ctx);
    // Resolución de config fuera de la transacción (lectura cacheada).
    const sucursalId = await this.sucursalDeProducto(ctx, input.productoId);
    const permitirNegativo = await this.permitirStockNegativo(ctx, sucursalId);
    const com = input.especialistaId ? await this.comisionConfig(ctx, sucursalId) : null;

    return runInTenantTx(ctx, async (tx) => {
      const [prod] = await tx
        .select({
          cantidad: producto.cantidad,
          precioVenta: producto.precioVenta,
          costo: producto.costo,
          sucursalId: producto.sucursalId,
        })
        .from(producto)
        .where(eq(producto.id, input.productoId))
        .limit(1);
      if (!prod) throw new NotFoundException('Producto no encontrado.');
      if (prod.cantidad < input.cantidad && !permitirNegativo) {
        throw new BadRequestException('Stock insuficiente.');
      }

      const valorUnit = Number(prod.precioVenta);
      const total = round2(valorUnit * input.cantidad);
      const comision = com ? comisionProducto(input.cantidad, valorUnit, com.tipo, com.valor) : 0;
      const nuevoStock = prod.cantidad - input.cantidad;

      await tx
        .update(producto)
        .set({ cantidad: nuevoStock, actualizadoEn: new Date() })
        .where(eq(producto.id, input.productoId));

      const [v] = await tx
        .insert(ventaProducto)
        .values({
          negocioId: ctx.negocioId,
          sucursalId: prod.sucursalId,
          especialistaId: input.especialistaId ?? null,
          productoId: input.productoId,
          cantidad: input.cantidad,
          total: total.toFixed(2),
          comisionProf: comision.toFixed(2),
          costoUnitario: Number(prod.costo).toFixed(2),
        })
        .returning({ id: ventaProducto.id });

      await tx.insert(movimientoInventario).values({
        negocioId: ctx.negocioId,
        sucursalId: prod.sucursalId,
        productoId: input.productoId,
        tipoMov: 'salida',
        cantidad: input.cantidad,
        motivo: 'Venta de producto',
        stockResultante: nuevoStock,
      });

      return { ventaId: v.id, total, comision };
    });
  }

  private async sucursalDeProducto(ctx: TenantContext, productoId: string): Promise<string> {
    const [prod] = await runInTenantTx(ctx, (tx) =>
      tx.select({ sucursalId: producto.sucursalId }).from(producto).where(eq(producto.id, productoId)).limit(1),
    );
    if (!prod) throw new NotFoundException('Producto no encontrado.');
    return prod.sucursalId;
  }

  /** Kardex: movimientos de stock con filtros (D5). Lo más nuevo primero. */
  async listarMovimientos(
    ctx: TenantContext,
    filtros: { sucursalId?: string; productoId?: string; tipo?: TipoMov; desde?: Date; hasta?: Date },
  ): Promise<{ items: MovimientoInventarioItem[] }> {
    await this.assert(ctx);
    const items = await runInTenantTx(ctx, (tx) =>
      tx
        .select({
          id: movimientoInventario.id,
          productoId: movimientoInventario.productoId,
          productoNombre: producto.nombre,
          tipoMov: movimientoInventario.tipoMov,
          cantidad: movimientoInventario.cantidad,
          motivo: movimientoInventario.motivo,
          costoTotal: movimientoInventario.costoTotal,
          stockResultante: movimientoInventario.stockResultante,
          gastoId: movimientoInventario.gastoId,
          creadoEn: movimientoInventario.creadoEn,
        })
        .from(movimientoInventario)
        .innerJoin(producto, eq(producto.id, movimientoInventario.productoId))
        .where(
          and(
            filtros.sucursalId ? eq(movimientoInventario.sucursalId, filtros.sucursalId) : undefined,
            filtros.productoId ? eq(movimientoInventario.productoId, filtros.productoId) : undefined,
            filtros.tipo ? eq(movimientoInventario.tipoMov, filtros.tipo) : undefined,
            filtros.desde ? gte(movimientoInventario.creadoEn, filtros.desde) : undefined,
            filtros.hasta ? lte(movimientoInventario.creadoEn, filtros.hasta) : undefined,
          ),
        )
        .orderBy(desc(movimientoInventario.creadoEn))
        .limit(500),
    );
    return {
      items: items.map((m) => ({
        id: m.id,
        productoId: m.productoId,
        productoNombre: m.productoNombre,
        tipoMov: m.tipoMov as TipoMov,
        cantidad: m.cantidad,
        motivo: m.motivo,
        costoTotal: m.costoTotal,
        stockResultante: m.stockResultante,
        gastoId: m.gastoId,
        creadoEn: m.creadoEn.toISOString(),
      })),
    };
  }

  /**
   * Historial de ventas de producto (D6). Une DOS fuentes sin fusionarlas en base
   * (fusionarlas duplicaría ingresos en los reportes): la venta directa de
   * mostrador (`venta_producto`) y la venta dentro de una cita (`atencion_producto`,
   * ya contenida en `atencion.total`). Cada fila lleva su `origen`.
   */
  async listarVentas(
    ctx: TenantContext,
    filtros: {
      sucursalId?: string;
      desde?: Date;
      hasta?: Date;
      especialistaId?: string;
      productoId?: string;
      clienteId?: string;
      origen?: 'cita' | 'directa';
    },
  ): Promise<HistorialVentasResp> {
    await this.assert(ctx);
    return runInTenantTx(ctx, async (tx) => {
      const directas =
        filtros.origen === 'cita' ? [] : await this.ventasDirectas(tx, filtros);
      const enCita =
        filtros.origen === 'directa' ? [] : await this.ventasEnCita(tx, filtros);
      const items = [...directas, ...enCita].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      const totales = items.reduce(
        (acc, it) => ({
          total: round2(acc.total + it.total),
          comision: round2(acc.comision + it.comision),
          costo: round2(acc.costo + it.costoUnitario * it.cantidad),
          margen: round2(acc.margen + it.margen),
          unidades: acc.unidades + it.cantidad,
        }),
        { total: 0, comision: 0, costo: 0, margen: 0, unidades: 0 },
      );
      return { items, totales };
    });
  }

  private async ventasDirectas(
    tx: DrizzleTx,
    filtros: { sucursalId?: string; desde?: Date; hasta?: Date; especialistaId?: string; productoId?: string },
  ): Promise<VentaProductoHistorial[]> {
    const filas = await tx
      .select({
        id: ventaProducto.id,
        fecha: ventaProducto.creadoEn,
        especialistaId: ventaProducto.especialistaId,
        especialistaNombre: especialista.nombre,
        productoId: ventaProducto.productoId,
        productoNombre: producto.nombre,
        cantidad: ventaProducto.cantidad,
        total: ventaProducto.total,
        comision: ventaProducto.comisionProf,
        costoUnitario: ventaProducto.costoUnitario,
      })
      .from(ventaProducto)
      .innerJoin(producto, eq(producto.id, ventaProducto.productoId))
      .leftJoin(especialista, eq(especialista.id, ventaProducto.especialistaId))
      .where(
        and(
          filtros.sucursalId ? eq(ventaProducto.sucursalId, filtros.sucursalId) : undefined,
          filtros.especialistaId ? eq(ventaProducto.especialistaId, filtros.especialistaId) : undefined,
          filtros.productoId ? eq(ventaProducto.productoId, filtros.productoId) : undefined,
          filtros.desde ? gte(ventaProducto.creadoEn, filtros.desde) : undefined,
          filtros.hasta ? lte(ventaProducto.creadoEn, filtros.hasta) : undefined,
        ),
      )
      .orderBy(desc(ventaProducto.creadoEn))
      .limit(500);
    return filas.map((f) => {
      const cantidad = f.cantidad;
      const total = Number(f.total);
      const costoUnitario = Number(f.costoUnitario);
      return {
        id: f.id,
        fecha: f.fecha.toISOString(),
        origen: 'directa' as const,
        citaId: null,
        atencionId: null,
        clienteNombre: null,
        especialistaId: f.especialistaId,
        especialistaNombre: f.especialistaNombre,
        productoId: f.productoId,
        productoNombre: f.productoNombre,
        cantidad,
        precioUnitario: cantidad ? round2(total / cantidad) : 0,
        total,
        comision: Number(f.comision),
        costoUnitario,
        margen: round2(total - costoUnitario * cantidad),
      };
    });
  }

  private async ventasEnCita(
    tx: DrizzleTx,
    filtros: {
      sucursalId?: string;
      desde?: Date;
      hasta?: Date;
      especialistaId?: string;
      productoId?: string;
      clienteId?: string;
    },
  ): Promise<VentaProductoHistorial[]> {
    const filas = await tx
      .select({
        id: atencionProducto.id,
        atencionId: atencionProducto.atencionId,
        citaId: atencion.citaId,
        fecha: atencion.creadoEn,
        clienteNombre: cliente.nombre,
        especialistaId: atencion.especialistaId,
        especialistaNombre: especialista.nombre,
        productoId: atencionProducto.productoId,
        productoNombre: producto.nombre,
        cantidad: atencionProducto.cantidad,
        valor: atencionProducto.valor,
        comision: atencionProducto.comision,
        costoUnitario: atencionProducto.costoUnitario,
      })
      .from(atencionProducto)
      .innerJoin(atencion, eq(atencion.id, atencionProducto.atencionId))
      .innerJoin(producto, eq(producto.id, atencionProducto.productoId))
      .leftJoin(especialista, eq(especialista.id, atencion.especialistaId))
      .leftJoin(cita, eq(cita.id, atencion.citaId))
      .leftJoin(cliente, eq(cliente.id, cita.clienteId))
      .where(
        and(
          filtros.sucursalId ? eq(atencion.sucursalId, filtros.sucursalId) : undefined,
          filtros.especialistaId ? eq(atencion.especialistaId, filtros.especialistaId) : undefined,
          filtros.productoId ? eq(atencionProducto.productoId, filtros.productoId) : undefined,
          filtros.clienteId ? eq(cita.clienteId, filtros.clienteId) : undefined,
          filtros.desde ? gte(atencion.creadoEn, filtros.desde) : undefined,
          filtros.hasta ? lte(atencion.creadoEn, filtros.hasta) : undefined,
        ),
      )
      .orderBy(desc(atencion.creadoEn))
      .limit(500);
    return filas.map((f) => {
      const cantidad = f.cantidad;
      const precioUnitario = Number(f.valor);
      const total = round2(precioUnitario * cantidad);
      const costoUnitario = Number(f.costoUnitario);
      return {
        id: f.id,
        fecha: f.fecha.toISOString(),
        origen: 'cita' as const,
        citaId: f.citaId,
        atencionId: f.atencionId,
        clienteNombre: f.clienteNombre,
        especialistaId: f.especialistaId,
        especialistaNombre: f.especialistaNombre,
        productoId: f.productoId,
        productoNombre: f.productoNombre,
        cantidad,
        precioUnitario,
        total,
        comision: Number(f.comision),
        costoUnitario,
        margen: round2(total - costoUnitario * cantidad),
      };
    });
  }
}
