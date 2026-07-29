import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import { disponibilidad, servicio, servicioDia, sucursal, sucursalDiaLaborable } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

/** Días de la semana, 0=domingo … 6=sábado (convención JS getDay). */
const DIAS = [0, 1, 2, 3, 4, 5, 6] as const;
const TODOS_ABIERTOS = (): boolean[] => [true, true, true, true, true, true, true];

/** Ventana de atención en formato 'HH:MM'. */
export interface FranjaHoraria {
  apertura: string;
  cierre: string;
}

/**
 * Horario de una sucursal: el `base` rige todos los días y `dias[d]` es la
 * excepción de ese día (típicamente el fin de semana). `null` = sin excepción,
 * y un `base` nulo significa «sin horario definido».
 */
export interface HorarioSucursal {
  base: FranjaHoraria | null;
  dias: (FranjaHoraria | null)[];
}

/** Config de horario que consume el panel admin. `dias[0..6]` (0=domingo). */
export interface HorarioConfig {
  sucursales: { id: string; nombre: string; dias: boolean[]; horario: HorarioSucursal }[];
  servicios: { id: string; nombre: string; dias: boolean[] }[];
}

/**
 * Días laborables de la sucursal + activación de servicios por día (config del
 * admin). Regla: AUSENCIA de fila = abierto/activo (los negocios que no
 * configuran nada trabajan todos los días). Un día `laborable=false` cierra la
 * sucursal ese día; un `servicio_dia.activo=false` desactiva el servicio ese día.
 * En ambos casos el CLIENTE no puede reservar (el admin conserva su poder).
 */
@Injectable()
export class HorarioService {
  // ── Lecturas dentro de una transacción existente (slots / validación) ──────

  /** ¿La sucursal atiende ese día de la semana? Ausencia de fila = sí. */
  async esDiaLaborable(tx: DrizzleTx, sucursalId: string, weekday: number): Promise<boolean> {
    const [row] = await tx
      .select({ laborable: sucursalDiaLaborable.laborable })
      .from(sucursalDiaLaborable)
      .where(
        and(
          eq(sucursalDiaLaborable.sucursalId, sucursalId),
          eq(sucursalDiaLaborable.diaSemana, weekday),
        ),
      )
      .limit(1);
    return row ? row.laborable : true;
  }

  /** De los servicios dados, cuáles están DESACTIVADOS ese día. Ausencia = activo. */
  async serviciosInactivosEnDia(
    tx: DrizzleTx,
    weekday: number,
    servicioIds: string[],
  ): Promise<Set<string>> {
    if (servicioIds.length === 0) return new Set();
    const rows = await tx
      .select({ id: servicioDia.servicioId })
      .from(servicioDia)
      .where(
        and(
          inArray(servicioDia.servicioId, servicioIds),
          eq(servicioDia.diaSemana, weekday),
          eq(servicioDia.activo, false),
        ),
      );
    return new Set(rows.map((r) => r.id));
  }

  /**
   * Días laborables (array 0..6) + horario efectivo por día + servicios activos
   * por día, para el enlace público. `horario[d]` es lo que el cliente ve como
   * «hoy atendemos de X a Y»; `null` en un día abierto = sin horario definido
   * (manda la disponibilidad de cada especialista, como antes).
   */
  async infoPublica(
    tx: DrizzleTx,
    sucursalId: string,
  ): Promise<{
    diasLaborables: boolean[];
    horario: (FranjaHoraria | null)[];
    serviciosDia: Record<string, boolean[]>;
  }> {
    const dl = await tx
      .select({
        dia: sucursalDiaLaborable.diaSemana,
        laborable: sucursalDiaLaborable.laborable,
        apertura: sucursalDiaLaborable.horaApertura,
        cierre: sucursalDiaLaborable.horaCierre,
      })
      .from(sucursalDiaLaborable)
      .where(eq(sucursalDiaLaborable.sucursalId, sucursalId));
    const diasLaborables = DIAS.map((d) => dl.find((x) => x.dia === d)?.laborable ?? true);

    const [base] = await tx
      .select({ apertura: sucursal.horaApertura, cierre: sucursal.horaCierre })
      .from(sucursal)
      .where(eq(sucursal.id, sucursalId))
      .limit(1);
    const horario = DIAS.map((d) => {
      if (!diasLaborables[d]) return null;
      const fila = dl.find((x) => x.dia === d);
      return aFranja(fila?.apertura, fila?.cierre) ?? aFranja(base?.apertura, base?.cierre);
    });

    const sd = await tx
      .select({ servicioId: servicioDia.servicioId, dia: servicioDia.diaSemana, activo: servicioDia.activo })
      .from(servicioDia);
    const serviciosDia: Record<string, boolean[]> = {};
    for (const row of sd) {
      if (!serviciosDia[row.servicioId]) serviciosDia[row.servicioId] = TODOS_ABIERTOS();
      serviciosDia[row.servicioId][row.dia] = row.activo;
    }
    return { diasLaborables, horario, serviciosDia };
  }

  // ── Config del admin (get/set) ─────────────────────────────────────────────

  async getConfig(ctx: TenantContext): Promise<HorarioConfig> {
    return runInTenantTx(ctx, async (tx) => {
      const sucs = await tx
        .select({
          id: sucursal.id,
          nombre: sucursal.nombre,
          apertura: sucursal.horaApertura,
          cierre: sucursal.horaCierre,
        })
        .from(sucursal)
        .where(eq(sucursal.activa, true));
      const servs = await tx
        .select({ id: servicio.id, nombre: servicio.nombre })
        .from(servicio)
        .where(eq(servicio.activo, true));
      const dl = await tx.select().from(sucursalDiaLaborable);
      const sd = await tx.select().from(servicioDia);

      const sucursales = sucs.map((s) => {
        const dias = TODOS_ABIERTOS();
        const horas: (FranjaHoraria | null)[] = [null, null, null, null, null, null, null];
        for (const row of dl) {
          if (row.sucursalId !== s.id) continue;
          dias[row.diaSemana] = row.laborable;
          horas[row.diaSemana] = aFranja(row.horaApertura, row.horaCierre);
        }
        return {
          id: s.id,
          nombre: s.nombre,
          dias,
          horario: { base: aFranja(s.apertura, s.cierre), dias: horas },
        };
      });
      const servicios = servs.map((s) => {
        const dias = TODOS_ABIERTOS();
        for (const row of sd) if (row.servicioId === s.id) dias[row.diaSemana] = row.activo;
        return { id: s.id, nombre: s.nombre, dias };
      });
      return { sucursales, servicios };
    });
  }

  /** Fija los 7 días laborables de una sucursal (upsert). */
  async setDiasLaborables(ctx: TenantContext, sucursalId: string, dias: boolean[]): Promise<void> {
    this.validarDias(dias);
    await runInTenantTx(ctx, async (tx) => {
      const [suc] = await tx.select({ id: sucursal.id }).from(sucursal).where(eq(sucursal.id, sucursalId)).limit(1);
      if (!suc) throw new BadRequestException('Sucursal inexistente.');
      for (const d of DIAS) {
        await tx
          .insert(sucursalDiaLaborable)
          .values({ negocioId: ctx.negocioId, sucursalId, diaSemana: d, laborable: dias[d] })
          .onConflictDoUpdate({
            target: [sucursalDiaLaborable.sucursalId, sucursalDiaLaborable.diaSemana],
            set: { laborable: dias[d], actualizadoEn: new Date() },
          });
      }
    });
  }

  /** Fija los 7 días de actividad de un servicio (upsert). */
  async setServicioDia(ctx: TenantContext, servicioId: string, dias: boolean[]): Promise<void> {
    this.validarDias(dias);
    await runInTenantTx(ctx, async (tx) => {
      const [srv] = await tx.select({ id: servicio.id }).from(servicio).where(eq(servicio.id, servicioId)).limit(1);
      if (!srv) throw new BadRequestException('Servicio inexistente.');
      for (const d of DIAS) {
        await tx
          .insert(servicioDia)
          .values({ negocioId: ctx.negocioId, servicioId, diaSemana: d, activo: dias[d] })
          .onConflictDoUpdate({
            target: [servicioDia.servicioId, servicioDia.diaSemana],
            set: { activo: dias[d], actualizadoEn: new Date() },
          });
      }
    });
  }

  /**
   * Fija el horario de una sucursal: el `base` (obligatorio para poder guardar
   * excepciones) y las 7 excepciones por día. Escribir `null` en un día lo
   * devuelve al horario base.
   *
   * Las filas de `sucursal_dia_laborable` se tocan con upsert **sin pisar
   * `laborable`**: abrir/cerrar un día es otra pantalla y no debe cambiar por
   * guardar horas.
   */
  async setHorario(ctx: TenantContext, sucursalId: string, horario: HorarioSucursal): Promise<void> {
    const base = normalizarFranja(horario.base, 'El horario base');
    const dias = horario.dias.map((f, d) => normalizarFranja(f, `El horario del ${NOMBRE_DIA[d]}`));
    if (!base && dias.some((d) => d !== null)) {
      throw new BadRequestException('Define primero el horario base de la sede.');
    }

    await runInTenantTx(ctx, async (tx) => {
      const [suc] = await tx.select({ id: sucursal.id }).from(sucursal).where(eq(sucursal.id, sucursalId)).limit(1);
      if (!suc) throw new BadRequestException('Sucursal inexistente.');

      await tx
        .update(sucursal)
        .set({ horaApertura: base?.apertura ?? null, horaCierre: base?.cierre ?? null, actualizadoEn: new Date() })
        .where(eq(sucursal.id, sucursalId));

      // Al estrenar horario de sede se retiran las ventanas 09:00–18:00 que
      // `equipo.crear` ponía a cada especialista cuando no había otra forma de
      // tener franjas. Si se dejaran, la intersección las mantendría mandando y
      // ampliar el horario del negocio no movería a nadie: el admin pondría
      // 07:00–22:00 y sus barberos seguirían atendiendo de 9 a 6. Solo se borran
      // las que coinciden EXACTAMENTE con ese valor por defecto y son
      // recurrentes; las excepciones por fecha no se tocan.
      if (base) {
        await tx
          .delete(disponibilidad)
          .where(
            and(
              eq(disponibilidad.sucursalId, sucursalId),
              isNull(disponibilidad.fecha),
              eq(disponibilidad.horaInicio, '09:00:00'),
              eq(disponibilidad.horaFin, '18:00:00'),
            ),
          );
      }

      for (const d of DIAS) {
        const f = dias[d];
        await tx
          .insert(sucursalDiaLaborable)
          .values({
            negocioId: ctx.negocioId,
            sucursalId,
            diaSemana: d,
            laborable: true,
            horaApertura: f?.apertura ?? null,
            horaCierre: f?.cierre ?? null,
          })
          .onConflictDoUpdate({
            target: [sucursalDiaLaborable.sucursalId, sucursalDiaLaborable.diaSemana],
            set: { horaApertura: f?.apertura ?? null, horaCierre: f?.cierre ?? null, actualizadoEn: new Date() },
          });
      }
    });
  }

  private validarDias(dias: boolean[]): void {
    if (!Array.isArray(dias) || dias.length !== 7 || dias.some((d) => typeof d !== 'boolean')) {
      throw new BadRequestException('Se esperan exactamente 7 valores booleanos (domingo→sábado).');
    }
  }
}

const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** 'HH:MM:SS' de la BD → 'HH:MM' para la interfaz. `null` si falta alguna. */
function aFranja(apertura?: string | null, cierre?: string | null): FranjaHoraria | null {
  if (!apertura || !cierre) return null;
  return { apertura: apertura.slice(0, 5), cierre: cierre.slice(0, 5) };
}

/** Valida 'HH:MM' y que el cierre sea posterior a la apertura. */
function normalizarFranja(f: FranjaHoraria | null | undefined, que: string): FranjaHoraria | null {
  if (!f) return null;
  const patron = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!patron.test(f.apertura) || !patron.test(f.cierre)) {
    throw new BadRequestException(`${que} debe venir como HH:MM.`);
  }
  if (f.cierre <= f.apertura) {
    throw new BadRequestException(`${que} debe cerrar después de abrir.`);
  }
  return { apertura: f.apertura, cierre: f.cierre };
}
