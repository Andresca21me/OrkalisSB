import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { PlanSuscripcion } from '@orkalis/shared';

/** Registrar el método de pago (token tokenizado por el SDK de Mercado Pago). */
export class MetodoPagoDto {
  @IsString()
  @MinLength(1)
  cardToken!: string;

  @IsEmail()
  payerEmail!: string;
}

/** Primer pago (tarjeta presente): token + email + método de pago de la tarjeta. */
export class PagarDto {
  @IsString()
  @MinLength(1)
  cardToken!: string;

  @IsEmail()
  payerEmail!: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}

/** Previsualizar un cambio de plan/cupo (clasifica y calcula montos, sin aplicar). */
export class PreviewCambioDto {
  @IsOptional() @IsEnum(PlanSuscripcion) plan?: PlanSuscripcion;
  @IsOptional() @IsInt() @Min(1) numEspecialistas?: number;
}

/**
 * Aplicar un cambio de plan/cupo (Plan-Pagos FASE-09 v2). Si es una SUBIDA en
 * cuenta activa, requiere los datos de tarjeta para cobrar el prorrateo al
 * instante; si no se envían, el backend responde `requiere_pago`.
 */
export class CambiarSuscripcionDto extends PreviewCambioDto {
  @IsOptional() @IsString() cardToken?: string;
  @IsOptional() @IsEmail() payerEmail?: string;
  @IsOptional() @IsString() paymentMethodId?: string;
}
