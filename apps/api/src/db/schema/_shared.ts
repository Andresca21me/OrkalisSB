import { customType, pgEnum } from 'drizzle-orm/pg-core';
import {
  EstadoCita,
  EstadoSuscripcion,
  MetodoPago,
  NivelConfig,
  OrigenCita,
  PerfilNegocio,
  PlanSuscripcion,
  RolUsuario,
  SplitType,
  TipoGasto,
  TipoProducto,
} from '@orkalis/shared';

/**
 * Helpers compartidos del esquema (FASE-03).
 *
 * Los enums nativos de Postgres se derivan de los enums de @orkalis/shared
 * para mantener UNA sola fuente de verdad de los valores de dominio (ADR-008).
 */

const values = <T extends Record<string, string>>(e: T): [string, ...string[]] =>
  Object.values(e) as [string, ...string[]];

// Enums de dominio (espejo de @orkalis/shared).
export const rolUsuarioEnum = pgEnum('rol_usuario', values(RolUsuario));
export const perfilNegocioEnum = pgEnum('perfil_negocio', values(PerfilNegocio));
export const planSuscripcionEnum = pgEnum('plan_suscripcion', values(PlanSuscripcion));
export const estadoCitaEnum = pgEnum('estado_cita', values(EstadoCita));
export const origenCitaEnum = pgEnum('origen_cita', values(OrigenCita));
export const estadoSuscripcionEnum = pgEnum('estado_suscripcion', values(EstadoSuscripcion));
export const tipoGastoEnum = pgEnum('tipo_gasto', values(TipoGasto));
export const tipoProductoEnum = pgEnum('tipo_producto', values(TipoProducto));
export const metodoPagoEnum = pgEnum('metodo_pago', values(MetodoPago));
export const splitTypeEnum = pgEnum('split_type', values(SplitType));
export const nivelConfigEnum = pgEnum('nivel_config', values(NivelConfig));

// Enums de soporte (no son dominio compartido front↔back).
export const tipoMovimientoEnum = pgEnum('tipo_movimiento', ['entrada', 'salida', 'ajuste']);
export const tipoCierreEnum = pgEnum('tipo_cierre', ['quincenal', 'mensual']);
export const canalMensajeriaEnum = pgEnum('canal_mensajeria', [
  'whatsapp_utility',
  'whatsapp_marketing',
  'sms',
  'email',
]);
/** Canal de transporte del outbox (espejo de `Canal` del puerto, FASE-02). */
export const canalEnvioEnum = pgEnum('canal_envio', ['sms', 'whatsapp', 'email']);
/** Eventos con plantilla personalizable por negocio (FASE-04, D5). */
export const eventoPlantillaEnum = pgEnum('evento_plantilla', [
  'confirmacion',
  'recordatorio',
  'aviso',
  'aviso_especialista',
  'marketing',
]);
/** Ciclo de vida de una fila del outbox (FASE-02). */
export const estadoMensajeEnum = pgEnum('estado_mensaje', [
  'pendiente',
  'enviando',
  'enviado',
  'entregado',
  'fallido',
  /** No se envió por cupo agotado (marketing, bloqueo duro D2). */
  'sin_cupo',
]);
export const estadoCobroEnum = pgEnum('estado_cobro', ['pendiente', 'pagado', 'fallido']);
/** Ventanas de recordatorio de cita (FASE-08). */
export const ventanaRecordatorioEnum = pgEnum('ventana_recordatorio', ['h24', 'h2', 'config']);

/**
 * Tipo de columna `tstzrange` (Postgres). Drizzle no lo trae nativo; se usa
 * para el rango de la cita y de la retención de franja (EXCLUDE, ADR-005).
 */
export const tstzrange = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tstzrange';
  },
});
