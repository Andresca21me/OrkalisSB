import { sql } from 'drizzle-orm';
import { db } from './client';
import type { TenantContext } from './tenant-context';

/**
 * Tipo de la transacción Drizzle (el `tx` que recibe el callback).
 */
export type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Patrón CLAVE de aislamiento (ADR-004).
 *
 * Abre una transacción y fija la GUC de tenant `app.current_tenant` ANTES de
 * cualquier consulta, para que las políticas RLS (FASE-04) actúen. Usa
 * `set_config(..., true)` = `SET LOCAL`: solo vive dentro de esta transacción.
 *
 * El `negocioId` se pasa SIEMPRE como parámetro (nunca interpolado a string),
 * para evitar inyección.
 */
export async function runInTenantTx<T>(
  ctx: TenantContext,
  fn: (tx: DrizzleTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_tenant', ${ctx.negocioId}, true)`);
    return fn(tx);
  });
}
