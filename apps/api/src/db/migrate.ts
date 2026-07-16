import '../load-env';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

/**
 * Aplicador de migraciones para PRODUCCIÓN (FASE-14, ADR-004). Usa el migrador
 * de drizzle-orm (dependencia de runtime), sin necesitar drizzle-kit (devDep),
 * así corre en la imagen de despliegue. Se ejecuta con el rol ADMIN/dueño.
 *
 *   node dist/db/migrate.js
 */
async function run(): Promise<void> {
  const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_ADMIN/DATABASE_URL no definidas.');

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  // La carpeta drizzle/ se copia junto al dist en la imagen (ver Dockerfile).
  await migrate(db, { migrationsFolder: resolve(__dirname, '../../drizzle') });
  await sql.end();
  // eslint-disable-next-line no-console
  console.log('Migraciones aplicadas.');
}

run()
  .then(() => {
    // Salida explícita: si drizzle/postgres deja algún handle vivo, el proceso
    // no terminaría solo y el `&& node dist/main.js` del arranque nunca correría.
    process.exit(0);
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Fallo de migración:', e);
    process.exit(1);
  });
