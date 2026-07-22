import type { PerfilRemitente } from '../remitente/perfil-remitente';

/**
 * Puerto de verificación por código (Twilio Verify) — Plan-Mensajeria FASE-01.
 * Separado del envío de mensajes: Verify gestiona el código internamente (no lo
 * conocemos). Se usa para verificar el teléfono del especialista (FASE-06).
 */
export interface VerifyPort {
  /** Inicia una verificación (envía el código por el canal indicado). */
  start(to: string, canal: 'sms' | 'whatsapp', perfil: PerfilRemitente): Promise<void>;
  /** Comprueba el código; `true` si es correcto. */
  check(to: string, codigo: string, perfil: PerfilRemitente): Promise<boolean>;
}

export const VERIFY_PORT = Symbol('VERIFY_PORT');
