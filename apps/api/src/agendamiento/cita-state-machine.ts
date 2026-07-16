import { BadRequestException } from '@nestjs/common';
import { EstadoCita } from '@orkalis/shared';

/**
 * Máquina de estados de la cita (FASE-08, ADR-005). Centraliza las transiciones
 * permitidas; nada de `if` dispersos (SOLID). Rechaza transiciones inválidas.
 *
 *   solicitada ──aprobar──► confirmada ──iniciar──► en_progreso ──completar──► completada
 *       │rechazar/cancelar      │cancelar/no_asistio     │cancelar            │revertir
 *       ▼                       ▼                        ▼                    ▼
 *   cancelada              cancelada/no_asistio      cancelada           en_progreso
 *
 * `solicitada` solo existe si la aprobación manual está activa.
 */
export type EventoCita =
  | 'aprobar'
  | 'rechazar'
  | 'iniciar'
  | 'completar'
  | 'cancelar'
  | 'no_asistio'
  | 'revertir';

const TRANSICIONES: Record<EstadoCita, Partial<Record<EventoCita, EstadoCita>>> = {
  [EstadoCita.Solicitada]: {
    aprobar: EstadoCita.Confirmada,
    rechazar: EstadoCita.Cancelada,
    cancelar: EstadoCita.Cancelada,
  },
  [EstadoCita.Confirmada]: {
    iniciar: EstadoCita.EnProgreso,
    cancelar: EstadoCita.Cancelada,
    no_asistio: EstadoCita.NoAsistio,
  },
  [EstadoCita.EnProgreso]: {
    completar: EstadoCita.Completada,
    cancelar: EstadoCita.Cancelada,
  },
  // `revertir` deshace la completada (efectos financieros se revierten en FASE-09).
  [EstadoCita.Completada]: {
    revertir: EstadoCita.EnProgreso,
  },
  [EstadoCita.Cancelada]: {},
  [EstadoCita.NoAsistio]: {},
};

/** ¿Es válida la transición `estado --evento-->`? */
export function puedeTransicionar(estado: EstadoCita, evento: EventoCita): boolean {
  return TRANSICIONES[estado]?.[evento] !== undefined;
}

/** Devuelve el nuevo estado o lanza si la transición no está permitida. */
export function transicionar(estado: EstadoCita, evento: EventoCita): EstadoCita {
  const destino = TRANSICIONES[estado]?.[evento];
  if (destino === undefined) {
    throw new BadRequestException(
      `Transición inválida: no se puede '${evento}' una cita en estado '${estado}'.`,
    );
  }
  return destino;
}
