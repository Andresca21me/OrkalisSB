import { Logger } from '@nestjs/common';
import type { NotificationSender } from '../notification-sender.port';

/**
 * Adaptador SendGrid email (FASE-11, opcional). SMS no soportado aquí (lo cubre
 * Twilio); este adaptador complementa el email. Carga el SDK perezosamente.
 */
export class SendgridAdapter implements NotificationSender {
  private readonly logger = new Logger('SendgridNotificaciones');

  constructor(
    private readonly apiKey: string,
    private readonly mailFrom: string,
  ) {}

  async enviarSms(): Promise<void> {
    throw new Error('SendGrid no envía SMS; use el adaptador de SMS.');
  }

  async enviarEmail(to: string, asunto: string, cuerpo: string): Promise<void> {
    const especificador = '@sendgrid/mail';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(especificador).catch(() => {
      throw new Error('El paquete "@sendgrid/mail" no está instalado.');
    });
    const sg = mod.default ?? mod;
    sg.setApiKey(this.apiKey);
    await sg.send({ to, from: this.mailFrom, subject: asunto, text: cuerpo });
    this.logger.log(`Email enviado a ${to}`);
  }
}
