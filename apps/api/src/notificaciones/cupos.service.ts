import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { PlanSuscripcion } from '@orkalis/shared';
import { runInTenantTx } from '../db/tx';
import { consumoMensajeria, suscripcion } from '../db/schema';
import { PlanService } from '../plans/plan.service';

/** Canal lógico de cupo (ADR-009). */
export type CanalCupo = 'whatsapp_utility' | 'whatsapp_marketing' | 'sms' | 'email';

export interface EstadoCupo {
  canal: CanalCupo;
  consumo: number;
  cupo: number;
  dentroDeCupo: boolean;
}

/** Cupos de mensajería por plan (FASE-11, ADR-009): contabiliza y verifica. */
@Injectable()
export class CuposService {
  constructor(private readonly plans: PlanService) {}

  periodoActual(d = new Date()): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /** Verifica el estado del cupo de un canal para el período actual. */
  async verificar(negocioId: string, canal: CanalCupo): Promise<EstadoCupo> {
    const periodo = this.periodoActual();
    return runInTenantTx({ negocioId, sucursalIds: null, rol: 'sistema' }, async (tx) => {
      const [sus] = await tx
        .select({ plan: suscripcion.plan, num: suscripcion.numEspecialistas })
        .from(suscripcion)
        .where(eq(suscripcion.negocioId, negocioId))
        .limit(1);
      const plan = (sus?.plan ?? PlanSuscripcion.Basico) as PlanSuscripcion;
      const cupos = this.plans.cuposMensajeria(plan, sus?.num ?? 0);
      const cupo = this.cupoDeCanal(cupos, canal);

      const [c] = await tx
        .select({ cantidad: consumoMensajeria.cantidad })
        .from(consumoMensajeria)
        .where(and(eq(consumoMensajeria.canal, canal), eq(consumoMensajeria.periodo, periodo)))
        .limit(1);
      const consumo = c?.cantidad ?? 0;
      return { canal, consumo, cupo, dentroDeCupo: consumo < cupo };
    });
  }

  /** Suma 1 al consumo del canal en el período (upsert atómico). */
  async registrar(negocioId: string, canal: CanalCupo): Promise<void> {
    const periodo = this.periodoActual();
    await runInTenantTx({ negocioId, sucursalIds: null, rol: 'sistema' }, (tx) =>
      tx
        .insert(consumoMensajeria)
        .values({ negocioId, canal, periodo, cantidad: 1 })
        .onConflictDoUpdate({
          target: [consumoMensajeria.negocioId, consumoMensajeria.canal, consumoMensajeria.periodo],
          set: { cantidad: sql`${consumoMensajeria.cantidad} + 1`, actualizadoEn: new Date() },
        }),
    );
  }

  private cupoDeCanal(
    cupos: ReturnType<PlanService['cuposMensajeria']>,
    canal: CanalCupo,
  ): number {
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
