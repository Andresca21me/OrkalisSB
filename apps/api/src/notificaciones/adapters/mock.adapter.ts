import { Logger } from '@nestjs/common';
import type { Canal, MensajeSalida, NotificationSender, ResultadoEnvio } from '../notification-sender.port';
import type { PerfilRemitente } from '../remitente/perfil-remitente';

/**
 * Adaptador MOCK (Plan-Mensajeria FASE-01): no envía nada real; loguea (dev) y
 * guarda lo "enviado" para inspección en pruebas. `soporta` devuelve `true` para
 * todos los canales, así que se registra SIEMPRE al final de la lista como
 * fallback cuando faltan claves del proveedor de ese canal.
 */
export class MockAdapter implements NotificationSender {
  readonly proveedor = 'mock';
  private readonly logger = new Logger('MockNotificaciones');
  readonly enviados: { canal: Canal; to: string; contenido: string; modo: string }[] = [];

  soporta(_canal: Canal): boolean {
    return true;
  }

  async enviar(mensaje: MensajeSalida, perfil: PerfilRemitente): Promise<ResultadoEnvio> {
    const contenido =
      mensaje.cuerpo ??
      (mensaje.plantillaContentSid
        ? `[plantilla ${mensaje.plantillaContentSid} ${JSON.stringify(mensaje.variables ?? {})}]`
        : '');
    this.enviados.push({ canal: mensaje.canal, to: mensaje.to, contenido, modo: perfil.modo });
    this.logger.log(`[${mensaje.canal} mock] → ${mensaje.to}: ${contenido}`);
    return { proveedorId: `mock-${this.enviados.length}` };
  }
}
