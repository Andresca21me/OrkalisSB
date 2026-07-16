import { Body, Controller, Get, Patch } from '@nestjs/common';
import { RolUsuario } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccesoFacturacion } from '../auth/decorators/acceso-facturacion.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { SuscripcionService } from './suscripcion.service';
import { CambiarPlanDto } from './dto/negocio.dto';

@Controller('suscripcion')
@Roles(RolUsuario.Admin)
export class SuscripcionController {
  constructor(private readonly suscripcionService: SuscripcionService) {}

  /**
   * Resumen: plan, estado, cargo, cupos, funciones, método de pago, próximo
   * cobro, historial y motivo de bloqueo. `@AccesoFacturacion()`: la pantalla
   * de facturación debe poder leerlo aún con la cuenta bloqueada (FASE-11).
   */
  @Get()
  @AccesoFacturacion()
  getResumen(@CurrentTenant() ctx: TenantContext) {
    return this.suscripcionService.getResumen(ctx);
  }

  /** Catálogo de planes (precios y funciones) para la comparación en la UI. */
  @Get('planes')
  @AccesoFacturacion()
  planes() {
    return this.suscripcionService.catalogoPlanes();
  }

  /** Cambia el plan (con gating de sucursales). */
  @Patch('plan')
  cambiarPlan(@CurrentTenant() ctx: TenantContext, @Body() dto: CambiarPlanDto) {
    return this.suscripcionService.cambiarPlan(ctx, dto.plan, dto.numEspecialistas);
  }
}
