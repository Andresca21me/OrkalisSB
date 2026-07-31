import { Injectable } from '@nestjs/common';
import { and, eq, gte, lte } from 'drizzle-orm';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import { atencion, especialista, liquidacion, ventaProducto } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { ModuloGate } from './modulo-gate.service';
import { round2 } from '../finanzas/calculo';

export interface LiquidacionResultado {
  especialistaId: string;
  nombre: string;
  bruto: number;
  /** Parte del bruto por servicios (invariante: servicios + productos = bruto). */
  comisionServicios: number;
  /** Parte del bruto por comisiones de venta de productos (en cita + directas). */
  comisionProductos: number;
  descuento: number;
  neto: number;
}

/** Liquidaciones por especialista (FASE-10, RF-043). Requiere partición ON. */
@Injectable()
export class LiquidacionesService {
  constructor(private readonly gate: ModuloGate) {}

  /**
   * Calcula (sin persistir) las liquidaciones de un período. Lo usan tanto
   * `preview` (solo lectura) como `generar` (persiste). Devuelve un resultado
   * por especialista con actividad. `sucursalId` opcional = consolidado (F5).
   */
  private async computar(
    tx: DrizzleTx,
    input: { desde: Date; hasta: Date; sucursalId?: string },
  ): Promise<LiquidacionResultado[]> {
    const atenciones = await tx
      .select({
        especialistaId: atencion.especialistaId,
        ganProf: atencion.ganProf,
        comisionProductos: atencion.comisionProductos,
      })
      .from(atencion)
      .where(
        and(
          input.sucursalId ? eq(atencion.sucursalId, input.sucursalId) : undefined,
          gte(atencion.creadoEn, input.desde),
          lte(atencion.creadoEn, input.hasta),
        ),
      );

    const comisiones = await tx
      .select({ especialistaId: ventaProducto.especialistaId, comision: ventaProducto.comisionProf })
      .from(ventaProducto)
      .where(
        and(
          input.sucursalId ? eq(ventaProducto.sucursalId, input.sucursalId) : undefined,
          gte(ventaProducto.creadoEn, input.desde),
          lte(ventaProducto.creadoEn, input.hasta),
        ),
      );

    // Agregación por especialista. `comisionProductos` se separa del bruto solo
    // para el desglose; el bruto es el mismo de siempre (ganProf ya la incluye, D4).
    const acc = new Map<string, { bruto: number; comisionProductos: number; descuento: number }>();
    const get = (id: string) => acc.get(id) ?? { bruto: 0, comisionProductos: 0, descuento: 0 };

    // D3 (Plan-Finanzas): la comisión bancaria la absorbe el salón EN EL COBRO
    // (`calcularAtencion` ya la restó de gan_salon, prorrateada por pagos
    // reales). Antes aquí se descontaba OTRA VEZ al especialista —recalculada
    // sobre el método "dominante"—: la misma comisión cobrada dos veces, a dos
    // actores, con dos bases. El descuento queda en 0; la columna se conserva
    // por compatibilidad del contrato.
    for (const a of atenciones) {
      const cur = get(a.especialistaId);
      cur.bruto += Number(a.ganProf);
      cur.comisionProductos += Number(a.comisionProductos);
      acc.set(a.especialistaId, cur);
    }
    for (const c of comisiones) {
      if (!c.especialistaId) continue;
      const cur = get(c.especialistaId);
      cur.bruto += Number(c.comision);
      cur.comisionProductos += Number(c.comision);
      acc.set(c.especialistaId, cur);
    }

    const nombres = new Map(
      (await tx.select({ id: especialista.id, nombre: especialista.nombre }).from(especialista)).map((e) => [
        e.id,
        e.nombre,
      ]),
    );

    const resultados: LiquidacionResultado[] = [];
    for (const [especialistaId, v] of acc) {
      const bruto = round2(v.bruto);
      const comisionProductos = round2(v.comisionProductos);
      const descuento = round2(v.descuento);
      resultados.push({
        especialistaId,
        nombre: nombres.get(especialistaId) ?? '—',
        bruto,
        comisionProductos,
        comisionServicios: round2(bruto - comisionProductos),
        descuento,
        neto: round2(bruto - descuento),
      });
    }
    return resultados.sort((a, b) => b.neto - a.neto);
  }

  /** Vista previa de liquidación (solo lectura, no persiste). FASE-07. */
  async preview(
    ctx: TenantContext,
    input: { desde: Date; hasta: Date; sucursalId?: string },
  ): Promise<LiquidacionResultado[]> {
    await this.gate.assertActivo(ctx, 'modulo.particion_por_especialista');
    return runInTenantTx(ctx, (tx) => this.computar(tx, input));
  }

  async generar(
    ctx: TenantContext,
    input: { periodo: string; desde: Date; hasta: Date; sucursalId: string },
  ): Promise<LiquidacionResultado[]> {
    await this.gate.assertActivo(ctx, 'modulo.particion_por_especialista');

    return runInTenantTx(ctx, async (tx) => {
      const resultados = await this.computar(tx, input);
      for (const r of resultados) {
        await tx.insert(liquidacion).values({
          negocioId: ctx.negocioId,
          sucursalId: input.sucursalId,
          especialistaId: r.especialistaId,
          periodo: input.periodo,
          // Rango real + desglose persistidos (F5): antes se perdían al guardar.
          desde: input.desde,
          hasta: input.hasta,
          comisionServicios: r.comisionServicios.toFixed(2),
          comisionProductos: r.comisionProductos.toFixed(2),
          bruto: r.bruto.toFixed(2),
          descuento: r.descuento.toFixed(2),
          neto: r.neto.toFixed(2),
        });
      }
      return resultados;
    });
  }

  /** Exportación CSV (UTF-8 con BOM, RF-045). La generación pesada/PDF: FASE-11. */
  exportarCsv(resultados: LiquidacionResultado[]): string {
    const filas = [
      'especialista,bruto,comision_servicios,comision_productos,descuento,neto',
      ...resultados.map(
        (r) => `"${r.nombre}",${r.bruto},${r.comisionServicios},${r.comisionProductos},${r.descuento},${r.neto}`,
      ),
    ];
    return '﻿' + filas.join('\n') + '\n';
  }
}
