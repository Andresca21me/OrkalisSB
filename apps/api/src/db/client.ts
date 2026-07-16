import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

/**
 * Cliente postgres.js + instancia Drizzle (FASE-02, ADR-004).
 *
 * `DATABASE_URL` se lee del entorno directamente: este módulo es la única
 * puerta a la base de datos. El pool es singleton a nivel de proceso.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no está definida (ver apps/api/.env).');
}

export const client = postgres(connectionString, {
  // transform y opciones de pool razonables; ajustar en FASE-14.
  max: 10,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
