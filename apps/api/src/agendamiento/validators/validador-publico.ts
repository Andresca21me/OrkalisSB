import { BadRequestException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { DrizzleTx } from '../../db/tx';
import { disponibilidad } from '../../db/schema';
import {
  bogotaParts,
  horaAMinutos,
  validarEntidades,
  type DatosCita,
  type ValidadorCita,
} from './validador-cita.port';

/**
 * Validador de reserva PÚBLICA (FASE-08, ADR-005): estricto hacia adelante.
 * Exige tiempo futuro, fin > inicio y que la franja caiga dentro de una ventana
 * de disponibilidad del especialista. La unicidad de la franja la garantiza el
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

    const ventanas = await tx
      .select()
      .from(disponibilidad)
      .where(
        and(
          eq(disponibilidad.especialistaId, datos.especialistaId),
          eq(disponibilidad.sucursalId, datos.sucursalId),
          eq(disponibilidad.activo, true),
        ),
      );

    const fechaIso = new Date(datos.inicio.getTime() - 5 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const cubre = ventanas.some((v) => {
      const aplica = v.fecha ? v.fecha === fechaIso : v.diaSemana === ini.weekday;
      if (!aplica) return false;
      const desde = horaAMinutos(v.horaInicio);
      const hasta = horaAMinutos(v.horaFin);
      return ini.minutes >= desde && fin.minutes <= hasta;
    });

    if (!cubre) {
      throw new BadRequestException('La franja está fuera de la disponibilidad del especialista.');
    }
  }
}
