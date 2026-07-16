import { IsEmail, IsString, MinLength } from 'class-validator';

/** Credenciales de login de usuario interno (FASE-05). */
export class LoginDto {
  @IsEmail({}, { message: 'Email inválido.' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'La contraseña es obligatoria.' })
  password!: string;
}
