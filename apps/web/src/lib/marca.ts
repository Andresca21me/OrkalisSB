import type { CSSProperties } from 'react';
import { ajustar, textoSobre } from './color';

/**
 * Traduce el color elegido por un negocio a las variables CSS del sistema de
 * diseño (branding dinámico).
 *
 * La clave está en NO inventar un canal de estilos nuevo: el sistema ya deriva
 * de `--blue` los botones, los tints, los bordes de foco y los estados activos,
 * y `--brand` es un alias suyo. Redefiniendo esas pocas variables en un
 * contenedor, todo lo de dentro se retiñe solo, sin tocar ni un componente —
 * exactamente el mismo mecanismo que usa el tema por vertical.
 *
 * Si el negocio no configuró color se devuelve un objeto vacío: entonces manda
 * el tema del vertical (barbería azul / salón rosa), que es el fallback limpio.
 */
export function estilosDeMarca(colorPrimario: string | null | undefined): CSSProperties {
  if (!colorPrimario || !/^#[0-9a-fA-F]{6}$/.test(colorPrimario)) return {};

  return {
    // Hover y pressed se derivan del color base para que los tres estados
    // pertenezcan a la misma familia, en vez de pedirle tres colores al usuario.
    ['--blue' as string]: colorPrimario,
    ['--blue-hover' as string]: ajustar(colorPrimario, -0.12),
    ['--blue-pressed' as string]: ajustar(colorPrimario, -0.24),
    // Fondos suaves para chips, selección y bordes de foco.
    ['--brand-tint' as string]: `color-mix(in srgb, ${colorPrimario} 10%, transparent)`,
    // Texto legible ENCIMA del color: si el negocio elige un tono claro, el
    // blanco dejaría el botón ilegible.
    ['--brand-on' as string]: textoSobre(colorPrimario),
  } as CSSProperties;
}
