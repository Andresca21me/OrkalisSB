import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import type { PerfilRemitente } from './perfil-remitente';

/**
 * Resuelve el `PerfilRemitente` de un negocio (D6, costura ISV-ready).
 *
 * **v1:** devuelve SIEMPRE el perfil `plataforma`, construido desde las
 * `TWILIO_*` del entorno (marca Orkalis para todos los negocios). Cachea por
 * `negocioId`.
 *
 * **Punto de extensión (FASE-11):** aquí se consultará `mensajeria_remitente`;
 * si el negocio tiene una fila `modo='propio'` (subcuenta + WABA propios) se usa
 * esa; si no, fallback al perfil plataforma. Al cambiar el perfil de un negocio
 * se invalida su caché con `invalidar(negocioId)`.
 */
@Injectable()
export class RemitenteResolver {
  private readonly cache = new Map<string, PerfilRemitente>();

  constructor(private readonly config: ConfigService<Env, true>) {}

  resolver(negocioId: string): PerfilRemitente {
    const hit = this.cache.get(negocioId);
    if (hit) return hit;
    const perfil = this.perfilPlataforma(negocioId);
    this.cache.set(negocioId, perfil);
    return perfil;
  }

  invalidar(negocioId?: string): void {
    if (negocioId) this.cache.delete(negocioId);
    else this.cache.clear();
  }

  private perfilPlataforma(negocioId: string): PerfilRemitente {
    const g = <K extends keyof Env>(k: K): Env[K] => this.config.get(k, { infer: true });
    return {
      negocioId,
      modo: 'plataforma',
      accountSid: g('TWILIO_ACCOUNT_SID'),
      authToken: g('TWILIO_AUTH_TOKEN'),
      messagingServiceSid: g('TWILIO_MESSAGING_SERVICE_SID'),
      smsFrom: g('TWILIO_FROM_NUMBER'),
      whatsappFrom: g('TWILIO_WHATSAPP_FROM'),
      verifyServiceSid: g('TWILIO_VERIFY_SERVICE_SID'),
    };
  }
}
