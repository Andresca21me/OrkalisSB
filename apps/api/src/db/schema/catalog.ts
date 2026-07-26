import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { negocio } from './tenant';
import { splitTypeEnum } from './_shared';

/**
 * Grupo C — Clientes y catálogo (FASE-03).
 * Cliente y servicio son de NIVEL NEGOCIO (no sucursal).
 */

export const cliente = pgTable(
  'cliente',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    negocioId: uuid('negocio_id')
      .notNull()
      .references(() => negocio.id, { onDelete: 'cascade' }),
    nombre: text('nombre').notNull(),
    telefono: text('telefono'),
    activo: boolean('activo').notNull().default(true),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }),
  },
  (t) => ({
    // Índice para deduplicar por teléfono dentro del negocio (RF-034).
    telefonoIdx: index('cliente_negocio_telefono_idx').on(t.negocioId, t.telefono),
  }),
);

export const servicio = pgTable('servicio', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  // Dinero en numeric(12,2) — nunca float (PLAN-V1 §5).
  precio: numeric('precio', { precision: 12, scale: 2 }).notNull(),
  duracionMin: integer('duracion_min').notNull(),
  categoria: text('categoria'),
  splitType: splitTypeEnum('split_type').notNull().default('porcentaje'),
  // % (0–100) o valor fijo al profesional, según split_type.
  splitValor: numeric('split_valor', { precision: 12, scale: 2 }).notNull().default('0'),
  // Destacado manual: si el negocio no tiene aún historial de reservas, estos
  // son los que aparecen en «Lo más reservado» del enlace público.
  favorito: boolean('favorito').notNull().default(false),
  activo: boolean('activo').notNull().default(true),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }),
});
