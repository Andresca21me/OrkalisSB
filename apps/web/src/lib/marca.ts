import type { CSSProperties } from 'react';
import { ajustar, luminancia, textoSobre } from './color';

/**
 * Traduce el color elegido por un negocio a las variables CSS del sistema de
 * diseño (branding dinámico).
 *
 * **Por qué se redefinen TODAS y no solo `--blue`.** Es una sutileza de CSS que
 * cuesta ver: una variable se sustituye en el elemento donde se *declara*, no
 * donde se usa. Como `:root` declara `--brand: var(--blue)`, esa variable se
 * calcula allí y hereda hacia abajo el azul **ya resuelto**; redefinir `--blue`
 * en un contenedor más profundo no la cambia. Por eso al principio solo se
 * reteñían los botones —que usan `var(--blue)` directamente— y el resto del
 * panel seguía azul.
 *
 * De ahí que la lista sea deliberadamente explícita: cubre la familia de marca
 * completa (`--brand*`), los enlaces y el azul informativo, que es un literal
 * aparte y no deriva de `--blue`.
 *
 * Si el negocio no configuró color se devuelve un objeto vacío: entonces manda
 * el tema del vertical (barbería azul / salón rosa), que es el fallback limpio.
 */
export function estilosDeMarca(colorPrimario: string | null | undefined): CSSProperties {
  if (!colorPrimario || !/^#[0-9a-fA-F]{6}$/.test(colorPrimario)) return {};

  // Hover y pressed se derivan del color base para que los tres estados sean de
  // la misma familia, en vez de pedirle tres colores al usuario.
  const hover = ajustar(colorPrimario, -0.12);
  const pressed = ajustar(colorPrimario, -0.24);
  const sobre = textoSobre(colorPrimario);

  return {
    // Base: la usa el botón primario y todo lo que referencie --blue.
    ['--blue' as string]: colorPrimario,
    ['--blue-hover' as string]: hover,
    ['--blue-pressed' as string]: pressed,

    // Familia de marca: iconos, bordes de selección, chips y estados activos.
    ['--brand' as string]: colorPrimario,
    ['--brand-hover' as string]: hover,
    ['--brand-pressed' as string]: pressed,
    ['--brand-tint' as string]: `color-mix(in srgb, ${colorPrimario} 10%, transparent)`,
    ['--brand-tint-border' as string]: `color-mix(in srgb, ${colorPrimario} 26%, transparent)`,
    ['--brand-glow' as string]: `color-mix(in srgb, ${colorPrimario} 55%, transparent)`,
    ['--brand-glow-soft' as string]: `color-mix(in srgb, ${colorPrimario} 30%, transparent)`,

    // Enlaces y azul informativo: literales propios que no derivan de --blue.
    ['--text-link' as string]: pressed,
    ['--info' as string]: colorPrimario,
    ['--info-tint' as string]: `color-mix(in srgb, ${colorPrimario} 10%, transparent)`,

    // Texto ENCIMA del color: con un tono claro el blanco dejaría el botón
    // ilegible, así que se decide por luminancia.
    ['--brand-on' as string]: sobre,
    ['--text-on-brand' as string]: sobre,

    // Variante para pintar la marca SOBRE fondos oscuros (la cabecera navy de
    // la reserva). Un color de marca oscuro sobre navy sería invisible, así que
    // se aclara lo justo para que se lea sin dejar de ser reconocible.
    ['--brand-sobre-oscuro' as string]: luminancia(colorPrimario) < 0.2 ? ajustar(colorPrimario, 0.5) : colorPrimario,
  } as CSSProperties;
}
