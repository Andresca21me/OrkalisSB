import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Guard de alcance de sucursal (FASE-05, RF-014).
 *
 * Para operaciones sobre una sucursal concreta (identificada por `sucursalId`
 * en params, query o body), verifica que esté dentro del alcance del usuario
 * (`ctx.sucursalIds`). El admin consolidado (`sucursalIds === null`) ve todas
 * las sucursales de su negocio (RLS lo acota al negocio). Bloquea cruces.
 */
@Injectable()
export class SucursalScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ctx = req.tenantContext;
    if (!ctx) throw new ForbiddenException('Falta el contexto de tenant.');

    // Admin consolidado: sin restricción de sucursal (RLS acota al negocio).
    if (ctx.sucursalIds === null) return true;

    const sucursalId =
      (req.params?.sucursalId as string | undefined) ??
      (req.query?.sucursalId as string | undefined) ??
      (req.body?.sucursalId as string | undefined);

    // Sin sucursal explícita en la petición: no aplica este guard.
    if (!sucursalId) return true;

    if (!ctx.sucursalIds.includes(sucursalId)) {
      throw new ForbiddenException('Sucursal fuera de su alcance.');
    }
    return true;
  }
}
