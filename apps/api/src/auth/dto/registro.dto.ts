import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PerfilNegocio, PlanSuscripcion } from '@orkalis/shared';

/** Datos del administrador que se crea con el negocio. */
export class AdminRegistroDto {
  @IsString()
  @MinLength(2, { message: 'El nombre es obligatorio.' })
  nombre!: string;

  @IsEmail({}, { message: 'Email inválido.' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password!: string;
}

/**
 * Alta pública de un negocio (Plan-Pagos FASE-03). Crea el tenant + admin y
 * arranca en prueba; `modo='pago'` enruta al checkout (FASE-05).
 */
export class RegistroDto {
  @IsString()
  @MinLength(2, { message: 'El nombre del negocio es obligatorio.' })
  negocioNombre!: string;

  @IsEnum(PerfilNegocio, { message: 'Perfil de negocio inválido.' })
  perfil!: PerfilNegocio;

  @IsEnum(PlanSuscripcion, { message: 'Plan inválido.' })
  plan!: PlanSuscripcion;

  @IsInt()
  @Min(1)
  numEspecialistas!: number;

  @ValidateNested()
  @Type(() => AdminRegistroDto)
  admin!: AdminRegistroDto;

  @IsIn(['prueba', 'pago'], { message: 'Modo inválido (prueba | pago).' })
  modo!: 'prueba' | 'pago';

  /**
   * Verificación de correo completada en el Paso 2 (Plan-Correo E2). El
   * servidor exige que el enlace se haya abierto y que el email coincida con
   * `admin.email` — la regla vive aquí, no solo en la UI del wizard.
   */
  @IsUUID('4', { message: 'Verificación de correo inválida.' })
  verificacionId!: string;
}
