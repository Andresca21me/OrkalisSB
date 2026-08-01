import type { Ventana } from './ventanas-efectivas';

/**
 * Generación de inicios de franja — funciones de dominio PURAS (Plan-Franjas).
 *
 * Modelo:
 *  - Los OCUPADOS (citas + retenciones, en minutos del día) se ensanchan con el
 *    buffer y se fusionan.
 *  - Restarlos de las ventanas deja SEGMENTOS LIBRES. El inicio de un segmento
 *    interior es el minuto exacto en que termina la cita anterior (+buffer):
 *    las franjas se re-anclan ahí en vez de seguir una rejilla ciega desde la
 *    apertura, así una cita de 9:45–10:20 ofrece la siguiente franja a las
 *    10:20, no a las 10:30.
 *  - Dentro de cada segmento, inicios cada `paso` minutos desde su comienzo.
 *  - ENCAJE DE COLA: además se ofrece el último inicio posible del segmento
 *    (`fin − duración`) aunque no caiga en la rejilla — un hueco de 50 min
 *    acepta un servicio de 50 min completo.
 */

/** Bloque ocupado en minutos del día [ini, fin). */
export interface Ocupado {
  ini: number;
  fin: number;
}

/** Fusiona ocupados (ya ensanchados) que se solapan o se tocan. */
function fusionar(ocupados: Ocupado[]): Ocupado[] {
  const orden = [...ocupados].sort((a, b) => a.ini - b.ini);
  const out: Ocupado[] = [];
  for (const o of orden) {
    const ultimo = out[out.length - 1];
    if (ultimo && o.ini <= ultimo.fin) ultimo.fin = Math.max(ultimo.fin, o.fin);
    else out.push({ ...o });
  }
  return out;
}

/** Segmentos libres de una ventana tras restarle los ocupados fusionados. */
function segmentosLibres(ventana: Ventana, ocupados: Ocupado[]): Ventana[] {
  const out: Ventana[] = [];
  let cursor = ventana.desde;
  for (const o of ocupados) {
    if (o.fin <= cursor || o.ini >= ventana.hasta) continue;
    if (o.ini > cursor) out.push({ desde: cursor, hasta: o.ini });
    cursor = Math.max(cursor, o.fin);
  }
  if (cursor < ventana.hasta) out.push({ desde: cursor, hasta: ventana.hasta });
  return out;
}

/**
 * Inicios posibles (minutos del día, ordenados y sin duplicados) para una
 * franja de `duracion` min, dadas las ventanas del día y los bloques ocupados.
 * El buffer separa la nueva franja de las citas existentes por AMBOS lados,
 * pero no alarga la franja mostrada al cliente.
 */
export function iniciosEnVentanas(
  ventanas: Ventana[],
  ocupados: Ocupado[],
  duracion: number,
  paso: number,
  bufferMin = 0,
): number[] {
  if (duracion <= 0 || paso <= 0) return [];
  // El buffer ensancha el ocupado por ambos extremos: ni la franja nueva pega
  // su inicio al fin de una cita, ni su fin al inicio de la siguiente.
  const bloqueados = fusionar(
    ocupados.map((o) => ({ ini: o.ini - bufferMin, fin: o.fin + bufferMin })),
  );

  const inicios = new Set<number>();
  for (const v of ventanas) {
    for (const seg of segmentosLibres(v, bloqueados)) {
      const ultimo = seg.hasta - duracion;
      for (let t = seg.desde; t <= ultimo; t += paso) inicios.add(t);
      // Encaje de cola: el hueco se puede llenar hasta el borde.
      if (ultimo >= seg.desde) inicios.add(ultimo);
    }
  }
  return [...inicios].sort((a, b) => a - b);
}
