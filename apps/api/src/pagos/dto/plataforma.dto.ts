import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PlanSuscripcion } from '@orkalis/shared';

/**
 * Cortesía del operador (Plan-Pagos FASE-10): asigna los beneficios de un plan
 * a una cuenta SIN generar cobro (para que el equipo/desarrollador pruebe).
 */
export class CortesiaDto {
  @IsEnum(PlanSuscripcion) plan!: PlanSuscripcion;
  // Nº de especialistas que habilita la cortesía (cupo). Mínimo 1.
  @IsInt() @Min(1) numEspecialistas!: number;
}

/** Corte manual de la mensajería desde la consola. */
export class PausarMensajeriaDto {
  @IsOptional() @IsString() @MaxLength(200) motivo?: string;
}

/**
 * Reanudación tras recargar crédito. `presupuesto` = segmentos comprados;
 * omitirlo conserva el presupuesto y el contador actuales (reanudar sin recarga).
 */
export class ReanudarMensajeriaDto {
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) presupuesto?: number;
}
