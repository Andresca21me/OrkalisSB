import { IsDefined, IsNumber, IsUUID, Max, Min } from 'class-validator';

/** Cuerpo de `PUT /config/:nivel/:ambitoId/:clave`. El valor se valida contra el registry. */
export class UpsertConfigDto {
  // boolean | number | string; la validación de tipo real la hace el registry.
  @IsDefined({ message: 'El valor es obligatorio.' })
  valor!: boolean | number | string;
}

/** Cuerpo de `PUT /config/reparticion/:nivel/:ambitoId`. Deben sumar 100. */
export class ReparticionDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  profesional!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  salon!: number;
}

/** Cuerpo de `POST /config/clonar`. */
export class ClonarConfigDto {
  @IsUUID('4', { message: 'origenSucursalId inválido.' })
  origenSucursalId!: string;

  @IsUUID('4', { message: 'destinoSucursalId inválido.' })
  destinoSucursalId!: string;
}
