import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
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
