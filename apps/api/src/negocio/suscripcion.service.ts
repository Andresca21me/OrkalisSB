import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { count, desc, eq } from 'drizzle-orm';
import { EstadoSuscripcion, PlanSuscripcion, tieneAcceso } from '@orkalis/shared';
import { runInTenantTx } from '../db/tx';
import { cobro, especialista, sucursal, suscripcion } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { PlanService } from '../plans/plan.service';

/** Un cobro del historial de facturación (lo que ve el admin). */
export interface CobroResumen {
  periodo: string;
  monto: number;
  estado: string;
  creadoEn: Date;
  pagadoEn: Date | null;
}

/** Resumen de la suscripción del negocio (cargo, cupos, funciones, límites y uso). */
export interface ResumenSuscripcion {
  plan: PlanSuscripcion;
  estado: string;
  numEspecialistas: number;
  cargoMensual: number;
  maxSucursales: number;
  cupos: ReturnType<PlanService['cuposMensajeria']>;
  funciones: ReturnType<PlanService['getPlan']>['funciones'];
  /** Días restantes de la prueba (solo en estado `prueba`); `null` si no aplica. */
  trialDiasRestantes: number | null;
  /** Últimos 4 dígitos de la tarjeta guardada; `null` si no hay método. */
  metodoUltimos4: string | null;
  /** Próximo cobro programado; `null` en prueba/cortesía/sin método. */
  proximoCobro: Date | null;
  /** Último cobro emitido (para el estado de cuenta); `null` si no hay. */
  ultimoCobro: CobroResumen | null;
  /** Historial de cobros (más recientes primero, máx. 12). */
  cobros: CobroResumen[];
  /** `true` si la cuenta no tiene acceso (la UI redirige a facturación). */
  bloqueado: boolean;
  /** Motivo de bloqueo (`suspendida` | `cancelada`); `null` si tiene acceso. */
  motivoBloqueo: string | null;
  /** Límites del plan que la UI refleja y FASE-08 aplica en el backend. */
  limites: {
    /** Cupo de especialistas pagados. */
    especialistas: number;
    /** Máximo de sucursales; `null` = ilimitado. */
    maxSucursales: number | null;
    /** Claves de módulos avanzados que el plan habilita. */
    modulos: string[];
  };
  /** Uso actual, para mostrar "X de Y especialistas" y banners de cupo. */
  uso: {
    especialistas: number;
    sucursales: number;
  };
}

/**
 * Suscripción por plan + nº de especialistas (FASE-07, ADR-009).
 * El cobro real con Mercado Pago vive en el módulo de pagos (Plan-Pagos);
 * aquí están el cálculo, los límites/uso y el cambio de plan.
 */
@Injectable()
export class SuscripcionService {
  constructor(private readonly plans: PlanService) {}

  /** Catálogo público de planes (precios + funciones) para la comparación. */
  catalogoPlanes() {
    return this.plans.catalogo();
  }

  /** Resumen actual: plan, nº especialistas, cargo, cupos, funciones, límites y uso. */
  async getResumen(ctx: TenantContext): Promise<ResumenSuscripcion> {
    return runInTenantTx(ctx, async (tx) => {
      const [sus] = await tx
        .select()
        .from(suscripcion)
        .where(eq(suscripcion.negocioId, ctx.negocioId))
        .limit(1);
      if (!sus) throw new NotFoundException('Suscripción no encontrada.');

      // Uso actual (RLS ya acota al tenant): especialistas y sucursales activos.
      const [{ c: usoEspecialistas }] = await tx
        .select({ c: count() })
        .from(especialista)
        .where(eq(especialista.activo, true));
      const [{ c: usoSucursales }] = await tx
        .select({ c: count() })
        .from(sucursal)
        .where(eq(sucursal.activa, true));

      // Historial de cobros (RLS acota al tenant), más recientes primero.
      const cobrosRaw = await tx
        .select({
          periodo: cobro.periodo,
          monto: cobro.monto,
          estado: cobro.estado,
          creadoEn: cobro.creadoEn,
          pagadoEn: cobro.pagadoEn,
        })
        .from(cobro)
        .orderBy(desc(cobro.creadoEn))
        .limit(12);
      const cobros: CobroResumen[] = cobrosRaw.map((c) => ({
        periodo: c.periodo,
        monto: Number(c.monto),
        estado: c.estado,
        creadoEn: c.creadoEn,
        pagadoEn: c.pagadoEn,
      }));

      const plan = sus.plan as PlanSuscripcion;
      const max = this.plans.maxSucursales(plan);
      const estado = sus.estado as EstadoSuscripcion;
      const trialDiasRestantes =
        estado === EstadoSuscripcion.Prueba && sus.trialFin
          ? Math.max(0, Math.ceil((sus.trialFin.getTime() - Date.now()) / 86_400_000))
          : null;
      const bloqueado = !tieneAcceso(estado);
      return {
        plan,
        estado: sus.estado,
        numEspecialistas: sus.numEspecialistas,
        cargoMensual: this.plans.calcularCargo(plan, sus.numEspecialistas),
        maxSucursales: max,
        cupos: this.plans.cuposMensajeria(plan, sus.numEspecialistas),
        funciones: this.plans.getPlan(plan).funciones,
        trialDiasRestantes,
        metodoUltimos4: sus.metodoUltimos4 ?? null,
        proximoCobro: sus.proximoCobro ?? null,
        ultimoCobro: cobros[0] ?? null,
        cobros,
        bloqueado,
        motivoBloqueo: bloqueado ? estado : null,
        limites: {
          especialistas: this.plans.cupoEspecialistas(plan, sus.numEspecialistas),
          maxSucursales: Number.isFinite(max) ? max : null,
          modulos: this.plans.modulosPermitidos(plan),
        },
        uso: {
          especialistas: Number(usoEspecialistas),
          sucursales: Number(usoSucursales),
        },
      };
    });
  }

  /**
   * Cambia el plan y/o el nº de especialistas pagados (Plan-Pagos FASE-09).
   * El **límite nuevo aplica de inmediato** (FASE-08 lo lee de la suscripción);
   * el **monto nuevo se cobra en el próximo ciclo** (sin prorrateo — mejora futura).
   * Valida: el plan admite las sucursales actuales y el cupo no baja por debajo
   * de los especialistas activos.
   */
  async cambiarPlan(
    ctx: TenantContext,
    nuevoPlan?: PlanSuscripcion,
    nuevoNum?: number,
  ): Promise<ResumenSuscripcion> {
    await runInTenantTx(ctx, async (tx) => {
      const [sus] = await tx
        .select({ plan: suscripcion.plan, num: suscripcion.numEspecialistas })
        .from(suscripcion)
        .where(eq(suscripcion.negocioId, ctx.negocioId))
        .limit(1);
      if (!sus) throw new NotFoundException('Suscripción no encontrada.');

      const plan = nuevoPlan ?? (sus.plan as PlanSuscripcion);
      const num = nuevoNum ?? sus.num;

      const [{ c: numSucursales }] = await tx.select({ c: count() }).from(sucursal);
      if (!this.plans.permiteSucursales(plan, numSucursales)) {
        throw new BadRequestException(
          `El plan ${plan} admite hasta ${this.plans.maxSucursales(plan)} sucursal(es); el negocio tiene ${numSucursales}.`,
        );
      }

      const [{ c: activos }] = await tx
        .select({ c: count() })
        .from(especialista)
        .where(eq(especialista.activo, true));
      const cupo = this.plans.cupoEspecialistas(plan, num);
      if (cupo < activos) {
        throw new BadRequestException(
          `No puedes bajar a ${cupo} especialistas: tienes ${activos} activos. Desactiva algunos primero.`,
        );
      }

      await tx
        .update(suscripcion)
        .set({ plan, numEspecialistas: num, actualizadoEn: new Date() })
        .where(eq(suscripcion.negocioId, ctx.negocioId));
    });
    return this.getResumen(ctx);
  }
}
