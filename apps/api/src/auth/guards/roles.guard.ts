import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RolUsuario } from '@orkalis/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard de RBAC por rol (FASE-05). Autoriza si el rol del usuario está en los
 * `@Roles(...)` del handler/clase. Sin `@Roles`, no restringe por rol.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requeridos || requeridos.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const rol = req.tenantContext?.rol;
    if (!rol || !requeridos.includes(rol as RolUsuario)) {
      throw new ForbiddenException('No tiene permisos para esta operación.');
    }
    return true;
  }
}
