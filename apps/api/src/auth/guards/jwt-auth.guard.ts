import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { TenantContext } from '../../db/tenant-context';

/**
 * Guard global de acceso (FASE-05). Exige access token válido salvo en
 * endpoints marcados `@Public()`. Al validar, copia el `TenantContext`
 * (devuelto por la estrategia) a `req.tenantContext` para `@CurrentTenant()`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = TenantContext>(err: unknown, user: TUser, info: unknown, context: ExecutionContext): TUser {
    const ctx = super.handleRequest(err, user, info, context) as TenantContext;
    const req = context.switchToHttp().getRequest<Request>();
    req.tenantContext = ctx;
    return ctx as TUser;
  }
}
