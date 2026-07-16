import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { RolUsuario } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { EquipoService } from './equipo.service';
import {
  AsignarSucursalesDto,
  CrearEspecialistaDto,
  DisponibilidadDto,
  EditarEspecialistaDto,
} from './dto/negocio.dto';

@Controller('especialistas')
@Roles(RolUsuario.Admin)
export class EquipoController {
  constructor(private readonly equipoService: EquipoService) {}

  @Get()
  @Roles(RolUsuario.Admin, RolUsuario.Recepcionista, RolUsuario.Especialista)
  listar(@CurrentTenant() ctx: TenantContext) {
    return this.equipoService.listar(ctx);
  }

  /** Ganancias del especialista en un período (FASE-10, H3). */
  @Get(':id/ganancias')
  @Roles(RolUsuario.Admin, RolUsuario.Especialista)
  ganancias(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.equipoService.ganancias(ctx, id, new Date(desde), new Date(hasta));
  }

  @Post()
  crear(@CurrentTenant() ctx: TenantContext, @Body() dto: CrearEspecialistaDto) {
    const credenciales =
      dto.email && dto.password ? { email: dto.email, password: dto.password } : undefined;
    return this.equipoService.crear(ctx, dto.nombre, dto.especialidad, dto.sucursalIds ?? [], credenciales);
  }

  @Patch(':id')
  editar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string, @Body() dto: EditarEspecialistaDto) {
    return this.equipoService.editar(ctx, id, dto);
  }

  /** El propio especialista alterna su disponibilidad (FASE-10). */
  @Patch(':id/disponibilidad')
  @Roles(RolUsuario.Admin, RolUsuario.Especialista, RolUsuario.Recepcionista)
  disponibilidad(@CurrentTenant() ctx: TenantContext, @Param('id') id: string, @Body() dto: DisponibilidadDto) {
    return this.equipoService.editar(ctx, id, { disponible: dto.disponible });
  }

  @Put(':id/sucursales')
  @HttpCode(204)
  async asignar(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: AsignarSucursalesDto,
  ): Promise<void> {
    await this.equipoService.asignarSucursales(ctx, id, dto.sucursalIds);
  }

  /** Baja lógica (conserva historial). */
  @Delete(':id')
  @HttpCode(204)
  async darDeBaja(@CurrentTenant() ctx: TenantContext, @Param('id') id: string): Promise<void> {
    await this.equipoService.darDeBaja(ctx, id);
  }

  @Post(':id/reactivar')
  @HttpCode(204)
  async reactivar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string): Promise<void> {
    await this.equipoService.reactivar(ctx, id);
  }
}
