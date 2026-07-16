import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MetodoPago } from '@orkalis/shared';

// ── Flujo público ────────────────────────────────────────────────────────────

export class RetenerDto {
  @IsUUID('4') especialistaId!: string;
  @IsISO8601() inicio!: string;
  @IsISO8601() fin!: string;
}

export class EnviarOtpDto {
  @IsString() @MinLength(7) telefono!: string;
}

export class BuscarCitaDto {
  @IsString() @MinLength(7) telefono!: string;
  @IsString() @MinLength(6) codigo!: string;
}

export class ConfirmarDto {
  @IsUUID('4') retencionId!: string;
  @IsString() @MinLength(7) telefono!: string;
  @IsOptional() @IsString() nombre?: string;
  @IsString() @MinLength(4) codigoOtp!: string;
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsUUID('4', { each: true }) servicioIds!: string[];
}

// ── Operación interna ──────────────────────────────────────────────────────────

export class ServicioRealDto {
  @IsUUID('4') servicioId!: string;
  @IsOptional() @IsNumber() @Min(0) precio?: number;
}

export class ProductoRealDto {
  @IsUUID('4') productoId!: string;
  @IsInt() @Min(1) cantidad!: number;
}

export class CompletarDto {
  @IsEnum(MetodoPago) metodoPago!: MetodoPago;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ServicioRealDto)
  servicios?: ServicioRealDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductoRealDto)
  productos?: ProductoRealDto[];
}

export class ReasignarDto {
  @IsUUID('4') especialistaId!: string;
}

export class CrearCitaDto {
  @IsUUID('4') sucursalId!: string;
  @IsUUID('4') especialistaId!: string;
  @IsOptional() @IsUUID('4') clienteId?: string;
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsUUID('4', { each: true }) servicioIds!: string[];
  @IsISO8601() inicio!: string;
}

export class WalkInVivoDto {
  @IsUUID('4') sucursalId!: string;
  @IsUUID('4') especialistaId!: string;
  @IsOptional() @IsUUID('4') clienteId?: string;
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsUUID('4', { each: true }) servicioIds!: string[];
}

export class WalkInRetroactivoDto {
  @IsUUID('4') sucursalId!: string;
  @IsUUID('4') especialistaId!: string;
  @IsOptional() @IsUUID('4') clienteId?: string;
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsUUID('4', { each: true }) servicioIds!: string[];
  @IsISO8601() inicio!: string;
  @IsISO8601() fin!: string;
  @IsEnum(MetodoPago) metodoPago!: MetodoPago;
}
