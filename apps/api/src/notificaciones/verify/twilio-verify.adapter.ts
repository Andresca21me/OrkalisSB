import { Logger } from '@nestjs/common';
import type { VerifyPort } from './verify.port';
import type { PerfilRemitente } from '../remitente/perfil-remitente';
import { aE164Colombia } from '../phone';
import { credencialesDe, getTwilioClient } from '../adapters/twilio-client';

/**
 * Adaptador Twilio Verify (Plan-Mensajeria FASE-01). Usa el `verifyServiceSid`
 * del perfil. Twilio gestiona el código (no lo persistimos); nosotros solo
 * arrancamos y comprobamos.
 */
export class TwilioVerifyAdapter implements VerifyPort {
  private readonly logger = new Logger('TwilioVerify');

  async start(to: string, canal: 'sms' | 'whatsapp', perfil: PerfilRemitente): Promise<void> {
    const service = this.service(perfil);
    const { sid, token } = credencialesDe(perfil);
    const client = await getTwilioClient(sid, token);
    await client.verify.v2.services(service).verifications.create({ to: aE164Colombia(to), channel: canal });
    this.logger.log(`Verify iniciada (${canal}) → ${aE164Colombia(to)}`);
  }

  async check(to: string, codigo: string, perfil: PerfilRemitente): Promise<boolean> {
    const service = this.service(perfil);
    const { sid, token } = credencialesDe(perfil);
    const client = await getTwilioClient(sid, token);
    const res = await client.verify.v2.services(service).verificationChecks.create({ to: aE164Colombia(to), code: codigo });
    return res.status === 'approved';
  }

  private service(perfil: PerfilRemitente): string {
    if (!perfil.verifyServiceSid) throw new Error('Perfil de remitente sin verifyServiceSid.');
    return perfil.verifyServiceSid;
  }
}
