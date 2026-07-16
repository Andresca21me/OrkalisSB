import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Re-siembra la base de datos de desarrollo (idempotente). Para fases sensibles
 * a la capacidad del día (reservas de HOY) o destructivas, que necesitan partir
 * de un estado conocido sin reservas acumuladas de otras pruebas.
 * Ver _DATOS-Y-CREDENCIALES §7.
 */
export function reseed() {
  const repoRoot = resolve(process.cwd(), '../..'); // apps/web → raíz del monorepo
  execSync('pnpm --filter api db:seed', { cwd: repoRoot, stdio: 'ignore' });
}
