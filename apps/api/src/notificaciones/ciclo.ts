/**
 * Ciclo de cupos de mensajería (Plan-Mensajeria FASE-03, decisión **D1**).
 *
 * Los cupos del plan NO se reinician el día 1 del mes: se recargan en el
 * **aniversario de cobro** del negocio, que es cuando efectivamente paga. Un
 * salón que cobra el día 15 tiene su ciclo del 15 al 15.
 *
 * Función PURA (recibe `ahora`) para poder probar los bordes sin reloj.
 */

/** Datos de la suscripción necesarios para situar el ciclo. */
export interface DatosCiclo {
  diaCobro: number | null;
  proximoCobro: Date | null;
  trialFin: Date | null;
  creadoEn: Date;
}

export interface Ciclo {
  /** Inclusivo. */
  inicio: Date;
  /** Exclusivo (= inicio del siguiente). */
  fin: Date;
}

/**
 * Día ancla del ciclo (1..28). Se acota a 28 por la misma razón que
 * `siguienteCobro` en `cobro-cron.service.ts`: así sumar/restar un mes nunca
 * desborda (no existe el 31 de febrero) y el ciclo es estable todo el año.
 *
 * Orden de preferencia: el día de cobro pactado → el del próximo cobro → el del
 * fin de prueba → el de alta. Los dos últimos cubren las cuentas en prueba, que
 * todavía no tienen fecha de cobro pero sí consumen mensajería.
 */
function ancla(s: DatosCiclo): number {
  const dia =
    s.diaCobro ?? s.proximoCobro?.getUTCDate() ?? s.trialFin?.getUTCDate() ?? s.creadoEn.getUTCDate();
  return Math.min(Math.max(1, dia), 28);
}

/**
 * Ventana `[inicio, fin)` que contiene a `ahora`.
 *
 * Se calcula desde el día ancla y no desde `proximoCobro`, para que el ciclo sea
 * correcto aunque el cron de cobro vaya atrasado o adelantado: siempre devuelve
 * el ciclo en el que **estamos**, no el que tocaba.
 */
export function cicloDeCobro(s: DatosCiclo, ahora = new Date()): Ciclo {
  const dia = ancla(s);
  const y = ahora.getUTCFullYear();
  const m = ahora.getUTCMonth();
  let inicio = new Date(Date.UTC(y, m, dia, 12, 0, 0));
  // Aún no llegamos al aniversario de este mes → seguimos en el ciclo anterior.
  if (ahora.getTime() < inicio.getTime()) inicio = new Date(Date.UTC(y, m - 1, dia, 12, 0, 0));
  const fin = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, dia, 12, 0, 0));
  return { inicio, fin };
}
