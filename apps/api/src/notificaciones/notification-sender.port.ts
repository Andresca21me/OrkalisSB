import type { PerfilRemitente } from './remitente/perfil-remitente';

/**
 * Puerto de notificaciones multicanal (Plan-Mensajeria FASE-01, ADR-007).
 * El dominio depende SOLO de esta interfaz, nunca de un proveedor concreto.
 * Cada adaptador declara qué canal soporta y recibe el `PerfilRemitente` del
 * negocio (D6) — no lee el entorno directamente.
 */
export type Canal = 'sms' | 'whatsapp' | 'email';

export interface MensajeSalida {
  canal: Canal;
  to: string;
  /** Texto libre (SMS, cuerpo de email, WhatsApp sin plantilla). */
  cuerpo?: string;
  /** WhatsApp: Content SID de una plantilla aprobada por Meta. */
  plantillaContentSid?: string;
  /** Variables de la plantilla (WhatsApp) — pares posicionales/nombrados. */
  variables?: Record<string, string>;
  /** Email: asunto. */
  asunto?: string;
}

export interface ResultadoEnvio {
  /** Id del mensaje en el proveedor (SID de Twilio, x-message-id de SendGrid…). */
  proveedorId: string;
}

export interface NotificationSender {
  soporta(canal: Canal): boolean;
  enviar(mensaje: MensajeSalida, perfil: PerfilRemitente): Promise<ResultadoEnvio>;
}

/** Token DI: array de adaptadores registrados (se despacha por `soporta`). */
export const NOTIFICATION_ADAPTERS = Symbol('NOTIFICATION_ADAPTERS');
