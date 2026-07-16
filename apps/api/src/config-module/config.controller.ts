import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { NivelConfig, RolUsuario } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { ConfigResolverService } from './config-resolver.service';
import { ConfigWriteService } from './config-write.service';
import { ClonarConfigDto, ReparticionDto, UpsertConfigDto } from './dto/config.dto';
import type { ValorEfectivo } from './config.types';

/**
 * Endpoints de configuración (FASE-06). Solo admin (RF-008/009/010/011).
 * El aislamiento por negocio lo garantiza RLS vía `runInTenantTx(ctx)`.
 */
@Controller('config')
@Roles(RolUsuario.Admin)
export class ConfigController {
  constructor(
    private readonly resolver: ConfigResolverService,
    private readonly writer: ConfigWriteService,
  ) {}

  /** Valores efectivos + procedencia (consolidado o por sucursal). */
  @Get()
  getEfectivos(
    @CurrentTenant() ctx: TenantContext,
    @Query('sucursalId') sucursalId?: string,
  ): Promise<ValorEfectivo[]> {
    return this.resolver.getEfectivos(ctx.negocioId, sucursalId ?? null);
  }

  /** Fija la repartición profesional/salón de forma atómica (deben sumar 100). */
  @Put('reparticion/:nivel/:ambitoId')
  async setReparticion(
    @CurrentTenant() ctx: TenantContext,
    @Param('nivel') nivel: NivelConfig,
    @Param('ambitoId') ambitoId: string,
    @Body() dto: ReparticionDto,
  ): Promise<{ ok: true }> {
    await this.writer.setReparticion(ctx, nivel, ambitoId, dto.profesional, dto.salon);
    return { ok: true };
  }

  /** Crea/actualiza un override en un nivel. */
  @Put(':nivel/:ambitoId/:clave')
  async upsert(
    @CurrentTenant() ctx: TenantContext,
    @Param('nivel') nivel: NivelConfig,
    @Param('ambitoId') ambitoId: string,
    @Param('clave') clave: string,
    @Body() dto: UpsertConfigDto,
  ): Promise<{ ok: true }> {
    await this.writer.upsert(ctx, nivel, ambitoId, clave, dto.valor);
    return { ok: true };
  }

  /** Borra un override = volver a heredar. */
  @Delete(':nivel/:ambitoId/:clave')
  @HttpCode(204)
  async remove(
    @CurrentTenant() ctx: TenantContext,
    @Param('nivel') nivel: NivelConfig,
    @Param('ambitoId') ambitoId: string,
    @Param('clave') clave: string,
  ): Promise<void> {
    await this.writer.remove(ctx, nivel, ambitoId, clave);
  }

  /** Clona los overrides de una sucursal a otra (instantánea, RF-011). */
  @Post('clonar')
  @HttpCode(200)
  async clonar(
    @CurrentTenant() ctx: TenantContext,
    @Body() dto: ClonarConfigDto,
  ): Promise<{ ok: true }> {
    await this.writer.clonar(ctx, dto.origenSucursalId, dto.destinoSucursalId);
    return { ok: true };
  }
}
