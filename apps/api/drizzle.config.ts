import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Configuración de Drizzle Kit (FASE-02, ADR-004).
 * Esquema en src/db/schema, migraciones versionadas en ./drizzle.
 */
// Las migraciones se aplican con el rol ADMIN (dueño), no con el rol de app
// (orkalis_app, sin privilegio para alterar/crear). Cae a DATABASE_URL si no
// se definió la de admin.
const databaseUrl = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL_ADMIN/DATABASE_URL no están definidas (ver apps/api/.env).');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
