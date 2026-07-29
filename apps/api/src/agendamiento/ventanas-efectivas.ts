import { and, eq } from 'drizzle-orm';
import type { DrizzleTx } from '../db/tx';
import { disponibilidad, sucursal, sucursalDiaLaborable } from '../db/schema';
import { horaAMinutos } from './validators/validador-cita.port';

/** Ventana de atención en minutos del día [desde, hasta). */
export interface Ventana {
  desde: number;
  hasta: number;
}

/** Horario de la sucursal para un día concreto, ya resuelto. */
export interface HorarioDia {
  /** `false` = la sede no abre ese día (no hay reservas). */
  abierto: boolean;
  /** Ventana de atención, o `null` si la sede no tiene horario definido. */
  ventana: Ventana | null;
}

/**
 * Horario de una SUCURSAL para un día de la semana (0=domingo … 6=sábado).
 *
 * Cascada, de más específico a más general:
 *  1. Fila de `sucursal_dia_laborable` con `laborable=false` → cerrado.
 *  2. Esa misma fila con horas propias → esa ventana (el caso del fin de semana).
 *  3. Horario base de la sucursal.
 *  4. Nada de lo anterior → `ventana: null`, que significa «sin horario
 *     definido»: la sede se comporta como antes y manda la disponibilidad de
 *     cada especialista. Es lo que mantiene intactas las cuentas antiguas.
 */
export async function horarioDeSucursal(
  tx: DrizzleTx,
  sucursalId: string,
  weekday: number,
): Promise<HorarioDia> {
  const [dia] = await tx
    .select({
      laborable: sucursalDiaLaborable.laborable,
      apertura: sucursalDiaLaborable.horaApertura,
      cierre: sucursalDiaLaborable.horaCierre,
    })
    .from(sucursalDiaLaborable)
    .where(
      and(eq(sucursalDiaLaborable.sucursalId, sucursalId), eq(sucursalDiaLaborable.diaSemana, weekday)),
    )
    .limit(1);

  if (dia && !dia.laborable) return { abierto: false, ventana: null };

  if (dia?.apertura && dia.cierre) {
    return { abierto: true, ventana: aVentana(dia.apertura, dia.cierre) };
  }

  const [base] = await tx
    .select({ apertura: sucursal.horaApertura, cierre: sucursal.horaCierre })
    .from(sucursal)
    .where(eq(sucursal.id, sucursalId))
    .limit(1);

  if (base?.apertura && base.cierre) {
    return { abierto: true, ventana: aVentana(base.apertura, base.cierre) };
  }
  return { abierto: true, ventana: null };
}

/**
 * Ventanas en las que un especialista puede recibir citas ese día, ya cruzadas
 * con el horario de la sede. Es la ÚNICA fuente para generar franjas y para
 * validar una reserva pública: si las dos rutas calcularan por su cuenta,
 * acabaríamos ofreciendo huecos que luego se rechazan.
 *
 * Reglas:
 *  - Sede cerrada ese día → sin ventanas.
 *  - Sede sin horario definido → las ventanas propias del especialista (tal
 *    como funcionaba antes).
 *  - Especialista sin ventanas propias → el horario de la sede. Así, al abrir
 *    un negocio nuevo basta con fijar el horario para que ya se pueda reservar,
 *    y ampliar el horario mueve a todo el equipo de golpe.
 *  - Especialista con ventanas propias → su intersección con el horario de la
 *    sede (nadie atiende con el local cerrado).
 */
export async function ventanasEfectivas(
  tx: DrizzleTx,
  sucursalId: string,
  especialistaId: string,
  fechaIso: string,
  weekday: number,
): Promise<Ventana[]> {
  const horario = await horarioDeSucursal(tx, sucursalId, weekday);
  if (!horario.abierto) return [];

  const propias = await tx
    .select({
      diaSemana: disponibilidad.diaSemana,
      fecha: disponibilidad.fecha,
      horaInicio: disponibilidad.horaInicio,
      horaFin: disponibilidad.horaFin,
    })
    .from(disponibilidad)
    .where(
      and(
        eq(disponibilidad.especialistaId, especialistaId),
        eq(disponibilidad.sucursalId, sucursalId),
        eq(disponibilidad.activo, true),
      ),
    );

  // Una ventana con `fecha` es una excepción puntual y gana al día de la semana.
  const delDia = propias.filter((v) => (v.fecha ? v.fecha === fechaIso : v.diaSemana === weekday));
  const propiasDelDia = delDia.map((v) => aVentana(v.horaInicio, v.horaFin));

  if (!horario.ventana) return propiasDelDia;
  if (propiasDelDia.length === 0) return [horario.ventana];

  return propiasDelDia
    .map((v) => intersectar(v, horario.ventana as Ventana))
    .filter((v): v is Ventana => v !== null);
}

/** ¿La franja [desde, hasta) cabe entera dentro de alguna ventana? */
export function cubierta(ventanas: Ventana[], desde: number, hasta: number): boolean {
  return ventanas.some((v) => desde >= v.desde && hasta <= v.hasta);
}

function aVentana(inicio: string, fin: string): Ventana {
  return { desde: horaAMinutos(inicio), hasta: horaAMinutos(fin) };
}

function intersectar(a: Ventana, b: Ventana): Ventana | null {
  const desde = Math.max(a.desde, b.desde);
  const hasta = Math.min(a.hasta, b.hasta);
  return hasta > desde ? { desde, hasta } : null;
}
