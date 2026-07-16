import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  estadoSuscripcionEnum,
  perfilNegocioEnum,
  planSuscripcionEnum,
  rolUsuarioEnum,
} from './_shared';

/**
 * Grupo A — Tenencia y cuenta (FASE-03, ADR-001).
 * `negocio` es el tenant raíz; toda tabla cuelga de él vía `negocio_id`.
 */

export const negocio = pgTable('negocio', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  nombre: text('nombre').notNull(),
  perfil: perfilNegocioEnum('perfil').notNull(),
  estadoSuscripcion: estadoSuscripcionEnum('estado_suscripcion').notNull().default('activa'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }),
});

export const suscripcion = pgTable('suscripcion', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  // Dimensión de cobro (ADR-009): plan + nº de especialistas facturables.
  // El catálogo de precios/cupos/funciones por plan vive en código (FASE-07).
  plan: planSuscripcionEnum('plan').notNull().default('basico'),
  numEspecialistas: integer('num_especialistas').notNull().default(2),
  estado: estadoSuscripcionEnum('estado').notNull().default('activa'),
  // Ciclo de vida del cobro (Plan-Pagos FASE-00, ver _MODELO-Y-ESTADOS §2).
  trialFin: timestamp('trial_fin', { withTimezone: true }), // fin de la prueba (creado_en + 15 días)
  diaCobro: integer('dia_cobro'), // día del mes ancla (1..28) del cobro recurrente
  proximoCobro: timestamp('proximo_cobro', { withTimezone: true }), // próximo intento de cobro
  ultimoCobroOk: timestamp('ultimo_cobro_ok', { withTimezone: true }), // último cobro exitoso
  // Método de pago guardado en Mercado Pago (Customer + Card; Plan-Pagos FASE-05).
  mpCustomerId: text('mp_customer_id'), // id del Customer de Mercado Pago
  mpCardId: text('mp_card_id'), // id de la tarjeta guardada (Card)
  mpPayerEmail: text('mp_payer_email'), // email del pagador usado en Mercado Pago
  metodoUltimos4: text('metodo_ultimos4'), // "**** 4242" para mostrar en la UI
  intentosFallidos: integer('intentos_fallidos').notNull().default(0), // reintentos de morosidad
  graciaInicio: timestamp('gracia_inicio', { withTimezone: true }), // inicio de la ventana de gracia (corte a 7 días)
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }),
});

export const sucursal = pgTable('sucursal', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  activa: boolean('activa').notNull().default(true),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }),
});

export const usuario = pgTable(
  'usuario',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    negocioId: uuid('negocio_id')
      .notNull()
      .references(() => negocio.id, { onDelete: 'cascade' }),
    nombre: text('nombre').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    rol: rolUsuarioEnum('rol').notNull(),
    activo: boolean('activo').notNull().default(true),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }),
  },
  (t) => ({
    // Email único GLOBAL entre todos los usuarios internos (FASE-05/ADR-003):
    // permite login solo con email, sin pedir un identificador de negocio.
    emailUnico: unique('usuario_email_uq').on(t.email),
  }),
);

/** Alcance de sucursales del usuario (RBAC, RF-014). PK compuesta. */
export const usuarioSucursal = pgTable(
  'usuario_sucursal',
  {
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    sucursalId: uuid('sucursal_id')
      .notNull()
      .references(() => sucursal.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.usuarioId, t.sucursalId] }),
  }),
);
