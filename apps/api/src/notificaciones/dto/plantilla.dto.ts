import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { CanalPlantilla, EventoPlantilla } from '@orkalis/shared';

/** Eventos y canales aceptados en la ruta (`PUT /plantillas/:evento/:canal`). */
export const EVENTOS_VALIDOS: EventoPlantilla[] = [
  'confirmacion',
  'recordatorio',
  'aviso',
  'aviso_especialista',
  'marketing',
];
export const CANALES_VALIDOS: CanalPlantilla[] = ['sms', 'whatsapp'];

/**
 * Cuerpo de guardado de una plantilla (FASE-04). El contenido se valida además
 * en `PlantillasService` (whitelist de variables): aquí solo forma y tamaño.
 */
export class GuardarPlantillaDto {
  /** `null`/vacío = volver al texto por defecto de plataforma. */
  @IsOptional()
  @IsString()
  @MaxLength(900)
  contenidoSms?: string | null;

  /** Content SID de una plantilla aprobada por Meta (WhatsApp, AM-3). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  whatsappContentSid?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/** Canal por query en el listado. */
export class ListarPlantillasDto {
  @IsOptional()
  @IsIn(CANALES_VALIDOS)
  canal?: CanalPlantilla;
}

/** Filtros del registro de mensajes (FASE-10). */
export class ListarMensajesDto {
  @IsOptional() @IsIn(['sms', 'whatsapp', 'email']) canal?: 'sms' | 'whatsapp' | 'email';
  @IsOptional()
  @IsIn(['pendiente', 'enviando', 'enviado', 'entregado', 'fallido', 'sin_cupo'])
  estado?: string;
  @IsOptional() @IsString() tipo?: string;
  /** ISO; por defecto, los últimos 30 días. */
  @IsOptional() @IsString() desde?: string;
  @IsOptional() @IsString() hasta?: string;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) pagina?: number;
}
