import { NivelConfig, PerfilNegocio } from '@orkalis/shared';

/**
 * Tipos del sistema de configuración (FASE-06, ADR-002).
 */

/** Tipo de dato de una clave de configuración. */
export type TipoClave = 'boolean' | 'porcentaje' | 'numero' | 'enum' | 'dinero' | 'duracion';

/** Valor de configuración (lo que se guarda como jsonb y se resuelve). */
export type ValorConfig = boolean | number | string;

/** Procedencia de un valor resuelto: el nivel que lo definió. */
export type Procedencia = NivelConfig;

/** Definición de una clave en el registry (fuente de verdad). */
export interface DefinicionClave {
  clave: string;
  tipo: TipoClave;
  /** Nivel mínimo (menos específico) en que se puede editar. */
  nivelMinimoEdicion: NivelConfig;
  /** Valor por defecto por vertical (salón / barbería). */
  defaults: Record<PerfilNegocio, ValorConfig>;
  /** Valores admitidos cuando `tipo === 'enum'`. */
  enumValores?: readonly string[];
  /** Descripción para la UI de admin. */
  descripcion: string;
}

/** Resultado de resolver una clave: valor efectivo + de dónde viene. */
export interface ValorEfectivo {
  clave: string;
  valor: ValorConfig;
  procedencia: Procedencia;
  tipo: TipoClave;
}
