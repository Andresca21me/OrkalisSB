import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { RolUsuario } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccesoFacturacion } from '../auth/decorators/acceso-facturacion.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { PagoSuscripcionService } from './pago-suscripcion.service';
import { CambiarSuscripcionDto, MetodoPagoDto, PagarDto, PreviewCambioDto } from './dto/pago-suscripcion.dto';

/**
 * Pago y cambios de la suscripción del propio negocio (Plan-Pagos FASE-05/09).
 * Solo el admin. Convive con `GET /suscripcion` (negocio).
 */
@Controller('suscripcion')
@Roles(RolUsuario.Admin)
export class PagoSuscripcionController {
  constructor(private readonly pago: PagoSuscripcionService) {}

  /** Guarda el método de pago (sin cobrar). Alcanzable con la cuenta bloqueada. */
  @Post('metodo-pago')
  @AccesoFacturacion()
  @HttpCode(200)
  registrarMetodo(@CurrentTenant() ctx: TenantContext, @Body() dto: MetodoPagoDto) {
    return this.pago.registrarMetodo(ctx.negocioId, dto);
  }

  /** Primer pago (tarjeta presente) → activa la cuenta. Recuperación (FASE-11). */
  @Post('pagar')
  @AccesoFacturacion()
  @HttpCode(200)
  pagar(@CurrentTenant() ctx: TenantContext, @Body() dto: PagarDto) {
    return this.pago.pagar(ctx.negocioId, dto);
  }

  /** Previsualiza un cambio de plan/cupo (clasifica y calcula montos). */
  @Post('cambiar/preview')
  @HttpCode(200)
  previewCambio(@CurrentTenant() ctx: TenantContext, @Body() dto: PreviewCambioDto) {
    return this.pago.previewCambio(ctx.negocioId, dto.plan, dto.numEspecialistas);
  }

  /** Aplica el cambio (cobra el prorrateo si es una subida en cuenta activa). */
  @Post('cambiar')
  @HttpCode(200)
  cambiar(@CurrentTenant() ctx: TenantContext, @Body() dto: CambiarSuscripcionDto) {
    return this.pago.cambiar(ctx.negocioId, dto);
  }
}
