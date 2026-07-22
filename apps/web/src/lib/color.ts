/**
 * Utilidades de contraste para el color de marca que elige cada negocio.
 *
 * El problema real: si un salón elige un amarillo claro, el texto blanco del
 * botón queda ilegible. En vez de impedirle usar ese color, se calcula qué
 * texto encima se lee mejor.
 */

/** Luminancia relativa (WCAG). 0 = negro, 1 = blanco. */
export function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/**
 * Color de texto legible sobre el color dado. El umbral 0.45 se eligió para que
 * el texto cambie a oscuro un poco ANTES de que el blanco empiece a costar,
 * en lugar de justo en el límite.
 */
export function textoSobre(fondo: string | null | undefined): string {
  if (!fondo) return '#fff';
  return luminancia(fondo) > 0.45 ? '#0F1923' : '#fff';
}

/** `true` si sobre ese color hay que usar texto oscuro (se avisa en la UI). */
export function contrasteBajo(fondo: string): boolean {
  return luminancia(fondo) > 0.45;
}

/** Aclara u oscurece un hex un porcentaje (-1..1). Para los estados hover/pressed. */
export function ajustar(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mezcla = (v: number) => {
    const destino = factor < 0 ? 0 : 255;
    return Math.round(v + (destino - v) * Math.abs(factor));
  };
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mezcla);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
