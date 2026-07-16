import { inArray, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { TenantContext } from '../db/tenant-context';

/**
 * Scope de SUCURSAL — segundo nivel de aislamiento (FASE-04, ADR-001).
 *
 * El aislamiento por NEGOCIO lo garantiza RLS (capa BD). El acotamiento por
 * SUCURSAL se aplica en la capa de aplicación, porque un admin con alcance
 * consolidado (`sucursalIds === null`) SÍ puede ver todas las sucursales de su
 * negocio. Por eso NO va en la política RLS de negocio.
 *
 * Devuelve la condición Drizzle a combinar con `and(...)` en cada consulta a
 * tablas operativas:
 *  - `null`  (consolidado) → `undefined`: no filtra por sucursal (RLS acota al negocio).
 *  - `[]`    (sin alcance) → `false`: no devuelve nada (seguro por defecto).
 *  - `[...]` (alcance dado) → `sucursal_id IN (...)`.
 */
export function sucursalScope(ctx: TenantContext, sucursalColumn: PgColumn): SQL | undefined {
  if (ctx.sucursalIds === null) return undefined;
  if (ctx.sucursalIds.length === 0) return sql`false`;
  return inArray(sucursalColumn, ctx.sucursalIds);
}
