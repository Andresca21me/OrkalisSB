import { Logger } from '@nestjs/common';
import type { NotificationSender } from '../notification-sender.port';

/**
 * Adaptador MOCK (FASE-11): no envía nada real; loguea (dev) y guarda lo
 * "enviado" para inspección en pruebas. Se usa cuando faltan claves del proveedor.
 */
export class MockAdapter implements NotificationSender {
  private readonly logger = new Logger('MockNotificaciones');
  readonly enviados: { tipo: 'sms' | 'email'; to: string; contenido: string }[] = [];

  async enviarSms(to: string, mensaje: string): Promise<void> {
    this.enviados.push({ tipo: 'sms', to, contenido: mensaje });
    this.logger.log(`[SMS mock] → ${to}: ${mensaje}`);
  }

  async enviarEmail(to: string, asunto: string, cuerpo: string): Promise<void> {
    this.enviados.push({ tipo: 'email', to, contenido: `${asunto} :: ${cuerpo}` });
    this.logger.log(`[Email mock] → ${to}: ${asunto}`);
  }
}
