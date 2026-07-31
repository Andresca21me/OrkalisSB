import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TokenAccionService } from './token-accion.service';

/**
 * Limpieza de `token_accion` (Plan-Correo E6): purga los tokens vencidos hace
 * más de 30 días. La ventana de gracia es deliberada — conservar la última
 * invitación un tiempo permite "Reenviar" recuperando el correo del destinatario
 * (el especialista no guarda su email hasta que activa la cuenta).
 */
@Injectable()
export class CorreoScheduler {
  private readonly logger = new Logger('CorreoScheduler');

  constructor(private readonly tokens: TokenAccionService) {}

  @Interval(6 * 60 * 60 * 1000)
  async purgar(): Promise<void> {
    try {
      const n = await this.tokens.limpiarVencidos();
      if (n) this.logger.log(`Tokens de acción purgados: ${n}`);
    } catch (e) {
      this.logger.warn(`No se pudo purgar token_accion: ${(e as Error).message}`);
    }
  }
}
