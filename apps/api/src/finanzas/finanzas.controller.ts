import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MetodoPago, RolUsuario } from '@orkalis/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../common/tenant/current-tenant.decorator';
import type { TenantContext } from '../db/tenant-context';
import { DesgloseService } from './desglose.service';

export class ArqueoQueryDto {
  @IsISO8601() desde!: string;
  @IsISO8601() hasta!: string;
  @IsOptional() @IsUUID('4') sucursalId?: string;
  @IsOptional() @IsUUID('4') especialistaId?: string;
  @IsOptional() @IsUUID('4') servicioId?: string;
  @IsOptional() @IsUUID('4') productoId?: string;
  @IsOptional() @IsEnum(MetodoPago) metodo?: MetodoPago;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

/**
 * Transparencia financiera por transacción (Plan-Finanzas F1): el arqueo del
 * período y el desglose exacto de una atención. Solo lectura; el cálculo vive
 * en `calcularAtencion` y aquí únicamente se expone lo congelado.
 */
@Controller()
export class FinanzasController {
  constructor(private readonly desglose: DesgloseService) {}

  /** Arqueo fila por fila del rango, con filtros (pestaña Transacciones). */
  @Get('atenciones')
  @Roles(RolUsuario.Admin)
  arqueo(@CurrentTenant() ctx: TenantContext, @Query() q: ArqueoQueryDto) {
    return this.desglose.arqueo(ctx, {
      desde: new Date(q.desde),
      hasta: new Date(q.hasta),
      sucursalId: q.sucursalId,
      especialistaId: q.especialistaId,
      servicioId: q.servicioId,
      productoId: q.productoId,
      metodo: q.metodo,
      limit: q.limit ?? 100,
      offset: q.offset ?? 0,
    });
  }

  /** Desglose de la transacción de una cita. Especialista: solo la propia (D2). */
  @Get('citas/:id/atencion')
  @Roles(RolUsuario.Admin, RolUsuario.Especialista)
  desglosePorCita(@CurrentTenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.desglose.desglosePorCita(ctx, id);
  }

  /** Contexto de la pantalla de cobro (candado D9): lo leen todos los que cobran. */
  @Get('finanzas/contexto-cobro')
  @Roles(RolUsuario.Admin, RolUsuario.Especialista, RolUsuario.Recepcionista)
  contextoCobro(@CurrentTenant() ctx: TenantContext, @Query('sucursalId') sucursalId?: string) {
    return this.desglose.contextoCobro(ctx, sucursalId ?? null);
  }
}
