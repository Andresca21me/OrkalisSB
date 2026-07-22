import { Body, Controller, Delete, Get, Header, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RolUsuario } from '@orkalis/shared';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { MarcaService, NegocioService } from './negocio.service';
import { CambiarPerfilDto, LogoNegocioDto, MarcaNegocioDto, OnboardingDto } from './dto/negocio.dto';

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


/**
 * Marca del negocio (branding dinámico): descripción, color primario y logo.
 *
 * El GET del logo va en un controlador **aparte y público** por la misma razón
 * que la foto del especialista: el enlace de reserva no tiene sesión, y el
 * `RolesGuard` no consulta `@Public()`, así que dentro de un controlador con
 * `@Roles` devolvería 403.
 */
@Controller('negocios')
@Roles(RolUsuario.Admin)
export class MarcaController {
  constructor(private readonly marca: MarcaService) {}

  /** Marca actual, para pintar el formulario de configuración. */
  @Get('marca')
  obtener(@CurrentTenant() ctx: TenantContext) {
    return this.marca.marcaDe(ctx.negocioId);
  }

  @Patch('marca')
  @HttpCode(204)
  async actualizar(@CurrentTenant() ctx: TenantContext, @Body() dto: MarcaNegocioDto): Promise<void> {
    await this.marca.actualizar(ctx, dto);
  }

  @Put('logo')
  guardarLogo(@CurrentTenant() ctx: TenantContext, @Body() dto: LogoNegocioDto) {
    return this.marca.guardarLogo(ctx, dto.dataUrl);
  }

  @Delete('logo')
  @HttpCode(204)
  async borrarLogo(@CurrentTenant() ctx: TenantContext): Promise<void> {
    await this.marca.borrarLogo(ctx);
  }
}

/** Logo del negocio, público: lo pinta la reserva del cliente final. */
@Public()
@Controller('negocios')
export class LogoNegocioController {
  constructor(private readonly marca: MarcaService) {}

  @Get(':id/logo')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  // Helmet marca todo como `same-origin` y la web vive en otro dominio que la
  // API: sin esto el navegador descarga la imagen y la descarta sin pintarla.
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async logo(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const l = await this.marca.leerLogo(id);
    if (!l) throw new NotFoundException('Sin logo.');
    res.setHeader('Content-Type', l.mime);
    res.setHeader('ETag', `"${l.actualizadoEn.getTime()}"`);
    res.end(l.datos);
  }
}
