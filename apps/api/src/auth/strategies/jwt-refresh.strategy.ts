import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { Env } from '../../config/env.validation';
import type { RefreshTokenPayload } from '../auth.types';

/**
 * Estrategia del REFRESH token (FASE-05). Valida la firma con el secreto de
 * refresh y adjunta el token crudo al payload (para que el servicio pueda
 * rotarlo/revocarlo). La verificación de revocación/reuso la hace el servicio.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_REFRESH_SECRET', { infer: true }),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshTokenPayload): RefreshTokenPayload {
    if (payload.tipo !== 'refresh') {
      throw new UnauthorizedException('Token de refresco inválido.');
    }
    return payload;
  }
}
