import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, lt, sql } from 'drizzle-orm';
import { TipoGasto, TipoProducto } from '@orkalis/shared';
import { runInTenantTx } from '../db/tx';
import { gasto, movimientoInventario, producto, ventaProducto } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { ModuloGate } from './modulo-gate.service';

type Producto = typeof producto.$inferSelect;
type TipoMov = 'entrada' | 'salida' | 'ajuste';

/** Inventario — módulo OPCIONAL (FASE-10, RF-037/RF-038/RF-039). */
@Injectable()
export class InventarioService {
  constructor(private readonly gate: ModuloGate) {}

  private async assert(ctx: TenantContext): Promise<void> {
    await this.gate.assertActivo(ctx, 'modulo.inventario');
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
    input: { sucursalId: string; nombre: string; tipo: TipoProducto; cantidad?: number; stockMin?: number; costo?: number; precioVenta?: number },
  ): Promise<Producto> {
    await this.assert(ctx);
    return runInTenantTx(ctx, async (tx) => {
      const [p] = await tx
        .insert(producto)
        .values({
          negocioId: ctx.negocioId,
          sucursalId: input.sucursalId,
          nombre: input.nombre,
          tipo: input.tipo,
          cantidad: input.cantidad ?? 0,
          stockMin: input.stockMin ?? 0,
          costo: (input.costo ?? 0).toFixed(2),
          precioVenta: (input.precioVenta ?? 0).toFixed(2),
        })
        .returning();
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
    return runInTenantTx(ctx, async (tx) => {
      const [prod] = await tx
        .select({ cantidad: producto.cantidad, sucursalId: producto.sucursalId })
        .from(producto)
        .where(eq(producto.id, input.productoId))
        .limit(1);
      if (!prod) throw new NotFoundException('Producto no encontrado.');

      let nuevoStock: number;
      if (input.tipoMov === 'entrada') nuevoStock = prod.cantidad + input.cantidad;
      else if (input.tipoMov === 'salida') nuevoStock = prod.cantidad - input.cantidad;
      else nuevoStock = input.cantidad; // ajuste = stock absoluto
      if (nuevoStock < 0) throw new BadRequestException('El stock no puede quedar negativo.');

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
          })
          .returning({ id: gasto.id });
        gastoId = g.id;
      }

      await tx
        .update(producto)
        .set({ cantidad: nuevoStock, actualizadoEn: new Date() })
        .where(eq(producto.id, input.productoId));

      await tx.insert(movimientoInventario).values({
        negocioId: ctx.negocioId,
        sucursalId: prod.sucursalId,
        productoId: input.productoId,
        tipoMov: input.tipoMov,
        cantidad: input.cantidad,
        motivo: input.motivo,
        gastoId,
      });

      return { stock: nuevoStock, gastoId };
    });
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

  /** Venta suelta de producto (RF-039): descuenta stock + comisión al profesional. */
  async vender(
    ctx: TenantContext,
    input: { productoId: string; cantidad: number; especialistaId?: string; comisionProf?: number },
  ): Promise<{ ventaId: string; total: number }> {
    await this.assert(ctx);
    return runInTenantTx(ctx, async (tx) => {
      const [prod] = await tx
        .select({ cantidad: producto.cantidad, precioVenta: producto.precioVenta, sucursalId: producto.sucursalId })
        .from(producto)
        .where(eq(producto.id, input.productoId))
        .limit(1);
      if (!prod) throw new NotFoundException('Producto no encontrado.');
      if (prod.cantidad < input.cantidad) throw new BadRequestException('Stock insuficiente.');

      const total = Number(prod.precioVenta) * input.cantidad;
      await tx
        .update(producto)
        .set({ cantidad: prod.cantidad - input.cantidad, actualizadoEn: new Date() })
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
          comisionProf: (input.comisionProf ?? 0).toFixed(2),
        })
        .returning({ id: ventaProducto.id });

      await tx.insert(movimientoInventario).values({
        negocioId: ctx.negocioId,
        sucursalId: prod.sucursalId,
        productoId: input.productoId,
        tipoMov: 'salida',
        cantidad: input.cantidad,
        motivo: 'Venta de producto',
      });

      return { ventaId: v.id, total };
    });
  }
}
