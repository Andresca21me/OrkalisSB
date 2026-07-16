import { PlanSuscripcion } from '@orkalis/shared';

/**
 * Catálogo de planes (FASE-07, ADR-009) — FUENTE DE VERDAD de facturación.
 * Vive en código, NO en BD ni editable por tenant. Precios en COP sin IVA.
 */

/** Cupos de mensajería por canal. */
export interface CuposMensajeria {
  whatsappUtility: number;
  whatsappMarketing: number;
  sms: number;
  email: number;
}

/** Funciones habilitadas por plan (matriz del ADR-009). */
export interface FuncionesPlan {
  smsRespaldo: boolean;
  marketing: boolean; // campañas WhatsApp/Email
  reportes: 'no' | 'basico' | 'avanzado';
  fidelizacion: boolean;
  rolesPorUsuario: boolean;
  api: boolean;
  /** Nº máximo de sucursales (Infinity = ilimitado). */
  maxSucursales: number;
}

export interface DefinicionPlan {
  plan: PlanSuscripcion;
  precioBase: number;
  especialistasIncluidos: number;
  costoEspecialistaAdicional: number;
  /** Cupos base (para los especialistas incluidos). */
  cuposBase: CuposMensajeria;
  /** Cupo adicional por cada especialista por encima de los incluidos. */
  cuposPorEspecialista: CuposMensajeria;
  funciones: FuncionesPlan;
}

/**
 * Módulos AVANZADOS gateados por plan (Plan-Pagos FASE-01, decisión de producto).
 * Son las banderas de módulo del REGISTRY de configuración que un plan puede o no
 * habilitar. Las claves de módulo NO listadas aquí (p. ej.
 * `agendamiento.aprobacion_manual`) están disponibles en TODOS los planes: son
 * operativas, no premium.
 */
export const MODULOS_AVANZADOS = [
  'modulo.inventario',
  'modulo.particion_por_especialista',
  'modulo.cierre_periodo',
] as const;

/**
 * Qué módulos avanzados incluye cada plan. Básico es la versión básica (agenda,
 * reservas, clientes/CRM); los tres módulos avanzados se desbloquean desde Pro.
 */
export const MODULOS_POR_PLAN: Record<PlanSuscripcion, readonly string[]> = {
  [PlanSuscripcion.Basico]: [],
  [PlanSuscripcion.Pro]: [...MODULOS_AVANZADOS],
  [PlanSuscripcion.Premium]: [...MODULOS_AVANZADOS],
  [PlanSuscripcion.Empresarial]: [...MODULOS_AVANZADOS],
};

export const PLANES: Record<PlanSuscripcion, DefinicionPlan> = {
  [PlanSuscripcion.Basico]: {
    plan: PlanSuscripcion.Basico,
    precioBase: 80000,
    especialistasIncluidos: 2,
    costoEspecialistaAdicional: 15000,
    cuposBase: { whatsappUtility: 600, whatsappMarketing: 80, sms: 40, email: 3000 },
    cuposPorEspecialista: { whatsappUtility: 200, whatsappMarketing: 25, sms: 15, email: 0 },
    funciones: {
      smsRespaldo: false,
      marketing: true, // "básico" en la matriz
      reportes: 'no',
      fidelizacion: false,
      rolesPorUsuario: false,
      api: false,
      maxSucursales: 1,
    },
  },
  [PlanSuscripcion.Pro]: {
    plan: PlanSuscripcion.Pro,
    precioBase: 130000,
    especialistasIncluidos: 2,
    costoEspecialistaAdicional: 18000,
    cuposBase: { whatsappUtility: 1500, whatsappMarketing: 250, sms: 120, email: 8000 },
    cuposPorEspecialista: { whatsappUtility: 350, whatsappMarketing: 60, sms: 30, email: 0 },
    funciones: {
      smsRespaldo: true,
      marketing: true,
      reportes: 'basico',
      fidelizacion: false,
      rolesPorUsuario: true,
      api: false,
      maxSucursales: 1,
    },
  },
  [PlanSuscripcion.Premium]: {
    plan: PlanSuscripcion.Premium,
    precioBase: 210000,
    especialistasIncluidos: 2,
    costoEspecialistaAdicional: 22000,
    cuposBase: { whatsappUtility: 3500, whatsappMarketing: 400, sms: 300, email: 20000 },
    cuposPorEspecialista: { whatsappUtility: 600, whatsappMarketing: 100, sms: 60, email: 0 },
    funciones: {
      smsRespaldo: true,
      marketing: true,
      reportes: 'avanzado',
      fidelizacion: true,
      rolesPorUsuario: true,
      api: true,
      maxSucursales: 2,
    },
  },
  [PlanSuscripcion.Empresarial]: {
    plan: PlanSuscripcion.Empresarial,
    precioBase: 720000,
    especialistasIncluidos: 15,
    costoEspecialistaAdicional: 25000,
    cuposBase: { whatsappUtility: 14000, whatsappMarketing: 1800, sms: 1200, email: 60000 },
    cuposPorEspecialista: { whatsappUtility: 800, whatsappMarketing: 120, sms: 80, email: 0 },
    funciones: {
      smsRespaldo: true,
      marketing: true,
      reportes: 'avanzado',
      fidelizacion: true,
      rolesPorUsuario: true,
      api: true,
      maxSucursales: Infinity,
    },
  },
};
