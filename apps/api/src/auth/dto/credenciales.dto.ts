import { IsEmail, IsString, IsUUID, MinLength } from 'class-validator';

/** Paso 2 del wizard de alta: arranca la verificación del correo (Plan-Correo E2). */
export class AltaVerificacionDto {
  @IsEmail({}, { message: 'Email inválido.' })
  email!: string;

  @IsString()
  @MinLength(2, { message: 'El nombre es obligatorio.' })
  nombre!: string;
}

export class ReenviarVerificacionDto {
  @IsUUID('4', { message: 'Verificación inválida.' })
  verificacionId!: string;
}

/** Clic en el enlace de un correo (verificación de alta o de cambio de correo). */
export class VerificarCorreoDto {
  @IsString()
  @MinLength(20, { message: 'Enlace inválido.' })
  token!: string;
}

/** "¿Olvidaste tu contraseña?" — siempre responde 204 (anti-enumeración, D7). */
export class OlvidoPasswordDto {
  @IsEmail({}, { message: 'Email inválido.' })
  email!: string;
}

/** Cambio de contraseña con sesión (Plan-Correo E4). */
export class CambiarPasswordDto {
  @IsString()
  @MinLength(1, { message: 'Escribe tu contraseña actual.' })
  passwordActual!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña nueva debe tener al menos 8 caracteres.' })
  passwordNueva!: string;
}

/** Solicitud de cambio del correo de acceso (Plan-Correo E4). */
export class CambioEmailDto {
  @IsString()
  @MinLength(1, { message: 'Confirma tu contraseña.' })
  password!: string;

  @IsEmail({}, { message: 'Email inválido.' })
  nuevoEmail!: string;
}

/** Nueva contraseña con el enlace del correo (Plan-Correo E3). */
export class RestablecerPasswordDto {
  @IsString()
  @MinLength(20, { message: 'Enlace inválido.' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password!: string;
}
