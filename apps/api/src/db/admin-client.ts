import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

/**
 * Cliente ADMIN (FASE-04) — conexión con el rol dueño/superusuario.
 *
 * BYPASSEA RLS. Úsese SOLO para tareas administrativas que no tienen contexto
 * de tenant: migraciones, seed y siembra de fixtures en pruebas. El código de
 * dominio (peticiones de usuarios) NUNCA debe usar esta conexión: para eso
 * está `client.ts` (rol `orkalis_app`, con RLS forzada).
 *
 * Usa `DATABASE_URL_ADMIN`; si no está definida, cae a `DATABASE_URL` (útil en
 * entornos donde aún no se separó el rol).
 */
const connectionString = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL_ADMIN/DATABASE_URL no están definidas (ver apps/api/.env).');
}

export const adminClient = postgres(connectionString, { max: 5 });
export const adminDb = drizzle(adminClient, { schema });
