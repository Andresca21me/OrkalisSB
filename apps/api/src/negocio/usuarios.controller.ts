import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { RolUsuario } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto, EditarUsuarioDto } from './dto/negocio.dto';

/** CRUD de usuarios internos por rol (FASE-09, H6). Solo admin. */
@Controller('usuarios')
@Roles(RolUsuario.Admin)
export class UsuariosController {
  constructor(private readonly s: UsuariosService) {}

  @Get() listar(@CurrentTenant() ctx: TenantContext) {
    return this.s.listar(ctx);
  }

  @Post() crear(@CurrentTenant() ctx: TenantContext, @Body() dto: CrearUsuarioDto) {
    return this.s.crear(ctx, dto);
  }

  @Patch(':id') editar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string, @Body() dto: EditarUsuarioDto) {
    return this.s.editar(ctx, id, dto);
  }

  @Delete(':id') @HttpCode(204) desactivar(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.s.desactivar(ctx, id);
  }
}
