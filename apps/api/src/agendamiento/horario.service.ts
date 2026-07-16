import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import { servicio, servicioDia, sucursal, sucursalDiaLaborable } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

/** Días de la semana, 0=domingo … 6=sábado (convención JS getDay). */
const DIAS = [0, 1, 2, 3, 4, 5, 6] as const;
const TODOS_ABIERTOS = (): boolean[] => [true, true, true, true, true, true, true];

/** Config de horario que consume el panel admin. `dias[0..6]` (0=domingo). */
export interface HorarioConfig {
  sucursales: { id: string; nombre: string; dias: boolean[] }[];
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

  /** Días laborables (array 0..6) + servicios activos por día, para el enlace público. */
  async infoPublica(
    tx: DrizzleTx,
    sucursalId: string,
  ): Promise<{ diasLaborables: boolean[]; serviciosDia: Record<string, boolean[]> }> {
    const dl = await tx
      .select({ dia: sucursalDiaLaborable.diaSemana, laborable: sucursalDiaLaborable.laborable })
      .from(sucursalDiaLaborable)
      .where(eq(sucursalDiaLaborable.sucursalId, sucursalId));
    const diasLaborables = DIAS.map((d) => dl.find((x) => x.dia === d)?.laborable ?? true);

    const sd = await tx
      .select({ servicioId: servicioDia.servicioId, dia: servicioDia.diaSemana, activo: servicioDia.activo })
      .from(servicioDia);
    const serviciosDia: Record<string, boolean[]> = {};
    for (const row of sd) {
      if (!serviciosDia[row.servicioId]) serviciosDia[row.servicioId] = TODOS_ABIERTOS();
      serviciosDia[row.servicioId][row.dia] = row.activo;
    }
    return { diasLaborables, serviciosDia };
  }

  // ── Config del admin (get/set) ─────────────────────────────────────────────

  async getConfig(ctx: TenantContext): Promise<HorarioConfig> {
    return runInTenantTx(ctx, async (tx) => {
      const sucs = await tx
        .select({ id: sucursal.id, nombre: sucursal.nombre })
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
        for (const row of dl) if (row.sucursalId === s.id) dias[row.diaSemana] = row.laborable;
        return { id: s.id, nombre: s.nombre, dias };
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

  private validarDias(dias: boolean[]): void {
    if (!Array.isArray(dias) || dias.length !== 7 || dias.some((d) => typeof d !== 'boolean')) {
      throw new BadRequestException('Se esperan exactamente 7 valores booleanos (domingo→sábado).');
    }
  }
}
