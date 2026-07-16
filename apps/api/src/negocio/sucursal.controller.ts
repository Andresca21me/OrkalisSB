import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RolUsuario } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { SucursalService } from './sucursal.service';
import { CrearSucursalDto, EditarSucursalDto, EstadoSucursalDto } from './dto/negocio.dto';

@Controller('sucursales')
@Roles(RolUsuario.Admin)
export class SucursalController {
  constructor(private readonly sucursalService: SucursalService) {}

  @Get()
  @Roles(RolUsuario.Admin, RolUsuario.Recepcionista, RolUsuario.Especialista)
  listar(@CurrentTenant() ctx: TenantContext) {
    return this.sucursalService.listar(ctx);
  }

  @Post()
  crear(@CurrentTenant() ctx: TenantContext, @Body() dto: CrearSucursalDto) {
    return this.sucursalService.crear(ctx, dto.nombre, dto.clonarDeSucursalId);
  }

  @Patch(':id')
  editar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string, @Body() dto: EditarSucursalDto) {
    return this.sucursalService.editar(ctx, id, dto.nombre);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: EstadoSucursalDto,
  ) {
    return this.sucursalService.cambiarEstado(ctx, id, dto.activa);
  }
}
