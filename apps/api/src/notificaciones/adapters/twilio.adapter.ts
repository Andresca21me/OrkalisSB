import { Logger } from '@nestjs/common';
import type { NotificationSender } from '../notification-sender.port';

/**
 * Adaptador Twilio SMS (FASE-11, ADR-007). Carga el SDK de forma perezosa para
 * no exigir el paquete cuando se usa el mock. Requiere claves en el entorno.
 */
export class TwilioAdapter implements NotificationSender {
  private readonly logger = new Logger('TwilioNotificaciones');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (!this.client) {
      // Import dinámico con especificador variable: 'twilio' es una dependencia
      // opcional (solo en producción); en dev se usa el MockAdapter.
      const especificador = 'twilio';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const twilio: any = await import(especificador).catch(() => {
        throw new Error('El paquete "twilio" no está instalado.');
      });
      this.client = (twilio.default ?? twilio)(this.accountSid, this.authToken);
    }
    return this.client;
  }

  async enviarSms(to: string, mensaje: string): Promise<void> {
    const client = await this.getClient();
    await client.messages.create({ to, from: this.fromNumber, body: mensaje });
    this.logger.log(`SMS enviado a ${to}`);
  }
}
