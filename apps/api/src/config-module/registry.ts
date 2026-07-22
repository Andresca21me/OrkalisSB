import { NivelConfig, PerfilNegocio } from '@orkalis/shared';
import type { DefinicionClave } from './config.types';

/**
 * REGISTRY de claves de configuración (FASE-06, ADR-002) — FUENTE DE VERDAD.
 *
 * Toda clave vive aquí (nunca claves sueltas). Cada una define tipo, nivel
 * mínimo de edición, defaults por vertical y descripción. La validación por
 * tipo y las reglas cruzadas viven en `validation.ts`.
 *
 * Banderas de módulo y parámetros financieros comparten ESTE mecanismo.
 */
const def = (d: DefinicionClave): DefinicionClave => d;

export const REGISTRY: Record<string, DefinicionClave> = {
  // ── Banderas de módulo (boolean) ──────────────────────────────────────────
  'modulo.inventario': def({
    clave: 'modulo.inventario',
    tipo: 'boolean',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: true, [PerfilNegocio.Barberia]: false },
    descripcion: 'Activa el módulo de inventario/productos.',
  }),
  'modulo.particion_por_especialista': def({
    clave: 'modulo.particion_por_especialista',
    tipo: 'boolean',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: true, [PerfilNegocio.Barberia]: true },
    descripcion: 'Reparte ganancias entre profesional y salón al completar.',
  }),
  'modulo.cierre_periodo': def({
    clave: 'modulo.cierre_periodo',
    tipo: 'boolean',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: false, [PerfilNegocio.Barberia]: false },
    descripcion: 'Habilita el cierre de período (quincenal/mensual).',
  }),
  'agendamiento.aprobacion_manual': def({
    clave: 'agendamiento.aprobacion_manual',
    tipo: 'boolean',
    nivelMinimoEdicion: NivelConfig.Negocio,
    // OFF por defecto → confirmación automática (Definición v1.2).
    defaults: { [PerfilNegocio.Salon]: false, [PerfilNegocio.Barberia]: false },
    descripcion: 'Exige aprobación manual de reservas públicas (default: OFF).',
  }),

  // ── Parámetros financieros (porcentaje / dinero) ───────────────────────────
  'finanzas.reparticion_profesional': def({
    clave: 'finanzas.reparticion_profesional',
    tipo: 'porcentaje',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 50, [PerfilNegocio.Barberia]: 50 },
    descripcion: '% de la atención para el profesional (prof + salón = 100).',
  }),
  'finanzas.reparticion_salon': def({
    clave: 'finanzas.reparticion_salon',
    tipo: 'porcentaje',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 50, [PerfilNegocio.Barberia]: 50 },
    descripcion: '% de la atención para el salón (prof + salón = 100).',
  }),
  'finanzas.deduccion_administrativa': def({
    clave: 'finanzas.deduccion_administrativa',
    tipo: 'porcentaje',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 0, [PerfilNegocio.Barberia]: 0 },
    descripcion: '% de deducción administrativa antes de repartir.',
  }),
  'finanzas.comision_bancaria': def({
    clave: 'finanzas.comision_bancaria',
    tipo: 'porcentaje',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 0, [PerfilNegocio.Barberia]: 0 },
    descripcion: '% de comisión por pago electrónico (p. ej. transferencia).',
  }),
  'finanzas.tarifa_cliente_profesional': def({
    clave: 'finanzas.tarifa_cliente_profesional',
    tipo: 'porcentaje',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 0, [PerfilNegocio.Barberia]: 0 },
    descripcion: '% adicional que el cliente paga al profesional.',
  }),

  // ── Parámetros de agendamiento (numero / duracion) ─────────────────────────
  'agendamiento.antelacion_cancelacion_horas': def({
    clave: 'agendamiento.antelacion_cancelacion_horas',
    tipo: 'numero',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 2, [PerfilNegocio.Barberia]: 2 },
    descripcion: 'Horas mínimas de antelación para cancelar una reserva.',
  }),
  'agendamiento.recordatorio_24h': def({
    clave: 'agendamiento.recordatorio_24h',
    tipo: 'boolean',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: true, [PerfilNegocio.Barberia]: true },
    descripcion: 'Enviar recordatorio 24 horas antes de la cita.',
  }),
  'agendamiento.recordatorio_2h': def({
    clave: 'agendamiento.recordatorio_2h',
    tipo: 'boolean',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: true, [PerfilNegocio.Barberia]: true },
    descripcion: 'Enviar recordatorio 2 horas antes de la cita.',
  }),
  'agendamiento.ventana_recordatorio_horas': def({
    clave: 'agendamiento.ventana_recordatorio_horas',
    tipo: 'numero',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 24, [PerfilNegocio.Barberia]: 24 },
    descripcion: 'Horas antes de la cita para enviar el recordatorio.',
  }),
  'agendamiento.duracion_retencion_min': def({
    clave: 'agendamiento.duracion_retencion_min',
    tipo: 'duracion',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 10, [PerfilNegocio.Barberia]: 10 },
    descripcion: 'TTL (min) del bloqueo temporal de franja al reservar.',
  }),
};

/** Lista de todas las claves del registry. */
export const CLAVES = Object.keys(REGISTRY);

/** Devuelve la definición de una clave o `undefined` si no existe. */
export function getDefinicion(clave: string): DefinicionClave | undefined {
  return REGISTRY[clave];
}
