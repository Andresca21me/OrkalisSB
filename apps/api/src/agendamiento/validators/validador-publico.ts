import { BadRequestException } from '@nestjs/common';
import type { DrizzleTx } from '../../db/tx';
import { cubierta, ventanasEfectivas } from '../ventanas-efectivas';
import {
  bogotaParts,
  validarEntidades,
  type DatosCita,
  type ValidadorCita,
} from './validador-cita.port';

/**
 * Validador de reserva PÚBLICA (FASE-08, ADR-005): estricto hacia adelante.
 * Exige tiempo futuro, fin > inicio y que la franja caiga dentro de una ventana
 * de atención — la del especialista cruzada con el horario de la sede, la misma
 * que usa el generador de franjas. La unicidad de la franja la garantiza el
 * `EXCLUDE` de la BD al insertar (no se confía en el código).
 */
export class ValidadorPublico implements ValidadorCita {
  async validar(tx: DrizzleTx, datos: DatosCita): Promise<void> {
    if (datos.fin <= datos.inicio) {
      throw new BadRequestException('La hora de fin debe ser posterior al inicio.');
    }
    if (datos.inicio.getTime() <= Date.now()) {
      throw new BadRequestException('Solo se pueden reservar franjas futuras.');
    }
    await validarEntidades(tx, datos);
    await this.dentroDeDisponibilidad(tx, datos);
  }

  private async dentroDeDisponibilidad(tx: DrizzleTx, datos: DatosCita): Promise<void> {
    const ini = bogotaParts(datos.inicio);
    const fin = bogotaParts(datos.fin);

    const fechaIso = new Date(datos.inicio.getTime() - 5 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const ventanas = await ventanasEfectivas(
      tx,
      datos.sucursalId,
      datos.especialistaId,
      fechaIso,
      ini.weekday,
    );

    if (!cubierta(ventanas, ini.minutes, fin.minutes)) {
      throw new BadRequestException('La franja está fuera del horario de atención.');
    }
  }
}
