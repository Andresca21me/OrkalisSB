import { and, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { DrizzleTx } from '../db/tx';
import type { TenantContext } from '../db/tenant-context';
import { sucursalScope } from './scope';

/**
 * Repositorio base con SCOPE OBLIGATORIO (FASE-04, ADR-001).
 *
 * Patrón de defensa en profundidad de la capa de aplicación: todo repositorio
 * de dominio extiende esta clase y recibe (1) el `tx` ya emitido por
 * `runInTenantTx` (que fijó la GUC de tenant para RLS) y (2) el `TenantContext`.
 *
 * Regla del proyecto (PLAN-V1 §5): ningún módulo de dominio consulta `db`/`tx`
 * "a pelo"; siempre pasa por aquí, que aporta el acotamiento por sucursal.
 */
export abstract class BaseRepository {
  protected constructor(
    protected readonly tx: DrizzleTx,
    protected readonly ctx: TenantContext,
  ) {}

  /**
   * Condición de scope por sucursal para tablas OPERATIVAS. Combínala con el
   * resto del `where` mediante `this.scoped(...)`.
   */
  protected sucursalScope(sucursalColumn: PgColumn): SQL | undefined {
    return sucursalScope(this.ctx, sucursalColumn);
  }

  /**
   * Combina el scope de sucursal con condiciones adicionales. Úsalo como
   * `where` en consultas a tablas operativas para no olvidar el acotamiento.
   */
  protected scoped(sucursalColumn: PgColumn, ...condiciones: Array<SQL | undefined>): SQL | undefined {
    return and(this.sucursalScope(sucursalColumn), ...condiciones);
  }
}
