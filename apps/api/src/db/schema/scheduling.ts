import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { negocio, sucursal } from './tenant';
import { especialista } from './team';
import { servicio } from './catalog';
import { tstzrange } from './_shared';

/**
 * Grupo H — Soporte de agendamiento (FASE-03, ADR-005). Operativas.
 */

/** Ventanas en que el especialista puede recibir reservas. */
export const disponibilidad = pgTable('disponibilidad', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  sucursalId: uuid('sucursal_id')
    .notNull()
    .references(() => sucursal.id, { onDelete: 'cascade' }),
  especialistaId: uuid('especialista_id')
    .notNull()
    .references(() => especialista.id, { onDelete: 'cascade' }),
  // dia_semana 0–6 (recurrente) O una fecha específica (excepción puntual).
  diaSemana: integer('dia_semana'),
  fecha: date('fecha'),
  horaInicio: time('hora_inicio').notNull(),
  horaFin: time('hora_fin').notNull(),
  activo: boolean('activo').notNull().default(true),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

/** Bloqueo temporal (TTL) de una franja mientras el cliente confirma. */
export const retencionFranja = pgTable('retencion_franja', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  sucursalId: uuid('sucursal_id')
    .notNull()
    .references(() => sucursal.id, { onDelete: 'cascade' }),
  especialistaId: uuid('especialista_id')
    .notNull()
    .references(() => especialista.id, { onDelete: 'cascade' }),
  rango: tstzrange('rango').notNull(),
  expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  // El EXCLUDE `retencion_no_solape` (WHERE expira_en > now()) se añade vía SQL
  // crudo en la migración.
});

/**
 * Días de la semana en que la SUCURSAL atiende (configurable por el admin).
 * `dia_semana`: 0=domingo … 6=sábado (convención JS getDay / disponibilidad).
 * Ausencia de fila = día laborable → los negocios que no configuran nada siguen
 * trabajando todos los días (compatibilidad hacia atrás). Una fila con
 * `laborable=false` cierra ese día → el cliente no puede reservar.
 */
export const sucursalDiaLaborable = pgTable(
  'sucursal_dia_laborable',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    negocioId: uuid('negocio_id')
      .notNull()
      .references(() => negocio.id, { onDelete: 'cascade' }),
    sucursalId: uuid('sucursal_id')
      .notNull()
      .references(() => sucursal.id, { onDelete: 'cascade' }),
    diaSemana: integer('dia_semana').notNull(),
    laborable: boolean('laborable').notNull().default(true),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    unqSucursalDia: unique('sucursal_dia_laborable_unq').on(t.sucursalId, t.diaSemana),
  }),
);

/**
 * Activación de un SERVICIO por día de la semana. `servicio` es a nivel negocio,
 * así que esto aplica a todas las sucursales. Ausencia de fila = activo ese día;
 * una fila con `activo=false` desactiva el servicio ese día (el cliente no puede
 * reservarlo ese día). `dia_semana`: 0=domingo … 6=sábado.
 */
export const servicioDia = pgTable(
  'servicio_dia',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    negocioId: uuid('negocio_id')
      .notNull()
      .references(() => negocio.id, { onDelete: 'cascade' }),
    servicioId: uuid('servicio_id')
      .notNull()
      .references(() => servicio.id, { onDelete: 'cascade' }),
    diaSemana: integer('dia_semana').notNull(),
    activo: boolean('activo').notNull().default(true),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    unqServicioDia: unique('servicio_dia_unq').on(t.servicioId, t.diaSemana),
  }),
);

/** Código OTP para identificar al cliente final sin cuenta (FASE-08). */
export const otpCodigo = pgTable('otp_codigo', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  // Nullable hasta resolver el negocio/sucursal del flujo público.
  negocioId: uuid('negocio_id').references(() => negocio.id, { onDelete: 'cascade' }),
  telefono: text('telefono').notNull(),
  codigoHash: text('codigo_hash').notNull(),
  expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
  intentos: integer('intentos').notNull().default(0),
  consumido: boolean('consumido').notNull().default(false),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});
