import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { TipoGasto } from '@orkalis/shared';
import { runInTenantTx } from '../db/tx';
import { gasto } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

type Gasto = typeof gasto.$inferSelect;

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

  crear(
    ctx: TenantContext,
    input: { sucursalId: string; tipo: TipoGasto; categoria?: string; monto: number; frecuencia?: string },
  ): Promise<Gasto> {
    return runInTenantTx(ctx, async (tx) => {
      const [g] = await tx
        .insert(gasto)
        .values({
          negocioId: ctx.negocioId,
          sucursalId: input.sucursalId,
          tipo: input.tipo,
          categoria: input.categoria,
          monto: input.monto.toFixed(2),
          frecuencia: input.frecuencia,
        })
        .returning();
      return g;
    });
  }

  /** Inactivar: deja de afectar períodos futuros sin alterar históricos (HU-ADM-008). */
  async desactivar(ctx: TenantContext, id: string): Promise<void> {
    const [g] = await runInTenantTx(ctx, (tx) =>
      tx.update(gasto).set({ activo: false }).where(eq(gasto.id, id)).returning(),
    );
    if (!g) throw new NotFoundException('Gasto no encontrado.');
  }
}
