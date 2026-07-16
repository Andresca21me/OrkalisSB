import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { TenantContext } from '../../db/tenant-context';

// Augmentación: el JwtAuthGuard (FASE-05) deja el TenantContext en la request.
declare module 'express' {
  interface Request {
    tenantContext?: TenantContext;
  }
}

/**
 * Param decorator `@CurrentTenant()` (FASE-04/05).
 *
 * Extrae el `TenantContext` que dejó el `JwtAuthGuard` en la request a partir
 * de los claims del access token. Si no hay contexto, falla: ningún handler
 * que toca BD debe operar sin tenant.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext => {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.tenantContext) {
      throw new UnauthorizedException('Falta el contexto de tenant.');
    }
    return req.tenantContext;
  },
);
