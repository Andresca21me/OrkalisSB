import { Logger } from '@nestjs/common';
import type { Canal, MensajeSalida, NotificationSender, ResultadoEnvio } from '../notification-sender.port';
import type { PerfilRemitente } from '../remitente/perfil-remitente';
import { aE164Colombia } from '../phone';
import { credencialesDe, getTwilioClient } from './twilio-client';

/**
 * Adaptador Twilio WhatsApp (Plan-Mensajeria FASE-01). Usa una plantilla
 * aprobada por Meta (Content SID + variables) cuando viene en el mensaje; si no,
 * envía texto libre (solo válido dentro de la ventana de 24h de servicio). El
 * sender (`whatsapp:+…`) y las credenciales salen del `PerfilRemitente`.
 */
export class TwilioWhatsappAdapter implements NotificationSender {
  private readonly logger = new Logger('TwilioWhatsApp');

  constructor(private readonly statusCallbackUrl?: string) {}

  soporta(canal: Canal): boolean {
    return canal === 'whatsapp';
  }

  async enviar(mensaje: MensajeSalida, perfil: PerfilRemitente): Promise<ResultadoEnvio> {
    if (!perfil.whatsappFrom) throw new Error('Perfil de remitente sin whatsappFrom.');
    const { sid, token } = credencialesDe(perfil);
    const client = await getTwilioClient(sid, token);
    const to = `whatsapp:${aE164Colombia(mensaje.to)}`;
    const opts: Record<string, unknown> = { to, from: `whatsapp:${perfil.whatsappFrom}` };
    if (mensaje.plantillaContentSid) {
      opts.contentSid = mensaje.plantillaContentSid;
      if (mensaje.variables) opts.contentVariables = JSON.stringify(mensaje.variables);
    } else {
      opts.body = mensaje.cuerpo;
    }
    if (this.statusCallbackUrl) opts.statusCallback = this.statusCallbackUrl;
    const msg = await client.messages.create(opts);
    this.logger.log(`WhatsApp enviado a ${to} (${msg.sid})`);
    return { proveedorId: msg.sid };
  }
}
