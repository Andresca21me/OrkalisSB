import { Injectable } from '@nestjs/common';
import { PlanSuscripcion } from '@orkalis/shared';
import {
  DefinicionPlan,
  FuncionesPlan,
  MODULOS_AVANZADOS,
  MODULOS_POR_PLAN,
  PLANES,
  type CuposMensajeria,
} from './plan-registry';

/** Vista pública de un plan para la comparación en la UI (sin lógica interna). */
export interface PlanPublico {
  plan: PlanSuscripcion;
  precioBase: number;
  especialistasIncluidos: number;
  costoEspecialistaAdicional: number;
  /** Máximo de sucursales; `null` = ilimitado (evita Infinity en JSON). */
  maxSucursales: number | null;
  modulos: string[];
  funciones: Omit<FuncionesPlan, 'maxSucursales'>;
  cupos: CuposMensajeria;
}

/**
 * Lógica de facturación derivada del catálogo de planes (FASE-07, ADR-009).
 */
@Injectable()
export class PlanService {
  getPlan(plan: PlanSuscripcion): DefinicionPlan {
    return PLANES[plan];
  }

  /** Catálogo público de todos los planes (para la comparación en la UI). */
  catalogo(): PlanPublico[] {
    return Object.values(PlanSuscripcion).map((p) => {
      const def = PLANES[p];
      const { maxSucursales, smsRespaldo, marketing, reportes, fidelizacion, rolesPorUsuario, api } =
        def.funciones;
      return {
        plan: p,
        precioBase: def.precioBase,
        especialistasIncluidos: def.especialistasIncluidos,
        costoEspecialistaAdicional: def.costoEspecialistaAdicional,
        maxSucursales: Number.isFinite(maxSucursales) ? maxSucursales : null,
        modulos: this.modulosPermitidos(p),
        funciones: { smsRespaldo, marketing, reportes, fidelizacion, rolesPorUsuario, api },
        cupos: def.cuposBase,
      };
    });
  }

  /** Cargo mensual = base + max(0, nº − incluidos) × costo adicional. */
  calcularCargo(plan: PlanSuscripcion, numEspecialistas: number): number {
    const def = PLANES[plan];
    const extra = Math.max(0, numEspecialistas - def.especialistasIncluidos);
    return def.precioBase + extra * def.costoEspecialistaAdicional;
  }

  /** Nº máximo de sucursales del plan (Infinity = ilimitado). */
  maxSucursales(plan: PlanSuscripcion): number {
    return PLANES[plan].funciones.maxSucursales;
  }

  /** ¿El plan permite tener `cantidad` sucursales? */
  permiteSucursales(plan: PlanSuscripcion, cantidad: number): boolean {
    return cantidad <= PLANES[plan].funciones.maxSucursales;
  }

  /**
   * ¿El plan permite la clave de módulo dada? (Plan-Pagos FASE-01, ADR-P3).
   * Las claves que no son módulos avanzados (operativas) se permiten siempre;
   * los módulos avanzados dependen de `MODULOS_POR_PLAN`. Es el límite que el
   * `ModuloGate` cruzará con la config del negocio en FASE-08.
   */
  moduloPermitido(plan: PlanSuscripcion, clave: string): boolean {
    if (!MODULOS_AVANZADOS.includes(clave as (typeof MODULOS_AVANZADOS)[number])) return true;
    return MODULOS_POR_PLAN[plan].includes(clave);
  }

  /** Módulos avanzados que incluye el plan (para mostrar/gatear en la UI). */
  modulosPermitidos(plan: PlanSuscripcion): string[] {
    return [...MODULOS_POR_PLAN[plan]];
  }

  /**
   * Cupo efectivo de especialistas: el mayor entre los **pagados** en la
   * suscripción y los **incluidos** en el plan (el precio base ya incluye N).
   */
  cupoEspecialistas(plan: PlanSuscripcion, numPagados: number): number {
    return Math.max(numPagados, PLANES[plan].especialistasIncluidos);
  }

  /**
   * ¿Se puede agregar un especialista más sin exceder el cupo? Lo aplica
   * `equipo.crear` en FASE-08.
   */
  puedeAgregarEspecialista(numActuales: number, cupo: number): boolean {
    return numActuales < cupo;
  }

  /** Cupos de mensajería resueltos = base + extra por especialista adicional. */
  cuposMensajeria(plan: PlanSuscripcion, numEspecialistas: number): CuposMensajeria {
    const def = PLANES[plan];
    const extra = Math.max(0, numEspecialistas - def.especialistasIncluidos);
    return {
      whatsappUtility: def.cuposBase.whatsappUtility + extra * def.cuposPorEspecialista.whatsappUtility,
      whatsappMarketing:
        def.cuposBase.whatsappMarketing + extra * def.cuposPorEspecialista.whatsappMarketing,
      sms: def.cuposBase.sms + extra * def.cuposPorEspecialista.sms,
      email: def.cuposBase.email + extra * def.cuposPorEspecialista.email,
    };
  }
}
