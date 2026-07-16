import { Controller, Get } from '@nestjs/common';
import { RolUsuario } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { CuposService, type CanalCupo, type EstadoCupo } from './cupos.service';

const CANALES: CanalCupo[] = ['whatsapp_utility', 'whatsapp_marketing', 'sms', 'email'];

/** Exposición HTTP de notificaciones (FASE-09, H5). Hoy: cupos de mensajería. */
@Controller('notificaciones')
@Roles(RolUsuario.Admin)
export class NotificacionesController {
  constructor(private readonly cupos: CuposService) {}

  /** Consumo/cupo de cada canal en el período actual (ADR-009). */
  @Get('cupos')
  getCupos(@CurrentTenant() ctx: TenantContext): Promise<EstadoCupo[]> {
    return Promise.all(CANALES.map((c) => this.cupos.verificar(ctx.negocioId, c)));
  }
}
