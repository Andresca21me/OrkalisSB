import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { RolUsuario } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { CuposService, type EstadoCupo } from './cupos.service';
import { AlertasService, type AlertaAdminDto } from './alertas.service';

/** Exposición HTTP de notificaciones (FASE-09, H5): cupos y avisos al admin. */
@Controller('notificaciones')
@Roles(RolUsuario.Admin)
export class NotificacionesController {
  constructor(
    private readonly cupos: CuposService,
    private readonly alertas: AlertasService,
  ) {}

  /** Consumo/cupo de cada canal en el ciclo de cobro vigente (ADR-009, D1). */
  @Get('cupos')
  getCupos(@CurrentTenant() ctx: TenantContext): Promise<EstadoCupo[]> {
    return this.cupos.verificarTodos(ctx.negocioId);
  }

  /** Avisos persistentes (sobreconsumo de cupos, FASE-03). */
  @Get('alertas')
  getAlertas(
    @CurrentTenant() ctx: TenantContext,
    @Query('sinLeer') sinLeer?: string,
  ): Promise<AlertaAdminDto[]> {
    return this.alertas.listar(ctx, sinLeer === 'true');
  }

  @Post('alertas/:id/leer')
  @HttpCode(204)
  async leer(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.alertas.marcarLeida(ctx, id);
  }
}
