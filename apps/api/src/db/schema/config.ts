import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { negocio } from './tenant';
import { nivelConfigEnum } from './_shared';

/**
 * Grupo G — Configuración (FASE-03, ADR-002).
 *
 * Guarda SOLO overrides dispersos por nivel (`negocio`|`sucursal`). El nivel
 * `sistema` y el catálogo/registry de claves viven en CÓDIGO (FASE-06), no en
 * la BD. `ambito_id` es el negocio_id o el sucursal_id según `nivel`.
 */
export const configuracion = pgTable(
  'configuracion',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    negocioId: uuid('negocio_id')
      .notNull()
      .references(() => negocio.id, { onDelete: 'cascade' }),
    nivel: nivelConfigEnum('nivel').notNull(),
    ambitoId: uuid('ambito_id').notNull(),
    clave: text('clave').notNull(),
    valor: jsonb('valor').notNull(),
    tipo: text('tipo'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }),
  },
  (t) => ({
    overrideUq: unique('configuracion_override_uq').on(
      t.negocioId,
      t.nivel,
      t.ambitoId,
      t.clave,
    ),
  }),
);
