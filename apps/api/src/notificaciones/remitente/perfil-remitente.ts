import type { EventoPlantilla } from '@orkalis/shared';

/** Eventos con plantilla WhatsApp en el perfil (los del panel; el OTP se retiró). */
export type EventoWhatsapp = EventoPlantilla;

/**
 * Perfil de remitente por negocio (D6, costura ISV-ready). Los adaptadores
 * reciben este perfil y de aquí sacan credenciales y remitentes; **nunca leen
 * el env directamente**. En v1 todos los negocios resuelven al perfil
 * `plataforma` (marca Orkalis); el track ISV (FASE-11) añade perfiles `propio`
 * con subcuenta Twilio por negocio.
 */
export interface PerfilRemitente {
  negocioId: string;
  modo: 'plataforma' | 'propio';
  /** Cuenta madre (plataforma). */
  accountSid?: string;
  /** Subcuenta del negocio (modo 'propio', FASE-11). Si está, prevalece sobre accountSid. */
  subcuentaSid?: string;
  /** Auth token de la cuenta/subcuenta que envía. */
  authToken?: string;
  /** Messaging Service (pooling/entregabilidad); preferido sobre smsFrom. */
  messagingServiceSid?: string;
  /** Número SMS E.164 (fallback si no hay Messaging Service). */
  smsFrom?: string;
  /** Sender de WhatsApp (E.164, sin el prefijo 'whatsapp:'). */
  whatsappFrom?: string;
  /** WhatsApp Business Account id (marca propia, FASE-11). */
  wabaId?: string;
  /**
   * Content SIDs de las plantillas WhatsApp aprobadas del remitente, por evento
   * (AM-3). Son el **default de plataforma**: la fila de `plantilla_mensaje` del
   * negocio, si existe, prevalece sobre esto.
   */
  waTemplates?: Partial<Record<EventoWhatsapp, string>>;
}
