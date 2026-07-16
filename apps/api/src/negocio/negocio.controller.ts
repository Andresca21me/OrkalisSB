import { Body, Controller, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { RolUsuario } from '@orkalis/shared';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { NegocioService } from './negocio.service';
import { CambiarPerfilDto, OnboardingDto } from './dto/negocio.dto';

@Controller('negocios')
export class NegocioController {
  constructor(private readonly negocioService: NegocioService) {}

  /** Alta self-service de un negocio (público: aún no hay usuario/tenant). */
  @Public()
  @Post()
  @HttpCode(201)
  onboard(@Body() dto: OnboardingDto) {
    return this.negocioService.onboard(dto);
  }

  /** Cambia el perfil del negocio sin borrar datos (solo admin). */
  @Roles(RolUsuario.Admin)
  @Patch(':id/perfil')
  @HttpCode(204)
  async cambiarPerfil(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') _id: string,
    @Body() dto: CambiarPerfilDto,
  ): Promise<void> {
    // El id de la URL es informativo; el negocio operado es el del token (RLS).
    await this.negocioService.cambiarPerfil(ctx, dto.perfil);
  }
}
