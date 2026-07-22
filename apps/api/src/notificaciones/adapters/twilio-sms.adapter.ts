import { Logger } from '@nestjs/common';
import type { Canal, MensajeSalida, NotificationSender, ResultadoEnvio } from '../notification-sender.port';
import type { PerfilRemitente } from '../remitente/perfil-remitente';
import { aE164Colombia } from '../phone';
import { credencialesDe, getTwilioClient } from './twilio-client';

/**
 * Adaptador Twilio SMS (Plan-Mensajeria FASE-01). Envía por el Messaging Service
 * del perfil (preferido) o, en su defecto, por el número `smsFrom`. Normaliza el
 * destino a E.164 (Twilio lo exige). Las credenciales salen del `PerfilRemitente`.
 */
export class TwilioSmsAdapter implements NotificationSender {
  private readonly logger = new Logger('TwilioSMS');

  constructor(private readonly statusCallbackUrl?: string) {}

  soporta(canal: Canal): boolean {
    return canal === 'sms';
  }

  async enviar(mensaje: MensajeSalida, perfil: PerfilRemitente): Promise<ResultadoEnvio> {
    const { sid, token } = credencialesDe(perfil);
    const client = await getTwilioClient(sid, token);
    const to = aE164Colombia(mensaje.to);
    const opts: Record<string, unknown> = { to, body: mensaje.cuerpo };
    if (perfil.messagingServiceSid) opts.messagingServiceSid = perfil.messagingServiceSid;
    else opts.from = perfil.smsFrom;
    if (this.statusCallbackUrl) opts.statusCallback = this.statusCallbackUrl;
    const msg = await client.messages.create(opts);
    this.logger.log(`SMS enviado a ${to} (${msg.sid})`);
    return { proveedorId: msg.sid };
  }
}
