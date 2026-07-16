import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean } from 'class-validator';
import { Body, Controller, Get, HttpCode, Param, Put } from '@nestjs/common';
import { RolUsuario } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { HorarioService } from './horario.service';

/** Cuerpo con los 7 días (domingo→sábado) como booleanos. */
export class DiasDto {
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @IsBoolean({ each: true })
  dias!: boolean[];
}

/**
 * Configuración de horario (solo Admin): días laborables por sucursal y
 * activación de servicios por día. Ver HorarioService.
 */
@Controller('agenda/horario')
@Roles(RolUsuario.Admin)
export class HorarioController {
  constructor(private readonly s: HorarioService) {}

  @Get()
  config(@CurrentTenant() ctx: TenantContext) {
    return this.s.getConfig(ctx);
  }

  @Put('sucursal/:id')
  @HttpCode(204)
  async diasSucursal(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: DiasDto,
  ): Promise<void> {
    await this.s.setDiasLaborables(ctx, id, dto.dias);
  }

  @Put('servicio/:id')
  @HttpCode(204)
  async diasServicio(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: DiasDto,
  ): Promise<void> {
    await this.s.setServicioDia(ctx, id, dto.dias);
  }
}
