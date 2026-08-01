import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { TipoGasto, type GastosDetalle } from '@orkalis/shared';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import { gasto } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { diaBogota, diaFinPeriodo, ocurrenciasEnPeriodo, totalesDeOcurrencias, type OcurrenciaGasto } from './gastos.calculo';

type Gasto = typeof gasto.$inferSelect;

/**
 * Consulta los gastos que PUEDEN tener ocurrencias en [desde, hasta] y los
 * expande (Plan-Gastos). Compartida entre el detalle de la pestaña Gastos y
 * los reportes financieros — una sola semántica, imposible que diverjan.
 */
export async function ocurrenciasDelPeriodo(
  tx: DrizzleTx,
  desde: Date,
  hasta: Date,
  sucursalId?: string,
): Promise<OcurrenciaGasto[]> {
  const d1 = diaBogota(desde);
  const d2 = diaFinPeriodo(hasta);
  const filas = await tx
    .select()
    .from(gasto)
    .where(
      and(
        sucursalId ? eq(gasto.sucursalId, sucursalId) : undefined,
        or(
          // Fijos: recurren desde su registro; los desactivados conservan lo cobrado.
          and(eq(gasto.tipo, TipoGasto.Fijo), lte(gasto.creadoEn, hasta)),
          // Variables: puntuales por su fecha (las antiguas sin fecha, por creación).
          and(
            eq(gasto.tipo, TipoGasto.Variable),
            eq(gasto.activo, true),
            or(
              and(gte(gasto.fecha, d1), lte(gasto.fecha, d2)),
              and(isNull(gasto.fecha), gte(gasto.creadoEn, desde), lte(gasto.creadoEn, hasta)),
            ),
          ),
        ),
      ),
    );
  return ocurrenciasEnPeriodo(filas, desde, hasta);
}

/** Gastos fijos/variables (FASE-10, RF-040). Eliminar = inactivar (no toca históricos). */
@Injectable()
export class GastosService {
  listar(ctx: TenantContext, sucursalId?: string): Promise<Gasto[]> {
    return runInTenantTx(ctx, (tx) =>
      tx
        .select()
        .from(gasto)
        .where(and(eq(gasto.activo, true), sucursalId ? eq(gasto.sucursalId, sucursalId) : undefined)),
    );
  }

  /** Desglose del período: cada ocurrencia (qué, cuándo, cuánto) + totales. */
  detalle(ctx: TenantContext, desde: Date, hasta: Date, sucursalId?: string): Promise<GastosDetalle> {
    return runInTenantTx(ctx, async (tx) => {
      const filas = await ocurrenciasDelPeriodo(tx, desde, hasta, sucursalId);
      const t = totalesDeOcurrencias(filas);
      return { filas, totalFijos: t.fijos, totalVariables: t.variables, total: t.total };
    });
  }

  async crear(
    ctx: TenantContext,
    input: {
      sucursalId: string;
      tipo: TipoGasto;
      categoria?: string;
      monto: number;
      frecuencia?: string;
      /** Variables: día (Bogotá) del gasto. Default: hoy. */
      fecha?: string;
      /** Fijos: día del mes en que se cobra. Default: el día de hoy. */
      diaCobro?: number;
    },
  ): Promise<Gasto> {
    if (input.tipo === TipoGasto.Fijo && input.fecha) {
      throw new BadRequestException('Un gasto fijo no lleva fecha puntual: indica el día de cobro del mes.');
    }
    if (input.tipo === TipoGasto.Variable && input.diaCobro != null) {
      throw new BadRequestException('Un gasto variable no lleva día de cobro: indica la fecha del gasto.');
    }
    const hoy = diaBogota(new Date());
    return runInTenantTx(ctx, async (tx) => {
      const [g] = await tx
        .insert(gasto)
        .values({
          negocioId: ctx.negocioId,
          sucursalId: input.sucursalId,
          tipo: input.tipo,
          categoria: input.categoria,
          monto: input.monto.toFixed(2),
          frecuencia: input.tipo === TipoGasto.Fijo ? (input.frecuencia ?? 'mensual') : input.frecuencia,
          fecha: input.tipo === TipoGasto.Variable ? (input.fecha ?? hoy) : null,
          diaCobro: input.tipo === TipoGasto.Fijo ? (input.diaCobro ?? Number(hoy.slice(8, 10))) : null,
        })
        .returning();
      return g;
    });
  }

  /**
   * Inactivar (HU-ADM-008). Variables: desaparecen de los reportes. Fijos:
   * dejan de cobrarse desde hoy, pero sus ocurrencias pasadas se conservan
   * (los cierres ya generados no cambian retroactivamente).
   */
  async desactivar(ctx: TenantContext, id: string): Promise<void> {
    const [g] = await runInTenantTx(ctx, (tx) =>
      tx.update(gasto).set({ activo: false, desactivadoEn: new Date() }).where(eq(gasto.id, id)).returning(),
    );
    if (!g) throw new NotFoundException('Gasto no encontrado.');
  }
}
