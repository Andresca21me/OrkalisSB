import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  Matches,
  MaxLength,
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
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) servicioIds?: string[];
}

/**
 * Invitación de un especialista por correo (Plan-Correo E5, D4): el admin
 * captura los datos básicos + el correo; contraseña y celular los pone el
 * propio especialista desde el enlace que le llega.
 */
export class InvitarEspecialistaDto {
  @IsString() @MinLength(2) nombre!: string;
  @IsOptional() @IsString() apellidos?: string;
  @IsOptional() @IsString() especialidad?: string;
  @IsEmail({}, { message: 'Email inválido.' }) email!: string;
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) sucursalIds!: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) servicioIds?: string[];
  @IsOptional() @IsBoolean() disponible?: boolean;
}

/**
 * "Yo también atiendo" (Plan-Correo E8): el usuario en sesión crea SU ficha de
 * especialista. Sin correo: se enlaza a su propia cuenta.
 */
export class MiFichaDto {
  /** Por defecto, el nombre del usuario en sesión. */
  @IsOptional() @IsString() @MinLength(2) nombre?: string;
  @IsOptional() @IsString() apellidos?: string;
  @IsOptional() @IsString() especialidad?: string;
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) sucursalIds!: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) servicioIds?: string[];
  @IsOptional() @IsBoolean() disponible?: boolean;
}

/** Invitar (o re-invitar con otro correo) a un especialista ya existente sin acceso. */
export class InvitarExistenteDto {
  @IsEmail({}, { message: 'Email inválido.' }) email!: string;
}

/** El especialista activa su cuenta desde el enlace de la invitación. */
export class ActivarInvitacionDto {
  @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password!: string;
}

/** El propio especialista registra su celular (paso 2 de la invitación). */
export class MiTelefonoIniciarDto {
  /** Móvil colombiano; se normaliza a E.164 en el servicio. */
  @IsString() @Matches(/^(\+?57)?\s?3\d{2}[\s-]?\d{3}[\s-]?\d{4}$/, {
    message: 'El celular debe ser un móvil colombiano de 10 dígitos (empieza por 3).',
  })
  celular!: string;
}

export class MiTelefonoConfirmarDto {
  @IsString() @Matches(/^\d{4,8}$/, { message: 'El código son solo dígitos.' }) codigo!: string;
}

/**
 * Foto de perfil en formato data URL. El tope de 600 000 caracteres es un freno
 * de emergencia por si alguien salta el redimensionado del navegador; el límite
 * real de bytes se valida en el servicio.
 */
/** Descripción y color primario de la marca del negocio. */
export class MarcaNegocioDto {
  /** Tope de 200: por encima, WhatsApp y Google recortan la frase a mitad. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descripcion?: string | null;

  /** Hex #RRGGBB. Se revalida en el servicio antes de tocar la base. */
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'El color debe venir en formato #RRGGBB.' })
  colorPrimario?: string | null;
}

export class LogoNegocioDto {
  @IsString()
  @MaxLength(600_000)
  @Matches(/^data:image\/(jpeg|png|webp);base64,/, { message: 'El logo debe ser JPEG, PNG o WebP.' })
  dataUrl!: string;
}

export class FotoEspecialistaDto {
  @IsString()
  @MaxLength(600_000)
  @Matches(/^data:image\/(jpeg|png|webp);base64,/, { message: 'La foto debe ser JPEG, PNG o WebP.' })
  dataUrl!: string;
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

export class AsignarServiciosDto {
  /** Vacío = sin restricción: realiza todos los servicios. */
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) servicioIds!: string[];
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
