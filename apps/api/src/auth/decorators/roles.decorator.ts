import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '@orkalis/shared';

/** Roles autorizados para un endpoint (FASE-05). Usado por `RolesGuard`. */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolUsuario[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
