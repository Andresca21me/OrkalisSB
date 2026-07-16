/**
 * Puerto de notificaciones (FASE-11, ADR-007) — patrón hexagonal.
 * El dominio depende SOLO de esta interfaz, nunca de un proveedor concreto.
 */
export interface NotificationSender {
  enviarSms(to: string, mensaje: string): Promise<void>;
  enviarEmail?(to: string, asunto: string, cuerpo: string): Promise<void>;
}

/** Token de inyección del adaptador activo. */
export const NOTIFICATION_SENDER = Symbol('NOTIFICATION_SENDER');
