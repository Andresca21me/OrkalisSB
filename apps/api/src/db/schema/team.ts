import { sql } from 'drizzle-orm';
import { boolean, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { negocio, sucursal, usuario } from './tenant';

/**
 * Grupo B — Equipo (FASE-03, ADR-001).
 * Un especialista pertenece a varias sucursales pero opera en una a la vez.
 */

export const especialista = pgTable('especialista', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  especialidad: text('especialidad'),
  disponible: boolean('disponible').notNull().default(true),
  // Opcional: si el especialista inicia sesión, se enlaza a un usuario.
  usuarioId: uuid('usuario_id').references(() => usuario.id, { onDelete: 'set null' }),
  activo: boolean('activo').notNull().default(true),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }),
});

/** Relación N:N especialista↔sucursal. PK compuesta. */
export const especialistaSucursal = pgTable(
  'especialista_sucursal',
  {
    especialistaId: uuid('especialista_id')
      .notNull()
      .references(() => especialista.id, { onDelete: 'cascade' }),
    sucursalId: uuid('sucursal_id')
      .notNull()
      .references(() => sucursal.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.especialistaId, t.sucursalId] }),
  }),
);
