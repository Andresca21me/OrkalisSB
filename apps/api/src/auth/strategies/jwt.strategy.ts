import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../../config/env.validation';
import type { AccessTokenPayload } from '../auth.types';
import type { TenantContext } from '../../db/tenant-context';

/**
 * Estrategia del ACCESS token (FASE-05). Valida la firma y devuelve el
 * `TenantContext` que Passport deja en `req.user` (y el guard copia a
 * `req.tenantContext`). El bloqueo por estado de suscripción lo aplica
 * `SuscripcionAccesoGuard` por petición (FASE-11), que puede eximir los
 * endpoints de facturación.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  validate(payload: AccessTokenPayload): TenantContext {
    if (payload.tipo !== 'access') {
      throw new UnauthorizedException('Token inválido.');
    }
    return {
      negocioId: payload.negocio_id,
      sucursalIds: payload.sucursal_ids,
      rol: payload.rol,
      usuarioId: payload.sub,
    };
  }
}
