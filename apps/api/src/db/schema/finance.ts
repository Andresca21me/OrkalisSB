import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { negocio, sucursal } from './tenant';
import { especialista } from './team';
import { tipoCierreEnum, tipoGastoEnum } from './_shared';

/**
 * Grupo F — Finanzas (FASE-03). Operativas → con `sucursal_id`.
 */

export const gasto = pgTable('gasto', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  sucursalId: uuid('sucursal_id')
    .notNull()
    .references(() => sucursal.id, { onDelete: 'cascade' }),
  tipo: tipoGastoEnum('tipo').notNull(),
  categoria: text('categoria'),
  monto: numeric('monto', { precision: 12, scale: 2 }).notNull(),
  // Para gastos fijos, p. ej. "mensual".
  frecuencia: text('frecuencia'),
  // Variables: día (Bogotá) en que se hizo el gasto. Null en fijos.
  fecha: date('fecha'),
  // Fijos: día del mes en que se cobra (1–31, recortado al fin de mes). El
  // gasto se repite CADA MES en ese día mientras siga activo. Null en variables.
  diaCobro: integer('dia_cobro'),
  activo: boolean('activo').notNull().default(true),
  // Fijos: al desactivar se conservan las ocurrencias YA cobradas; esta marca
  // dice hasta cuándo. Las variables inactivas desaparecen de los reportes.
  desactivadoEn: timestamp('desactivado_en', { withTimezone: true }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const liquidacion = pgTable('liquidacion', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  sucursalId: uuid('sucursal_id')
    .notNull()
    .references(() => sucursal.id, { onDelete: 'cascade' }),
  especialistaId: uuid('especialista_id')
    .notNull()
    .references(() => especialista.id, { onDelete: 'restrict' }),
  periodo: text('periodo').notNull(),
  /** Rango real del período (Plan-Finanzas F1; null en filas anteriores). */
  desde: timestamp('desde', { withTimezone: true }),
  hasta: timestamp('hasta', { withTimezone: true }),
  bruto: numeric('bruto', { precision: 12, scale: 2 }).notNull(),
  /** Desglose del bruto (Plan-Finanzas F1): servicios vs productos. */
  comisionServicios: numeric('comision_servicios', { precision: 12, scale: 2 }).notNull().default('0'),
  comisionProductos: numeric('comision_productos', { precision: 12, scale: 2 }).notNull().default('0'),
  descuento: numeric('descuento', { precision: 12, scale: 2 }).notNull().default('0'),
  neto: numeric('neto', { precision: 12, scale: 2 }).notNull(),
  pagado: boolean('pagado').notNull().default(false),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const cierrePeriodo = pgTable('cierre_periodo', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  // Nullable si el cierre es de negocio (consolidado).
  sucursalId: uuid('sucursal_id').references(() => sucursal.id, { onDelete: 'cascade' }),
  tipo: tipoCierreEnum('tipo').notNull(),
  desde: timestamp('desde', { withTimezone: true }).notNull(),
  hasta: timestamp('hasta', { withTimezone: true }).notNull(),
  datosArchivados: jsonb('datos_archivados'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});
