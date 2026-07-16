import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Helpers de suscripción para E2E (Plan-Pagos FASE-04). Manipulan el estado de
 * prueba simulando el paso del tiempo, vía SQL directo (igual que `reseed` se
 * apoya en el CLI). Solo para el entorno de desarrollo local.
 */

/** URL admin de la BD, leída de apps/api/.env (misma fuente que el seed). */
function dbUrlAdmin(): string {
  const envPath = resolve(process.cwd(), '../api/.env'); // apps/web → apps/api/.env
  const txt = readFileSync(envPath, 'utf8');
  const m = txt.match(/^DATABASE_URL_ADMIN=(.+)$/m) ?? txt.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error('No se encontró DATABASE_URL_ADMIN/DATABASE_URL en apps/api/.env');
  return m[1].trim();
}

/**
 * Vence la prueba del negocio cuyo admin tiene `email`: pone `trial_fin` en el
 * pasado (simula que pasaron los 15 días). El corte real lo aplica el backend en
 * la siguiente request (FASE-04).
 */
export function expirarPruebaPorEmail(email: string): void {
  const sql = `update suscripcion s set trial_fin = now() - interval '1 day' from usuario u where u.negocio_id = s.negocio_id and u.email = '${email}' and s.estado = 'prueba';`;
  execSync(`psql "${dbUrlAdmin()}" -v ON_ERROR_STOP=1 -c "${sql}"`, { stdio: 'ignore' });
}
