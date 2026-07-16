import { SetMetadata } from '@nestjs/common';

/**
 * Marca un endpoint como alcanzable AUNQUE la suscripción esté bloqueada
 * (Plan-Pagos FASE-11). Es la "sesión limitada" de recuperación: ver la
 * facturación y pagar para reactivar la cuenta. El resto de endpoints de tenant
 * siguen devolviendo 403 `SUSCRIPCION_BLOQUEADA`.
 */
export const ACCESO_FACTURACION_KEY = 'accesoFacturacion';
export const AccesoFacturacion = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ACCESO_FACTURACION_KEY, true);
