import { Logger } from '@nestjs/common';
import type { Canal, MensajeSalida, NotificationSender, ResultadoEnvio } from '../notification-sender.port';
import type { PerfilRemitente } from '../remitente/perfil-remitente';

/**
 * Adaptador SendGrid email (Plan-Mensajeria FASE-01, opcional). Carga el SDK
 * perezosamente. En v1 el remitente de correo es global (env); el
 * `PerfilRemitente` se recibe por uniformidad de la interfaz.
 */
export class SendgridEmailAdapter implements NotificationSender {
  readonly proveedor = 'sendgrid';
  private readonly logger = new Logger('SendgridEmail');

  constructor(
    private readonly apiKey: string,
    private readonly mailFrom: string,
  ) {}

  soporta(canal: Canal): boolean {
    return canal === 'email';
  }

  async enviar(mensaje: MensajeSalida, _perfil: PerfilRemitente): Promise<ResultadoEnvio> {
    const especificador = '@sendgrid/mail';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(especificador).catch(() => {
      throw new Error('El paquete "@sendgrid/mail" no está instalado.');
    });
    const sg = mod.default ?? mod;
    sg.setApiKey(this.apiKey);
    const [res] = await sg.send({
      to: mensaje.to,
      from: this.mailFrom,
      subject: mensaje.asunto ?? '',
      text: mensaje.cuerpo ?? '',
      ...(mensaje.html ? { html: mensaje.html } : {}),
    });
    this.logger.log(`Email enviado a ${mensaje.to}`);
    return { proveedorId: (res?.headers?.['x-message-id'] as string) ?? 'sendgrid' };
  }
}
