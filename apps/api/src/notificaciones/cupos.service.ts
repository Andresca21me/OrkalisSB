import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { PlanSuscripcion } from '@orkalis/shared';
import { runInTenantTx } from '../db/tx';
import { consumoMensajeria, suscripcion } from '../db/schema';
import { PlanService } from '../plans/plan.service';
import type { CuposMensajeria } from '../plans/plan-registry';
import { cicloDeCobro, type Ciclo } from './ciclo';

/** Canal lógico de cupo (ADR-009). */
export type CanalCupo = 'whatsapp_utility' | 'whatsapp_marketing' | 'sms' | 'email';

export const CANALES_CUPO: CanalCupo[] = ['whatsapp_utility', 'whatsapp_marketing', 'sms', 'email'];

export interface EstadoCupo {
  canal: CanalCupo;
  consumo: number;
  cupo: number;
  restante: number;
  dentroDeCupo: boolean;
  /** Ventana del ciclo de cobro vigente (ISO), D1. */
  cicloInicio: string;
  cicloFin: string;
}

/**
 * Cupos de mensajería por plan (ADR-009, D1): contabiliza y verifica contra el
 * **ciclo de cobro** del negocio (no el mes calendario). El incremento lo hace
 * el `OutboxWorker` solo cuando el envío fue **definitivamente exitoso**, para
 * que un reintento no consuma cupo dos veces.
 */
@Injectable()
export class CuposService {
  constructor(private readonly plans: PlanService) {}

  /** Ciclo vigente del negocio (aniversario de cobro), D1. */
  async cicloActual(negocioId: string, ahora = new Date()): Promise<Ciclo> {
    return (await this.contexto(negocioId, ahora)).ciclo;
  }

  /** Estado del cupo de un canal en el ciclo vigente. */
  async verificar(negocioId: string, canal: CanalCupo, ahora = new Date()): Promise<EstadoCupo> {
    const { cupos, ciclo } = await this.contexto(negocioId, ahora);
    const consumos = await this.consumos(negocioId, ciclo);
    return this.estado(canal, consumos.get(canal) ?? 0, cupos, ciclo);
  }

  /** Estado de los cuatro canales (una sola lectura de suscripción/consumo). */
  async verificarTodos(negocioId: string, ahora = new Date()): Promise<EstadoCupo[]> {
    const { cupos, ciclo } = await this.contexto(negocioId, ahora);
    const consumos = await this.consumos(negocioId, ciclo);
    return CANALES_CUPO.map((c) => this.estado(c, consumos.get(c) ?? 0, cupos, ciclo));
  }

  /**
   * Suma 1 al consumo del canal en el ciclo (upsert atómico, a prueba de
   * carreras) y devuelve el estado YA actualizado, para que quien llame pueda
   * detectar el cruce de un umbral sin una segunda lectura.
   */
  async registrar(negocioId: string, canal: CanalCupo, ahora = new Date()): Promise<EstadoCupo> {
    const { cupos, ciclo } = await this.contexto(negocioId, ahora);
    const [fila] = await runInTenantTx({ negocioId, sucursalIds: null, rol: 'sistema' }, (tx) =>
      tx
        .insert(consumoMensajeria)
        .values({ negocioId, canal, cicloInicio: ciclo.inicio, cicloFin: ciclo.fin, cantidad: 1 })
        .onConflictDoUpdate({
          target: [consumoMensajeria.negocioId, consumoMensajeria.canal, consumoMensajeria.cicloInicio],
          set: { cantidad: sql`${consumoMensajeria.cantidad} + 1`, actualizadoEn: new Date() },
        })
        .returning({ cantidad: consumoMensajeria.cantidad }),
    );
    return this.estado(canal, fila?.cantidad ?? 1, cupos, ciclo);
  }

  // ── Interno ─────────────────────────────────────────────────────────────────

  /** Plan + ciclo del negocio (una consulta a `suscripcion`). */
  private async contexto(negocioId: string, ahora: Date): Promise<{ cupos: CuposMensajeria; ciclo: Ciclo }> {
    const [sus] = await runInTenantTx({ negocioId, sucursalIds: null, rol: 'sistema' }, (tx) =>
      tx
        .select({
          plan: suscripcion.plan,
          num: suscripcion.numEspecialistas,
          diaCobro: suscripcion.diaCobro,
          proximoCobro: suscripcion.proximoCobro,
          trialFin: suscripcion.trialFin,
          creadoEn: suscripcion.creadoEn,
        })
        .from(suscripcion)
        .where(eq(suscripcion.negocioId, negocioId))
        .limit(1),
    );
    const plan = (sus?.plan ?? PlanSuscripcion.Basico) as PlanSuscripcion;
    const cupos = this.plans.cuposMensajeria(plan, sus?.num ?? 0);
    const ciclo = cicloDeCobro(
      {
        diaCobro: sus?.diaCobro ?? null,
        proximoCobro: sus?.proximoCobro ?? null,
        trialFin: sus?.trialFin ?? null,
        creadoEn: sus?.creadoEn ?? ahora,
      },
      ahora,
    );
    return { cupos, ciclo };
  }

  /** Consumo por canal del ciclo dado. */
  private async consumos(negocioId: string, ciclo: Ciclo): Promise<Map<CanalCupo, number>> {
    const filas = await runInTenantTx({ negocioId, sucursalIds: null, rol: 'sistema' }, (tx) =>
      tx
        .select({ canal: consumoMensajeria.canal, cantidad: consumoMensajeria.cantidad })
        .from(consumoMensajeria)
        // El filtro por negocio es explícito a propósito: RLS es la segunda
        // línea de defensa, no la única (ADR-001).
        .where(
          and(
            eq(consumoMensajeria.negocioId, negocioId),
            eq(consumoMensajeria.cicloInicio, ciclo.inicio),
          ),
        ),
    );
    return new Map(filas.map((f) => [f.canal as CanalCupo, f.cantidad]));
  }

  private estado(canal: CanalCupo, consumo: number, cupos: CuposMensajeria, ciclo: Ciclo): EstadoCupo {
    const cupo = this.cupoDeCanal(cupos, canal);
    return {
      canal,
      consumo,
      cupo,
      restante: Math.max(0, cupo - consumo),
      dentroDeCupo: consumo < cupo,
      cicloInicio: ciclo.inicio.toISOString(),
      cicloFin: ciclo.fin.toISOString(),
    };
  }

  private cupoDeCanal(cupos: CuposMensajeria, canal: CanalCupo): number {
    switch (canal) {
      case 'whatsapp_utility':
        return cupos.whatsappUtility;
      case 'whatsapp_marketing':
        return cupos.whatsappMarketing;
      case 'sms':
        return cupos.sms;
      case 'email':
        return cupos.email;
    }
  }
}
