import { inArray } from 'drizzle-orm';
import type { DrizzleTx } from '../../db/tx';
import { especialistaServicio } from '../../db/schema';

/**
 * Quién puede realizar qué (Plan-Servicios-Especialistas, D2).
 *
 * **La regla, en una frase: un especialista SIN filas en `especialista_servicio`
 * realiza TODOS los servicios.** Solo cuando el admin declara un subconjunto
 * empieza a haber restricción.
 *
 * Esto no es una comodidad: es lo que hace que la tabla se pueda introducir en
 * caliente sin que ningún negocio existente pierda reservas, y lo que evita
 * tener que sembrar N×M filas en la migración. Es la misma convención de
 * `sucursal_dia_laborable` y `servicio_dia` (ausencia de fila = permitido).
 *
 * Ambas funciones viven aquí, juntas y sin estado, porque la regla se consulta
 * desde cinco sitios (validador de citas, disponibilidad, listado público,
 * reasignación y baja en cascada) y duplicarla sería la forma más fácil de que
 * un día dejen de coincidir.
 */

/**
 * Mapa especialistaId → conjunto de servicios declarados. **La ausencia de una
 * clave significa "sin restricción"** (realiza todos), no "no realiza ninguno".
 *
 * Se expone para quien necesite resolver muchas combinaciones de golpe (p. ej.
 * el catálogo público, que calcula los especialistas de cada servicio) sin
 * disparar una consulta por servicio.
 */
export async function capacidadesDe(
  tx: DrizzleTx,
  especialistaIds: string[],
): Promise<Map<string, Set<string>>> {
  const mapa = new Map<string, Set<string>>();
  if (especialistaIds.length === 0) return mapa;
  const filas = await tx
    .select({ especialistaId: especialistaServicio.especialistaId, servicioId: especialistaServicio.servicioId })
    .from(especialistaServicio)
    .where(inArray(especialistaServicio.especialistaId, especialistaIds));
  for (const f of filas) {
    const set = mapa.get(f.especialistaId) ?? new Set<string>();
    set.add(f.servicioId);
    mapa.set(f.especialistaId, set);
  }
  return mapa;
}

/** ¿Este especialista realiza TODOS los servicios indicados? */
export async function realizaServicios(
  tx: DrizzleTx,
  especialistaId: string,
  servicioIds: string[],
): Promise<boolean> {
  if (servicioIds.length === 0) return true;
  const declarados = (await capacidadesDe(tx, [especialistaId])).get(especialistaId);
  if (!declarados) return true; // sin restricción declarada → realiza todo
  return servicioIds.every((id) => declarados.has(id));
}

/**
 * De una lista de candidatos, los que realizan TODOS los servicios indicados.
 * Conserva el orden recibido y resuelve con UNA sola consulta.
 */
export async function filtrarPorServicios(
  tx: DrizzleTx,
  especialistaIds: string[],
  servicioIds: string[],
): Promise<string[]> {
  if (servicioIds.length === 0 || especialistaIds.length === 0) return especialistaIds;
  const mapa = await capacidadesDe(tx, especialistaIds);
  return especialistaIds.filter((id) => {
    const declarados = mapa.get(id);
    if (!declarados) return true; // sin restricción → pasa
    return servicioIds.every((s) => declarados.has(s));
  });
}
