import { Injectable } from '@nestjs/common';
import { and, eq, gte, lte } from 'drizzle-orm';
import { MetodoPago } from '@orkalis/shared';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import { atencion, especialista, liquidacion, ventaProducto } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { ModuloGate } from './modulo-gate.service';
import { round2 } from '../finanzas/calculo';

const ELECTRONICOS: ReadonlySet<string> = new Set([
  MetodoPago.Tarjeta,
  MetodoPago.Transferencia,
  MetodoPago.Nequi,
]);

export interface LiquidacionResultado {
  especialistaId: string;
  nombre: string;
  bruto: number;
  descuento: number;
  neto: number;
}

/** Liquidaciones por especialista (FASE-10, RF-043). Requiere partición ON. */
@Injectable()
export class LiquidacionesService {
  constructor(private readonly gate: ModuloGate) {}

  /**
   * Genera y persiste las liquidaciones de un período para una sucursal.
   * bruto = Σ gan_prof + Σ comisiones de venta; descuento = retención por pago
   * electrónico (según la comisión del snapshot); neto = bruto − descuento.
   */
  /**
   * Calcula (sin persistir) las liquidaciones de un período/sucursal. Lo usan
   * tanto `preview` (solo lectura) como `generar` (persiste). Devuelve un
   * resultado por especialista con actividad.
   */
  private async computar(
    tx: DrizzleTx,
    input: { desde: Date; hasta: Date; sucursalId: string },
  ): Promise<LiquidacionResultado[]> {
    const atenciones = await tx
      .select({
        especialistaId: atencion.especialistaId,
        ganProf: atencion.ganProf,
        metodoPago: atencion.metodoPago,
        snapshot: atencion.snapshotParam,
      })
      .from(atencion)
      .where(
        and(
          eq(atencion.sucursalId, input.sucursalId),
          gte(atencion.creadoEn, input.desde),
          lte(atencion.creadoEn, input.hasta),
        ),
      );

    const comisiones = await tx
      .select({ especialistaId: ventaProducto.especialistaId, comision: ventaProducto.comisionProf })
      .from(ventaProducto)
      .where(
        and(
          eq(ventaProducto.sucursalId, input.sucursalId),
          gte(ventaProducto.creadoEn, input.desde),
          lte(ventaProducto.creadoEn, input.hasta),
        ),
      );

    // Agregación por especialista.
    const acc = new Map<string, { bruto: number; descuento: number }>();
    const get = (id: string) => acc.get(id) ?? { bruto: 0, descuento: 0 };

    for (const a of atenciones) {
      const ganProf = Number(a.ganProf);
      const cur = get(a.especialistaId);
      cur.bruto += ganProf;
      if (ELECTRONICOS.has(a.metodoPago)) {
        const comisionPct = Number(
          (a.snapshot as { parametros?: { comisionBancaria?: number } })?.parametros?.comisionBancaria ?? 0,
        );
        cur.descuento += round2((ganProf * comisionPct) / 100);
      }
      acc.set(a.especialistaId, cur);
    }
    for (const c of comisiones) {
      if (!c.especialistaId) continue;
      const cur = get(c.especialistaId);
      cur.bruto += Number(c.comision);
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
      const descuento = round2(v.descuento);
      resultados.push({
        especialistaId,
        nombre: nombres.get(especialistaId) ?? '—',
        bruto,
        descuento,
        neto: round2(bruto - descuento),
      });
    }
    return resultados.sort((a, b) => b.neto - a.neto);
  }

  /** Vista previa de liquidación (solo lectura, no persiste). FASE-07. */
  async preview(
    ctx: TenantContext,
    input: { desde: Date; hasta: Date; sucursalId: string },
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
      'especialista,bruto,descuento,neto',
      ...resultados.map((r) => `"${r.nombre}",${r.bruto},${r.descuento},${r.neto}`),
    ];
    return '﻿' + filas.join('\n') + '\n';
  }
}
