import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
  Max,
} from 'class-validator';
import { SplitType, TipoGasto, TipoProducto } from '@orkalis/shared';

export class ClienteDto {
  @IsString() @MinLength(2) nombre!: string;
  @IsOptional() @IsString() telefono?: string;
}
export class EditarClienteDto {
  @IsOptional() @IsString() @MinLength(2) nombre?: string;
  @IsOptional() @IsString() telefono?: string;
}

export class ServicioDto {
  @IsString() @MinLength(2) nombre!: string;
  @IsNumber() @Min(0) precio!: number;
  @IsInt() @Min(1) duracionMin!: number;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() @IsEnum(SplitType) splitType?: SplitType;
  @IsOptional() @IsNumber() @Min(0) splitValor?: number;
  @IsOptional() @IsBoolean() favorito?: boolean;
}
export class EditarServicioDto {
  @IsOptional() @IsString() @MinLength(2) nombre?: string;
  @IsOptional() @IsNumber() @Min(0) precio?: number;
  @IsOptional() @IsInt() @Min(1) duracionMin?: number;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() @IsEnum(SplitType) splitType?: SplitType;
  @IsOptional() @IsNumber() @Min(0) splitValor?: number;
  @IsOptional() @IsBoolean() favorito?: boolean;
}

export class ProductoDto {
  @IsUUID('4') sucursalId!: string;
  @IsString() @MinLength(2) nombre!: string;
  @IsEnum(TipoProducto) tipo!: TipoProducto;
  @IsOptional() @IsInt() @Min(0) cantidad?: number;
  @IsOptional() @IsInt() @Min(0) stockMin?: number;
  @IsOptional() @IsNumber() @Min(0) costo?: number;
  @IsOptional() @IsNumber() @Min(0) precioVenta?: number;
  /** Si el stock inicial (>0) debe registrarse como gasto de compra. Default: true. */
  @IsOptional() @IsBoolean() generaGasto?: boolean;
}

export class EditarProductoDto {
  @IsOptional() @IsString() @MinLength(2) nombre?: string;
  @IsOptional() @IsEnum(TipoProducto) tipo?: TipoProducto;
  @IsOptional() @IsInt() @Min(0) stockMin?: number;
  @IsOptional() @IsNumber() @Min(0) costo?: number;
  @IsOptional() @IsNumber() @Min(0) precioVenta?: number;
}

export class MovimientoDto {
  @IsUUID('4') productoId!: string;
  @IsIn(['entrada', 'salida', 'ajuste']) tipoMov!: 'entrada' | 'salida' | 'ajuste';
  @IsInt() @Min(0) cantidad!: number;
  @IsOptional() @IsString() motivo?: string;
  @IsOptional() @IsBoolean() generaGasto?: boolean;
  /** Costo real de la compra (entradas): dispara el promedio ponderado del costo. */
  @IsOptional() @IsNumber() @Min(0) costoTotal?: number;
}

export class VentaDto {
  @IsUUID('4') productoId!: string;
  @IsInt() @Min(1) cantidad!: number;
  // La comisión NO llega del cliente: la calcula el servidor con la configuración
  // del negocio (Plan-Inventario, D2). Solo se indica a quién se le acredita.
  @IsOptional() @IsUUID('4') especialistaId?: string;
}

export class GastoDto {
  @IsUUID('4') sucursalId!: string;
  @IsEnum(TipoGasto) tipo!: TipoGasto;
  @IsOptional() @IsString() categoria?: string;
  @IsNumber() @Min(0) monto!: number;
  @IsOptional() @IsString() frecuencia?: string;
  /** Variables: día (Bogotá) en que se hizo el gasto. */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha?: string;
  /** Fijos: día del mes en que se cobra (recortado al fin de mes). */
  @IsOptional() @IsInt() @Min(1) @Max(31) diaCobro?: number;
}

export class LiquidacionDto {
  @IsString() periodo!: string;
  @IsISO8601() desde!: string;
  @IsISO8601() hasta!: string;
  @IsUUID('4') sucursalId!: string;
}

export class PreviewLiquidacionDto {
  @IsISO8601() desde!: string;
  @IsISO8601() hasta!: string;
  /** Opcional desde Plan-Finanzas F5: sin sucursal = consolidado del negocio. */
  @IsOptional() @IsUUID('4') sucursalId?: string;
}

export class CierreDto {
  @IsIn(['quincenal', 'mensual']) tipo!: 'quincenal' | 'mensual';
  /**
   * Fecha ANCLA del período (YYYY-MM-DD, día local Bogotá). El backend deriva
   * el rango: quincenal → 1–15 o 16–fin según el día; mensual → el mes entero
   * (Plan-Finanzas F6). El navegador ya no manda desde/hasta.
   */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'El ancla debe ser YYYY-MM-DD.' }) ancla!: string;
  @IsOptional() @IsUUID('4') sucursalId?: string;
}
