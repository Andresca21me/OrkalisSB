import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  Matches,
  ValidateNested,
} from 'class-validator';
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

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Ventana de atención 'HH:MM'. */
export class FranjaDto {
  @Matches(HHMM, { message: 'La hora de apertura debe venir como HH:MM.' })
  apertura!: string;

  @Matches(HHMM, { message: 'La hora de cierre debe venir como HH:MM.' })
  cierre!: string;
}

/**
 * Horario de una sucursal: base + 7 excepciones por día (`null` = usa el base).
 * El array llega completo para que guardar sea idempotente y un día que se
 * vacía vuelva al base sin endpoints extra.
 */
export class HorarioDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FranjaDto)
  base!: FranjaDto | null;

  // Sin `@ValidateNested({ each: true })`: rechaza los `null`, que aquí son un
  // valor legítimo («este día usa el horario base»). El contenido de cada
  // posición lo valida `HorarioService.setHorario`, que además comprueba que el
  // cierre sea posterior a la apertura.
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  dias!: (FranjaDto | null)[];
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

  /** Horario de atención de la sede (base + excepciones por día). */
  @Put('sucursal/:id/horas')
  @HttpCode(204)
  async horasSucursal(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: HorarioDto,
  ): Promise<void> {
    await this.s.setHorario(ctx, id, { base: dto.base ?? null, dias: dto.dias.map((d) => d ?? null) });
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
