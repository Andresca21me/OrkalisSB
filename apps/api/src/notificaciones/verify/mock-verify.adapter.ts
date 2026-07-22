import { Logger } from '@nestjs/common';
import type { VerifyPort } from './verify.port';

/** Código de prueba aceptado por el mock de Verify (dev/tests). */
export const CODIGO_VERIFY_MOCK = '123456';

/**
 * Mock de Twilio Verify (Plan-Mensajeria FASE-01). No envía nada; acepta el
 * código fijo `CODIGO_VERIFY_MOCK`. Se usa cuando faltan las claves de Verify.
 */
export class MockVerifyAdapter implements VerifyPort {
  private readonly logger = new Logger('MockVerify');

  async start(to: string, canal: 'sms' | 'whatsapp'): Promise<void> {
    this.logger.log(`[Verify mock] start ${canal} → ${to} (código de prueba: ${CODIGO_VERIFY_MOCK})`);
  }

  async check(_to: string, codigo: string): Promise<boolean> {
    return codigo === CODIGO_VERIFY_MOCK;
  }
}
