import { BadRequestException } from '@nestjs/common';
import type { DrizzleTx } from '../../db/tx';
import { validarEntidades, type DatosCita, type ValidadorCita } from './validador-cita.port';

/**
 * Validador de creación INTERNA (FASE-08, ADR-005): relajado. Admite pasado
 * (registro retroactivo), sin candado de concurrencia; solo chequeos de
 * sanidad: `fin ≥ inicio` y entidades válidas (especialista asignado a la sede).
 */
export class ValidadorInterno implements ValidadorCita {
  async validar(tx: DrizzleTx, datos: DatosCita): Promise<void> {
    if (datos.fin < datos.inicio) {
      throw new BadRequestException('La hora de fin no puede ser anterior al inicio.');
    }
    await validarEntidades(tx, datos);
  }
}
