import { PerfilNegocio } from '@orkalis/shared';
import { useAuth } from './auth';

/**
 * Cómo se llama el negocio dentro de la plataforma, según el perfil de la cuenta.
 *
 * A un barbero le chirría leer "salón" en su propio panel. Todas las cadenas
 * visibles que nombran al negocio salen de aquí, en lugar de escribirse a mano
 * en cada pantalla — así no vuelve a quedarse ninguna sin traducir.
 *
 * **Ojo con el género:** "salón" es masculino y "barbería" femenino, así que no
 * basta con sustituir la palabra ("el barbería" no existe). Por eso hay
 * variantes con artículo ya montado, y las pantallas usan esas en vez de
 * concatenar "el " + palabra.
 *
 * Los nombres de variables y campos de API (`ingresosSalon`, `ganSalon`,
 * `reparticion.salon`) **no** cambian: son contrato de datos, no texto visible.
 */
export interface Vocabulario {
  /** 'Salón' | 'Barbería' — para etiquetas y comienzos de frase. */
  Negocio: string;
  /** 'salón' | 'barbería' — dentro de una frase. */
  negocio: string;
  /** 'el salón' | 'la barbería' */
  elNegocio: string;
  /** 'del salón' | 'de la barbería' */
  delNegocio: string;
  /** 'al salón' | 'a la barbería' */
  alNegocio: string;
  /** 'especialista' | 'barbero' */
  especialista: string;
  /** 'especialistas' | 'barberos' */
  especialistas: string;
}

const SALON: Vocabulario = {
  Negocio: 'Salón',
  negocio: 'salón',
  elNegocio: 'el salón',
  delNegocio: 'del salón',
  alNegocio: 'al salón',
  especialista: 'especialista',
  especialistas: 'especialistas',
};

const BARBERIA: Vocabulario = {
  Negocio: 'Barbería',
  negocio: 'barbería',
  elNegocio: 'la barbería',
  delNegocio: 'de la barbería',
  alNegocio: 'a la barbería',
  especialista: 'barbero',
  especialistas: 'barberos',
};

/** Vocabulario de un perfil concreto (útil fuera de la sesión, p. ej. reserva pública). */
export function vocabularioDe(perfil: string | null | undefined): Vocabulario {
  return perfil === PerfilNegocio.Barberia ? BARBERIA : SALON;
}

/**
 * Vocabulario de la cuenta en sesión. Sin sesión cae a 'salón', que es el
 * término más genérico del sector.
 */
export function useVocabulario(): Vocabulario {
  const { usuario } = useAuth();
  return vocabularioDe(usuario?.negocio.perfil);
}
