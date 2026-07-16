import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { EstadoCita } from '@orkalis/shared';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import {
  cita,
  disponibilidad,
  especialista,
  especialistaSucursal,
  retencionFranja,
  servicio,
} from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { horaAMinutos } from './validators/validador-cita.port';

export interface Franja {
  inicio: string; // ISO
  fin: string; // ISO
}

/** Franja pública: incluye el especialista concreto que la atendería (para `any`). */
export interface FranjaPublica extends Franja {
  especialistaId: string;
}

const GRANULARIDAD_MIN = 15;

/** Instante UTC a partir de fecha local Bogotá (UTC-5) + minutos del día. */
function instante(fechaIso: string, minutos: number): Date {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + (minutos + 5 * 60) * 60000);
}

/** Disponibilidad en tiempo real (FASE-08, RF-017): franjas libres por día. */
@Injectable()
export class DisponibilidadService {
  /**
   * Franjas libres para una fecha, compatibles con la duración TOTAL de los
   * servicios elegidos. Acepta un especialista concreto o `'any'` (agrega sobre
   * todos los especialistas activos de la sucursal y, por franja, asigna el
   * primero disponible). Cada franja devuelve su `especialistaId` para que el
   * front pueda retenerla sobre ese especialista concreto.
   */
  async franjasPublicas(
    ctx: TenantContext,
    sucursalId: string,
    especialistaParam: string, // uuid del especialista o 'any'
    servicioIds: string[],
    fechaIso: string,
  ): Promise<FranjaPublica[]> {
    return runInTenantTx(ctx, async (tx) => {
      // Duración total = suma de los servicios elegidos.
      const servs = await tx
        .select({ id: servicio.id, dur: servicio.duracionMin })
        .from(servicio)
        .where(inArray(servicio.id, servicioIds));
      if (servs.length === 0 || servs.length !== new Set(servicioIds).size) {
        throw new NotFoundException('Algún servicio no existe.');
      }
      const duracion = servs.reduce((a, s) => a + s.dur, 0);

      // Especialistas objetivo.
      let especialistaIds: string[];
      if (especialistaParam === 'any') {
        const rows = await tx
          .select({ id: especialista.id })
          .from(especialista)
          .innerJoin(especialistaSucursal, eq(especialistaSucursal.especialistaId, especialista.id))
          .where(
            and(
              eq(especialistaSucursal.sucursalId, sucursalId),
              eq(especialista.activo, true),
              eq(especialista.disponible, true),
            ),
          );
        especialistaIds = rows.map((r) => r.id);
      } else {
        especialistaIds = [especialistaParam];
      }

      // Agrega por hora de inicio: el primer especialista libre gana la franja.
      const porInicio = new Map<string, FranjaPublica>();
      for (const espId of especialistaIds) {
        const slots = await this.slotsDeEspecialista(tx, sucursalId, espId, duracion, fechaIso);
        for (const s of slots) {
          if (!porInicio.has(s.inicio)) porInicio.set(s.inicio, { ...s, especialistaId: espId });
        }
      }
      return [...porInicio.values()].sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
    });
  }

  /** Franjas libres de UN especialista para una duración dada, en una fecha. */
  private async slotsDeEspecialista(
    tx: DrizzleTx,
    sucursalId: string,
    especialistaId: string,
    duracion: number,
    fechaIso: string,
  ): Promise<Franja[]> {
    const [y, m, d] = fechaIso.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const diaInicio = instante(fechaIso, 0);
    const diaFin = instante(fechaIso, 24 * 60);

    const ventanas = await tx
      .select()
      .from(disponibilidad)
      .where(
        and(
          eq(disponibilidad.especialistaId, especialistaId),
          eq(disponibilidad.sucursalId, sucursalId),
          eq(disponibilidad.activo, true),
        ),
      );
    const ventanasDelDia = ventanas.filter((v) =>
      v.fecha ? v.fecha === fechaIso : v.diaSemana === weekday,
    );
    if (ventanasDelDia.length === 0) return [];

    // Ocupado: citas activas (confirmada/en_progreso) del día.
    const citas = await tx
      .select({ inicio: cita.inicio, fin: cita.fin, estado: cita.estado })
      .from(cita)
      .where(
        and(
          eq(cita.especialistaId, especialistaId),
          eq(cita.sucursalId, sucursalId),
          gte(cita.inicio, diaInicio),
          lt(cita.inicio, diaFin),
        ),
      );
    const ocupadas = citas
      .filter((c) => c.estado === EstadoCita.Confirmada || c.estado === EstadoCita.EnProgreso)
      .map((c) => ({ ini: c.inicio.getTime(), fin: c.fin.getTime() }));

    // Ocupado: retenciones vigentes.
    const retenciones = await tx
      .select({
        ini: sql<Date>`lower(${retencionFranja.rango})`,
        fin: sql<Date>`upper(${retencionFranja.rango})`,
      })
      .from(retencionFranja)
      .where(
        and(
          eq(retencionFranja.especialistaId, especialistaId),
          eq(retencionFranja.sucursalId, sucursalId),
          sql`${retencionFranja.expiraEn} > now()`,
        ),
      );
    for (const r of retenciones) {
      ocupadas.push({ ini: new Date(r.ini).getTime(), fin: new Date(r.fin).getTime() });
    }

    const libres: Franja[] = [];
    const ahora = Date.now();
    for (const v of ventanasDelDia) {
      const desde = horaAMinutos(v.horaInicio);
      const hasta = horaAMinutos(v.horaFin);
      for (let t = desde; t + duracion <= hasta; t += GRANULARIDAD_MIN) {
        const ini = instante(fechaIso, t);
        const fin = instante(fechaIso, t + duracion);
        if (ini.getTime() <= ahora) continue; // solo futuro
        const choca = ocupadas.some((o) => ini.getTime() < o.fin && fin.getTime() > o.ini);
        if (!choca) libres.push({ inicio: ini.toISOString(), fin: fin.toISOString() });
      }
    }
    return libres;
  }
}
