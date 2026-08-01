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
    descripcion: '% de comisión del banco por pago con TARJETA (transferencia y Nequi no la generan).',
  }),
  'finanzas.tarifa_cliente_profesional': def({
    clave: 'finanzas.tarifa_cliente_profesional',
    tipo: 'porcentaje',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 0, [PerfilNegocio.Barberia]: 0 },
    descripcion: '% adicional que el cliente paga al profesional.',
  }),

  // ── Venta de productos (Plan-Inventario, D2) ───────────────────────────────
  // Solo se leen dentro de flujos ya gateados por `modulo.inventario`, así que
  // en un negocio sin el módulo son inertes: no hay que limpiarlas al apagarlo.
  'finanzas.comision_producto_tipo': def({
    clave: 'finanzas.comision_producto_tipo',
    tipo: 'enum',
    enumValores: ['porcentaje', 'valor_fijo'],
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: {
      [PerfilNegocio.Salon]: 'porcentaje',
      [PerfilNegocio.Barberia]: 'porcentaje',
    },
    descripcion: 'Cómo se calcula la comisión del especialista por vender un producto.',
  }),
  'finanzas.comision_producto_valor': def({
    clave: 'finanzas.comision_producto_valor',
    tipo: 'numero',
    nivelMinimoEdicion: NivelConfig.Negocio,
    // 0 = todo el ingreso del producto queda para el negocio. Es el default
    // porque reproduce exactamente el comportamiento anterior al módulo.
    defaults: { [PerfilNegocio.Salon]: 0, [PerfilNegocio.Barberia]: 0 },
    descripcion: '% sobre la venta, o monto fijo por unidad, según el tipo de comisión.',
  }),
  'inventario.permitir_stock_negativo': def({
    clave: 'inventario.permitir_stock_negativo',
    tipo: 'boolean',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: false, [PerfilNegocio.Barberia]: false },
    descripcion: 'Permite vender sin stock registrado (queda en negativo hasta regularizar).',
  }),

  // ── Parámetros de agendamiento (numero / duracion) ─────────────────────────
  'agendamiento.antelacion_cancelacion_horas': def({
    clave: 'agendamiento.antelacion_cancelacion_horas',
    tipo: 'numero',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 2, [PerfilNegocio.Barberia]: 2 },
    descripcion: 'Horas mínimas de antelación para cancelar una reserva.',
  }),
  // ── Canal por evento (Plan-Mensajeria FASE-05) ─────────────────────────────
  // 'auto' = usar WhatsApp si el negocio tiene sender, plantilla aprobada y
  // cupo; si falta cualquiera de las tres, cae a SMS solo. 'sms' fuerza SMS.
  'mensajeria.canal_confirmacion': def({
    clave: 'mensajeria.canal_confirmacion',
    tipo: 'enum',
    enumValores: ['auto', 'sms', 'whatsapp'],
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 'auto', [PerfilNegocio.Barberia]: 'auto' },
    descripcion: 'Canal preferido para la confirmación de reserva.',
  }),
  'mensajeria.canal_recordatorio': def({
    clave: 'mensajeria.canal_recordatorio',
    tipo: 'enum',
    enumValores: ['auto', 'sms', 'whatsapp'],
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 'auto', [PerfilNegocio.Barberia]: 'auto' },
    descripcion: 'Canal preferido para los recordatorios de cita.',
  }),
  'mensajeria.canal_aviso': def({
    clave: 'mensajeria.canal_aviso',
    tipo: 'enum',
    enumValores: ['auto', 'sms', 'whatsapp'],
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 'auto', [PerfilNegocio.Barberia]: 'auto' },
    descripcion: 'Canal preferido para los avisos de cancelación al cliente.',
  }),
  'mensajeria.canal_aviso_especialista': def({
    clave: 'mensajeria.canal_aviso_especialista',
    tipo: 'enum',
    enumValores: ['auto', 'sms', 'whatsapp'],
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 'auto', [PerfilNegocio.Barberia]: 'auto' },
    descripcion: 'Canal preferido para los avisos al especialista.',
  }),
  'mensajeria.canal_marketing': def({
    clave: 'mensajeria.canal_marketing',
    tipo: 'enum',
    enumValores: ['auto', 'sms', 'whatsapp'],
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: 'auto', [PerfilNegocio.Barberia]: 'auto' },
    descripcion: 'Canal preferido para las campañas de marketing.',
  }),
  // Las claves 'agendamiento.recordatorio_24h' y 'agendamiento.ventana_recordatorio_horas'
  // se retiraron: el único recordatorio del sistema es el de 2 horas. Las filas
  // que algún negocio hubiera guardado para ellas quedan huérfanas e inocuas.
  'agendamiento.recordatorio_2h': def({
    clave: 'agendamiento.recordatorio_2h',
    tipo: 'boolean',
    nivelMinimoEdicion: NivelConfig.Negocio,
    defaults: { [PerfilNegocio.Salon]: true, [PerfilNegocio.Barberia]: true },
    descripcion: 'Enviar recordatorio 2 horas antes de la cita.',
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
