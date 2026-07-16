import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RolUsuario } from '@orkalis/shared';
import { AuthService, mensajeBloqueo } from '../auth.service';
import { ACCESO_FACTURACION_KEY } from '../decorators/acceso-facturacion.decorator';

/**
 * Guard de acceso por estado de suscripción (Plan-Pagos FASE-11). Corre tras
 * `JwtAuthGuard`/`RolesGuard` en cada petición autenticada de tenant:
 *  - rutas públicas / sin sesión → pasa (no hay `tenantContext`);
 *  - operador de plataforma → nunca se bloquea;
 *  - cuenta con acceso → pasa;
 *  - cuenta bloqueada → 403 `SUSCRIPCION_BLOQUEADA`, SALVO que el endpoint esté
 *    marcado `@AccesoFacturacion()` (sesión limitada para ver/pagar facturación).
 */
@Injectable()
export class SuscripcionAccesoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const tc = req.tenantContext;
    if (!tc) return true; // ruta pública o sin contexto de tenant
    if (tc.rol === RolUsuario.OperadorPlataforma) return true; // el operador no se bloquea

    const { bloqueado, motivo } = await this.auth.evaluarAcceso(tc.negocioId);
    if (!bloqueado || !motivo) return true;

    const exento = this.reflector.getAllAndOverride<boolean>(ACCESO_FACTURACION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (exento) return true;

    throw new ForbiddenException({
      codigo: 'SUSCRIPCION_BLOQUEADA',
      motivo,
      message: mensajeBloqueo(motivo),
    });
  }
}
