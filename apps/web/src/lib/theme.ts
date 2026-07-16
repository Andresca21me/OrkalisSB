/**
 * Sistema de temas por vertical (identidad visual del tipo de negocio).
 *
 * Todo el DS pinta con variables CSS derivadas de una familia base (`--blue*`,
 * `--navy`). El tema se aplica poniendo `data-vertical` en `<html>`; el CSS
 * (`styles/colors.css`) remapea esos tokens base bajo `[data-vertical="salon"]`,
 * así que un solo atributo re-tematiza toda la app sin condicionales por
 * componente. Añadir un tercer tema = otro bloque CSS, nada de código.
 *
 * - Barbería → azul (tokens por defecto).
 * - Salón    → rosa elegante.
 */

export type Tema = 'barberia' | 'salon';

const SS_KEY = 'orkalis_vertical';
const ANIM_MS = 450;

/** Normaliza cualquier valor (incl. `PerfilNegocio`) a un tema válido. */
export function normalizeVertical(v: unknown): Tema {
  return v === 'salon' ? 'salon' : 'barberia';
}

/**
 * Aplica el tema a `<html>`. La primera aplicación es instantánea (evita un
 * flash de color al montar); los cambios posteriores animan la transición,
 * salvo `prefers-reduced-motion`.
 */
export function applyVertical(v: Tema): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  const primeraVez = !el.dataset.vertical;
  if (el.dataset.vertical === v) return;
  if (!primeraVez) {
    el.classList.add('theme-anim');
    window.setTimeout(() => el.classList.remove('theme-anim'), ANIM_MS);
  }
  el.dataset.vertical = v;
}

/** Tema recordado para la landing durante la sesión del navegador. */
export function loadLandingVertical(): Tema {
  try {
    return normalizeVertical(sessionStorage.getItem(SS_KEY));
  } catch {
    return 'barberia';
  }
}

export function saveLandingVertical(v: Tema): void {
  try {
    sessionStorage.setItem(SS_KEY, v);
  } catch {
    /* almacenamiento no disponible: el tema vive solo en memoria */
  }
}

/**
 * Lee el valor computado de una variable CSS de tema (p. ej. `--brand`).
 * Útil para lienzos/SVG (recharts) que no entienden `var(--x)`. Se resuelve en
 * cada render, así que refleja el tema activo sin necesidad de reactividad
 * extra (en la plataforma el tema es fijo mientras el panel está montado).
 */
export function readCssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
