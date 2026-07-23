import { sql } from 'drizzle-orm';
import { boolean, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { negocio, sucursal } from './tenant';
import { especialista } from './team';
import { gasto } from './finance';
import { tipoMovimientoEnum, tipoProductoEnum } from './_shared';

/**
 * Grupo E — Inventario y ventas (FASE-03, módulo opcional). Operativas.
 */

export const producto = pgTable('producto', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  sucursalId: uuid('sucursal_id')
    .notNull()
    .references(() => sucursal.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  tipo: tipoProductoEnum('tipo').notNull(),
  cantidad: integer('cantidad').notNull().default(0),
  stockMin: integer('stock_min').notNull().default(0),
  costo: numeric('costo', { precision: 12, scale: 2 }).notNull().default('0'),
  precioVenta: numeric('precio_venta', { precision: 12, scale: 2 }).notNull().default('0'),
  activo: boolean('activo').notNull().default(true),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }),
});

export const movimientoInventario = pgTable('movimiento_inventario', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  sucursalId: uuid('sucursal_id')
    .notNull()
    .references(() => sucursal.id, { onDelete: 'cascade' }),
  productoId: uuid('producto_id')
    .notNull()
    .references(() => producto.id, { onDelete: 'cascade' }),
  tipoMov: tipoMovimientoEnum('tipo_mov').notNull(),
  cantidad: integer('cantidad').notNull(),
  motivo: text('motivo'),
  // Si la entrada por compra generó un gasto.
  gastoId: uuid('gasto_id').references(() => gasto.id, { onDelete: 'set null' }),
  /** Lo pagado de verdad en esta compra (solo entradas por compra; NULL en el resto). */
  costoTotal: numeric('costo_total', { precision: 12, scale: 2 }),
  /** Stock que quedó tras aplicar el movimiento: hace el kardex legible sin recalcular. */
  stockResultante: integer('stock_resultante'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const ventaProducto = pgTable('venta_producto', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  sucursalId: uuid('sucursal_id')
    .notNull()
    .references(() => sucursal.id, { onDelete: 'cascade' }),
  especialistaId: uuid('especialista_id').references(() => especialista.id, {
    onDelete: 'set null',
  }),
  productoId: uuid('producto_id')
    .notNull()
    .references(() => producto.id, { onDelete: 'restrict' }),
  cantidad: integer('cantidad').notNull(),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  comisionProf: numeric('comision_prof', { precision: 12, scale: 2 }).notNull().default('0'),
  /** Costo unitario congelado al vender (margen exacto e inmune a cambios de costo). */
  costoUnitario: numeric('costo_unitario', { precision: 12, scale: 2 }).notNull().default('0'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});
