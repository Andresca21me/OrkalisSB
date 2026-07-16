import { EstadoSuscripcion } from '@orkalis/shared';

/**
 * Máquina de estados de la suscripción (Plan-Pagos FASE-00, ADR-P2).
 * Función PURA y unit-testeable: dada la situación actual y un evento, devuelve
 * el estado resultante o lanza si la transición no es válida. Es la fuente de
 * verdad de qué transiciones existen; los servicios la usan, no la duplican.
 *
 * Ver el diagrama en `Plan-Ejecucion-Pagos-Suscripciones/_MODELO-Y-ESTADOS §4`.
 */

/** Eventos que disparan transiciones. */
export type EventoSuscripcion =
  | 'iniciar_prueba' // registro con prueba gratis
  | 'pago_ok' // primer pago / renovación / reactivación por pago / reintento OK
  | 'cobro_falla' // un cobro automático fue rechazado
  | 'prueba_vence' // se acabó la prueba sin método de pago
  | 'gracia_agotada' // pasaron 7 días en gracia sin éxito
  | 'reactivar' // el operador reactiva manualmente
  | 'dar_cortesia' // el operador asigna beneficios sin cobro
  | 'quitar_cortesia' // el operador retira la cortesía
  | 'cancelar'; // el cliente cancela (terminal)

/**
 * Estado de origen aceptado por la máquina. Incluye el marcador transitorio
 * `'nueva'` (no se persiste) que representa una suscripción recién creada en el
 * registro, antes de su primer estado real.
 */
export type EstadoOrigen = EstadoSuscripcion | 'nueva';

const E = EstadoSuscripcion;

/**
 * Tabla de transiciones: `TRANSICIONES[estado][evento] = estadoSiguiente`.
 * Lo que no está listado es inválido.
 */
const TRANSICIONES: Record<EstadoOrigen, Partial<Record<EventoSuscripcion, EstadoSuscripcion>>> = {
  // Registro: prueba gratis o pagar de una vez; el operador puede dar cortesía.
  nueva: {
    iniciar_prueba: E.Prueba,
    pago_ok: E.Activa,
    dar_cortesia: E.Cortesia,
  },
  [E.Prueba]: {
    pago_ok: E.Activa, // agrega método y paga el primer mes
    prueba_vence: E.Suspendida, // venció sin pagar
    dar_cortesia: E.Cortesia,
    cancelar: E.Cancelada,
  },
  [E.Activa]: {
    pago_ok: E.Activa, // renovación mensual exitosa
    cobro_falla: E.EnGracia, // el cobro del mes fue rechazado
    dar_cortesia: E.Cortesia,
    cancelar: E.Cancelada,
  },
  [E.EnGracia]: {
    pago_ok: E.Activa, // un reintento entró
    cobro_falla: E.EnGracia, // otro reintento falló (sigue en gracia)
    gracia_agotada: E.Suspendida, // 7 días sin éxito
    dar_cortesia: E.Cortesia,
    cancelar: E.Cancelada,
  },
  [E.Suspendida]: {
    pago_ok: E.Activa, // actualiza método y paga
    reactivar: E.Activa, // reactivación manual del operador
    dar_cortesia: E.Cortesia,
    cancelar: E.Cancelada,
  },
  [E.Cortesia]: {
    quitar_cortesia: E.Suspendida,
    pago_ok: E.Activa, // si decide pagar de verdad
    cancelar: E.Cancelada,
  },
  // Terminal: solo el operador podría revivirla dándole cortesía.
  [E.Cancelada]: {
    dar_cortesia: E.Cortesia,
  },
};

/** Error de transición inválida (lo mapea el llamador a una HTTP si aplica). */
export class TransicionInvalidaError extends Error {
  constructor(estado: EstadoOrigen, evento: EventoSuscripcion) {
    super(`Transición inválida: no se puede aplicar "${evento}" desde el estado "${estado}".`);
    this.name = 'TransicionInvalidaError';
  }
}

/**
 * Devuelve el estado resultante de aplicar `evento` a `estadoActual`.
 * Lanza `TransicionInvalidaError` si la transición no existe.
 */
export function transicionar(
  estadoActual: EstadoOrigen,
  evento: EventoSuscripcion,
): EstadoSuscripcion {
  const siguiente = TRANSICIONES[estadoActual]?.[evento];
  if (!siguiente) throw new TransicionInvalidaError(estadoActual, evento);
  return siguiente;
}

/** True si la transición es válida (sin lanzar). Útil para chequeos previos. */
export function puedeTransicionar(estadoActual: EstadoOrigen, evento: EventoSuscripcion): boolean {
  return Boolean(TRANSICIONES[estadoActual]?.[evento]);
}
