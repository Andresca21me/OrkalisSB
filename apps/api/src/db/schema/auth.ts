import { sql } from 'drizzle-orm';
import { boolean, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
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
