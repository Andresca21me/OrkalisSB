import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService, type RegistroResult } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/registro.dto';
import { Public } from './decorators/public.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import type { RefreshTokenPayload, TokenPair } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.authService.login(dto.email, dto.password);
  }

  /**
   * Alta pública de un negocio (Plan-Pagos FASE-03). Throttle estricto por ser
   * endpoint público de creación (anti-abuso): 10 altas/min por IP.
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('registro')
  @HttpCode(201)
  registro(@Body() dto: RegistroDto): Promise<RegistroResult> {
    return this.authService.registrar(dto);
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
}
