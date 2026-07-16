import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { PerfilNegocio, PlanSuscripcion, RolUsuario } from '@orkalis/shared';

/** Alta self-service de un negocio (FASE-07). */
export class OnboardingDto {
  @IsString() @MinLength(2) negocioNombre!: string;
  @IsEnum(PerfilNegocio) perfil!: PerfilNegocio;
  @IsOptional() @IsEnum(PlanSuscripcion) plan?: PlanSuscripcion;
  @IsOptional() @IsString() sucursalNombre?: string;
  @IsString() @MinLength(2) adminNombre!: string;
  @IsEmail() adminEmail!: string;
  @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  adminPassword!: string;
}

export class CambiarPerfilDto {
  @IsEnum(PerfilNegocio) perfil!: PerfilNegocio;
}

export class CrearSucursalDto {
  @IsString() @MinLength(2) nombre!: string;
  @IsOptional() @IsUUID('4') clonarDeSucursalId?: string;
}

export class EditarSucursalDto {
  @IsString() @MinLength(2) nombre!: string;
}

export class EstadoSucursalDto {
  @IsBoolean() activa!: boolean;
}

export class CrearEspecialistaDto {
  @IsString() @MinLength(2) nombre!: string;
  @IsOptional() @IsString() especialidad?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) sucursalIds?: string[];
  // Acceso al panel (opcional): si se envían, se crea o enlaza el login del
  // especialista (rol especialista). Si el correo ya existe como login de
  // especialista sin recurso, se ENLAZA a ese (rescata cuentas huérfanas).
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
}

export class EditarEspecialistaDto {
  @IsOptional() @IsString() @MinLength(2) nombre?: string;
  @IsOptional() @IsString() especialidad?: string;
  @IsOptional() @IsBoolean() disponible?: boolean;
}

export class DisponibilidadDto {
  @IsBoolean() disponible!: boolean;
}

export class AsignarSucursalesDto {
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) sucursalIds!: string[];
}

/** Roles internos que un admin puede asignar (no operador de plataforma). */
const ROLES_INTERNOS = [RolUsuario.Admin, RolUsuario.Recepcionista, RolUsuario.Especialista];

export class CrearUsuarioDto {
  @IsString() @MinLength(2) nombre!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password!: string;
  @IsEnum(RolUsuario) @IsIn(ROLES_INTERNOS, { message: 'Rol no válido para un usuario interno.' })
  rol!: RolUsuario;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) sucursalIds?: string[];
}

export class EditarUsuarioDto {
  @IsOptional() @IsString() @MinLength(2) nombre?: string;
  @IsOptional() @IsEnum(RolUsuario) @IsIn(ROLES_INTERNOS) rol?: RolUsuario;
  @IsOptional() @IsBoolean() activo?: boolean;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) sucursalIds?: string[];
}

export class CambiarPlanDto {
  @IsOptional() @IsEnum(PlanSuscripcion) plan?: PlanSuscripcion;
  // Nº de especialistas que se pagan (cupo). No puede bajar por debajo de los activos.
  @IsOptional() @IsInt() @Min(1) numEspecialistas?: number;
}
