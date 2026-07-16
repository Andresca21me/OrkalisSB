import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { MercadoPagoClient } from './mercadopago.client';

function fakeConfig(values: Record<string, unknown>): ConfigService<Env, true> {
  return { get: (k: string) => values[k] } as unknown as ConfigService<Env, true>;
}

/** Construye un header `x-signature` válido para los datos dados. */
function firmar(secret: string, dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

describe('MercadoPagoClient.verificarFirma', () => {
  const SECRET = 'mp_webhook_secret';
  const client = new MercadoPagoClient(
    fakeConfig({ MP_WEBHOOK_SECRET: SECRET, MP_ENV: 'sandbox' }),
  );
  const dataId = '123456789';
  const requestId = 'req-abc-123';
  const ts = '1700000000';

  it('acepta una firma válida', () => {
    const xSignature = firmar(SECRET, dataId, requestId, ts);
    expect(client.verificarFirma({ xSignature, xRequestId: requestId, dataId })).toBe(true);
  });

  it('rechaza si se manipula el data.id tras firmar', () => {
    const xSignature = firmar(SECRET, dataId, requestId, ts);
    expect(client.verificarFirma({ xSignature, xRequestId: requestId, dataId: '999' })).toBe(false);
  });

  it('rechaza una firma con v1 alterado', () => {
    const xSignature = `ts=${ts},v1=deadbeef`;
    expect(client.verificarFirma({ xSignature, xRequestId: requestId, dataId })).toBe(false);
  });

  it('rechaza si no hay secreto configurado', () => {
    const sinSecreto = new MercadoPagoClient(fakeConfig({ MP_ENV: 'sandbox' }));
    const xSignature = firmar(SECRET, dataId, requestId, ts);
    expect(sinSecreto.verificarFirma({ xSignature, xRequestId: requestId, dataId })).toBe(false);
  });

  it('en modo inactivo (sin access token) no está configurado', () => {
    expect(client.configurado).toBe(false);
  });
});
