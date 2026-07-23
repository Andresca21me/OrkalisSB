import { BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DrizzleTx } from '../../db/tx';
import { especialista, especialistaSucursal, sucursal } from '../../db/schema';
import { realizaServicios } from './capacidades';

/** Datos mínimos de una cita a validar. */
export interface DatosCita {
  negocioId: string;
  sucursalId: string;
  especialistaId: string;
  inicio: Date;
  fin: Date;
  /** Servicios de la cita: se exige que el especialista los realice todos. */
  servicioIds?: string[];
  /**
   * `false` solo para el walk-in RETROACTIVO: registra una atención que YA
   * ocurrió. Bloquearla no cambia lo que pasó en el salón, solo impide dejarlo
   * asentado y descuadra las finanzas.
   */
  validarServicios?: boolean;
}

/**
 * Estrategia de validación según el ORIGEN de la cita (FASE-08, ADR-005, RF-029).
 * Open-Closed: un nuevo origen = una nueva estrategia, sin tocar las demás.
 */
export interface ValidadorCita {
  validar(tx: DrizzleTx, datos: DatosCita): Promise<void>;
}

/** Chequeos de sanidad comunes: sucursal activa + especialista activo y asignado. */
export async function validarEntidades(tx: DrizzleTx, datos: DatosCita): Promise<void> {
  const [suc] = await tx
    .select({ activa: sucursal.activa })
    .from(sucursal)
    .where(eq(sucursal.id, datos.sucursalId))
    .limit(1);
  if (!suc) throw new BadRequestException('Sucursal inexistente.');
  if (!suc.activa) throw new BadRequestException('La sucursal está inactiva.');

  const [esp] = await tx
    .select({ activo: especialista.activo })
    .from(especialista)
    .where(eq(especialista.id, datos.especialistaId))
    .limit(1);
  if (!esp) throw new BadRequestException('Especialista inexistente.');
  if (!esp.activo) throw new BadRequestException('El especialista está inactivo.');

  // El especialista debe estar asignado a esa sucursal (HU-ADM-012).
  const asignaciones = await tx
    .select({ s: especialistaSucursal.sucursalId })
    .from(especialistaSucursal)
    .where(eq(especialistaSucursal.especialistaId, datos.especialistaId));
  if (!asignaciones.some((a) => a.s === datos.sucursalId)) {
    throw new BadRequestException('El especialista no está asignado a esa sucursal.');
  }

  // Y debe realizar todos los servicios de la cita (sin restricción declarada,
  // los realiza todos). El front ya filtra, pero aquí es donde se garantiza.
  if (datos.validarServicios !== false && datos.servicioIds?.length) {
    if (!(await realizaServicios(tx, datos.especialistaId, datos.servicioIds))) {
      throw new BadRequestException('El especialista no realiza alguno de los servicios seleccionados.');
    }
  }
}

/** Hora local de Bogotá (UTC-5, sin DST) a partir de un instante. */
export function bogotaParts(d: Date): { weekday: number; minutes: number } {
  const local = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  return { weekday: local.getUTCDay(), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

/** 'HH:MM:SS' → minutos del día. */
export function horaAMinutos(hhmmss: string): number {
  const [h, m] = hhmmss.split(':').map(Number);
  return h * 60 + m;
}
