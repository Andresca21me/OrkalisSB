import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService, type RegistroResult } from './auth.service';
import { CredencialesService } from './credenciales.service';
import { LoginDto } from './dto/login.dto';
import {
  AltaVerificacionDto,
  CambiarPasswordDto,
  CambioEmailDto,
  OlvidoPasswordDto,
  ReenviarVerificacionDto,
  RestablecerPasswordDto,
  VerificarCorreoDto,
} from './dto/credenciales.dto';
import { RegistroDto } from './dto/registro.dto';
import { Public } from './decorators/public.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import type { RefreshTokenPayload, TokenPair } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly credenciales: CredencialesService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.authService.login(dto.email, dto.password);
  }

  /**
   * Alta pública de un negocio (Plan-Pagos FASE-03). Throttle por ser endpoint
   * público de creación; desde Plan-Correo E2 la barrera anti-abuso real es el
   * candado de verificación (sin enlace abierto no se crea nada), así que el
   * límite es holgado.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('registro')
  @HttpCode(201)
  registro(@Body() dto: RegistroDto): Promise<RegistroResult> {
    return this.authService.registrar(dto);
  }

  // ── Verificación de correo en el alta (Plan-Correo E2) ─────────────────────

  /** Paso 2 del wizard: manda el enlace de verificación. 409 si el correo ya tiene cuenta. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('alta/verificacion')
  @HttpCode(201)
  altaVerificacion(@Body() dto: AltaVerificacionDto): Promise<{ verificacionId: string }> {
    return this.credenciales.iniciarVerificacionAlta(dto.email, dto.nombre);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('alta/verificacion/reenviar')
  @HttpCode(204)
  async altaVerificacionReenviar(@Body() dto: ReenviarVerificacionDto): Promise<void> {
    await this.credenciales.reenviarVerificacionAlta(dto.verificacionId);
  }

  /** Polling del wizard mientras espera el clic en el correo (cada ~4 s). */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('alta/verificacion/:id')
  altaVerificacionEstado(@Param('id', ParseUUIDPipe) id: string): Promise<{ verificado: boolean }> {
    return this.credenciales.estadoVerificacionAlta(id);
  }

  /** Destino del enlace del correo (página pública /verificar-correo). */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verificar-correo')
  @HttpCode(200)
  verificarCorreo(@Body() dto: VerificarCorreoDto): Promise<{ ok: true; contexto: string }> {
    return this.credenciales.verificarCorreo(dto.token);
  }

  // ── Recuperación de contraseña (Plan-Correo E3) ────────────────────────────

  /** Siempre 204, exista o no el correo (anti-enumeración, D7). */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/olvido')
  @HttpCode(204)
  async passwordOlvido(@Body() dto: OlvidoPasswordDto): Promise<void> {
    await this.credenciales.olvidoPassword(dto.email);
  }

  /** La página /restablecer valida el enlace antes de mostrar el formulario. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('password/token/:token')
  passwordTokenValido(@Param('token') token: string): Promise<{ valido: boolean }> {
    return this.credenciales.validarTokenReset(token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/restablecer')
  @HttpCode(204)
  async passwordRestablecer(@Body() dto: RestablecerPasswordDto): Promise<void> {
    await this.credenciales.restablecerPassword(dto.token, dto.password);
  }

  /** Refresh: la estrategia 'jwt-refresh' valida el token del body. */
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() req: Request): Promise<TokenPair> {
    return this.authService.refresh(req.user as RefreshTokenPayload);
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request): Promise<void> {
    await this.authService.logout(req.user as RefreshTokenPayload);
  }

  @Get('me')
  me(@CurrentTenant() ctx: TenantContext) {
    return this.authService.me(ctx);
  }

  // ── Credenciales con sesión (Plan-Correo E4) — cualquier rol, sobre sí mismo ──

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/cambiar')
  @HttpCode(204)
  async passwordCambiar(@CurrentTenant() ctx: TenantContext, @Body() dto: CambiarPasswordDto): Promise<void> {
    await this.credenciales.cambiarPassword(ctx.usuarioId!, dto.passwordActual, dto.passwordNueva);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('email/cambio')
  @HttpCode(204)
  async emailCambio(@CurrentTenant() ctx: TenantContext, @Body() dto: CambioEmailDto): Promise<void> {
    await this.credenciales.solicitarCambioEmail(ctx.usuarioId!, dto.password, dto.nuevoEmail);
  }

  @Get('email/cambio')
  emailCambioPendiente(@CurrentTenant() ctx: TenantContext): Promise<{ pendiente: string | null }> {
    return this.credenciales.cambioEmailPendiente(ctx.usuarioId!);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email/cambio/reenviar')
  @HttpCode(204)
  async emailCambioReenviar(@CurrentTenant() ctx: TenantContext): Promise<void> {
    await this.credenciales.reenviarCambioEmail(ctx.usuarioId!);
  }

  @Delete('email/cambio')
  @HttpCode(204)
  async emailCambioCancelar(@CurrentTenant() ctx: TenantContext): Promise<void> {
    await this.credenciales.cancelarCambioEmail(ctx.usuarioId!);
  }
}
