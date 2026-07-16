import { IsEnum, IsInt, Min } from 'class-validator';
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
