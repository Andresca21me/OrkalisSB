import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { negocio, usuario } from './tenant';

/**
 * Grupo Auth — soporte de sesiones (FASE-05, ADR-003).
 *
 * `refresh_token` rastrea los refresh tokens emitidos para poder ROTARLOS y
 * REVOCARLOS (detección de reuso por familia). Se gestiona con la conexión
 * admin (la autenticación ocurre antes de tener contexto de tenant), pero la
 * tabla igual lleva RLS forzada por coherencia (defensa en profundidad).
 *
 * Se guarda el `jti` del token, no el token en sí (el JWT va firmado al cliente).
 */
export const refreshToken = pgTable('refresh_token', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  // jti del refresh JWT (claim `jti`). Único: identifica el token concreto.
  jti: uuid('jti').notNull().unique(),
  // Familia de rotación: al detectar reuso de un jti revocado, se revoca toda.
  familia: uuid('familia').notNull(),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => usuario.id, { onDelete: 'cascade' }),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  revocado: boolean('revocado').notNull().default(false),
  expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

/** Acciones que se autorizan con un enlace enviado por correo (Plan-Correo). */
export type TipoTokenAccion = 'alta_email' | 'reset_password' | 'cambio_email' | 'invitacion_especialista';

/**
 * Token de un solo uso enviado por correo (Plan-Correo, D3).
 *
 * El token de 32 bytes viaja SOLO en el enlace del correo; aquí queda su hash
 * SHA-256 (mismo principio que `refresh_token`, que guarda el jti y no el JWT).
 * Dos estampas distintas porque el alta necesita ambas: `usado_en` marca que el
 * dueño del correo abrió el enlace (verificado) y `consumido_en` que la acción
 * final se ejecutó (la cuenta se creó) — un enlace verificado no puede parir dos
 * cuentas.
 *
 * Se gestiona con la conexión admin: casi todos los flujos ocurren sin sesión y
 * el del alta, además, antes de que exista el negocio (por eso `usuario_id` y
 * `negocio_id` son opcionales). La migración le pone una política que niega todo
 * al rol de aplicación, como a `mensajeria_saldo`.
 */
export const tokenAccion = pgTable(
  'token_accion',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tipo: text('tipo').$type<TipoTokenAccion>().notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    /** Destino del correo (lowercased). En `cambio_email` es la dirección NUEVA. */
    email: text('email').notNull(),
    usuarioId: uuid('usuario_id').references(() => usuario.id, { onDelete: 'cascade' }),
    negocioId: uuid('negocio_id').references(() => negocio.id, { onDelete: 'cascade' }),
    /** Contexto del flujo: { nombre }, { nuevoEmail }, { especialistaId }… */
    payload: jsonb('payload').$type<Record<string, string>>(),
    expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
    /** El enlace se abrió y validó (un solo clic cuenta). */
    usadoEn: timestamp('usado_en', { withTimezone: true }),
    /** La acción final se ejecutó (registro creado, contraseña cambiada…). */
    consumidoEn: timestamp('consumido_en', { withTimezone: true }),
    reenvios: integer('reenvios').notNull().default(0),
    ultimoEnvio: timestamp('ultimo_envio', { withTimezone: true }).notNull().defaultNow(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Lookup de "invalidar los vigentes de este destino" al iniciar un flujo.
    idxTipoEmail: index('token_accion_tipo_email_idx').on(t.tipo, t.email),
  }),
);
