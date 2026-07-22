import type { PerfilRemitente } from '../remitente/perfil-remitente';

/**
 * Fábrica/caché del cliente Twilio por credencial (Plan-Mensajeria FASE-01).
 * SMS, WhatsApp y Verify comparten cliente para una misma cuenta/subcuenta. El
 * SDK `twilio` se importa de forma perezosa (dependencia opcional en dev/tests).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwilioClient = any;

const cache = new Map<string, TwilioClient>();

/** Credenciales efectivas del perfil: subcuenta (propio) o cuenta madre (plataforma). */
export function credencialesDe(perfil: PerfilRemitente): { sid: string; token: string } {
  const sid = perfil.subcuentaSid ?? perfil.accountSid;
  const token = perfil.authToken;
  if (!sid || !token) {
    throw new Error('Perfil de remitente sin credenciales Twilio (accountSid/authToken).');
  }
  return { sid, token };
}

export async function getTwilioClient(sid: string, token: string): Promise<TwilioClient> {
  const existente = cache.get(sid);
  if (existente) return existente;
  const especificador = 'twilio';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import(especificador).catch(() => {
    throw new Error('El paquete "twilio" no está instalado.');
  });
  const twilio = mod.default ?? mod;
  const client = twilio(sid, token);
  cache.set(sid, client);
  return client;
}
