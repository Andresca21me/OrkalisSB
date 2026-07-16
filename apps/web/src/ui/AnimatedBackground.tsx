import { useEffect, useRef, type CSSProperties } from 'react';
import type { GradientHandle, GradientOptions } from './glGradient';

/**
 * Fondo animado premium para el hero (FASE-12 · mejora UI).
 *
 * - Pinta primero un **gradiente estático** (CSS, con tokens del DS) → no afecta
 *   al LCP. Tras el primer paint, carga el shader WebGL en un chunk aparte.
 * - Respeta `prefers-reduced-motion` y, en móvil, se queda estático.
 * - Pausa el render fuera de viewport (IntersectionObserver) y con la pestaña
 *   oculta (visibilitychange). DPR topado a 2. `pointer-events: none` + scrim.
 *
 * Colores: SOLO tokens del DS (acepta `--token` o `#hex`). Por defecto usa
 * azul de marca + teal + azul claro sobre la superficie de página.
 *
 * Variantes (prop `variant`): "subtle" (apenas respira) · "medium" (recomendada)
 * · "vivid" (más vivo). `intensity` y `speed` permiten afinar sobre la variante.
 */

export type Variant = 'subtle' | 'medium' | 'vivid';

type Preset = Pick<GradientOptions, 'scale' | 'warp' | 'swirl' | 'intensity' | 'speed'>;

const VARIANTS: Record<Variant, Preset> = {
  // scale: frecuencia · warp/swirl: deformación orgánica · intensity: sutileza · speed: tiempo
  subtle: { scale: 1.05, warp: 0.25, swirl: 0.40, intensity: 0.14, speed: 0.035 },
  medium: { scale: 1.50, warp: 0.45, swirl: 0.62, intensity: 0.22, speed: 0.060 },
  vivid: { scale: 2.00, warp: 0.72, swirl: 0.95, intensity: 0.34, speed: 0.100 },
};

export interface AnimatedBackgroundProps {
  variant?: Variant;
  /** Sobrescribe la intensidad de la variante (0 = base plano · ~0.4 = muy vivo). */
  intensity?: number;
  /** Sobrescribe la velocidad de la variante (0.03 lento · 0.10 vivo). */
  speed?: number;
  colorA?: string; // default '--brand'
  colorB?: string; // default '--blue-hover'
  colorC?: string; // default '--info'
  baseColor?: string; // default '--surface-page'
  /** Scrim para asegurar contraste AA del texto encima. */
  scrim?: boolean;
  /** Difumina el borde inferior para fundirse con la sección de abajo.
   *  `true` = fade desde 56% · número = % donde empieza el fade. */
  fadeBottom?: boolean | number;
  className?: string;
  style?: CSSProperties;
}

/** Resuelve un color (`--token` o `#hex`/`rgb()`) a [r,g,b] en 0..1. */
function resolveColor(input: string): [number, number, number] {
  let v = input.trim();
  if (v.startsWith('--')) {
    v = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }
  if (v.startsWith('#')) {
    const h = v.slice(1);
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full.slice(0, 6), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = v.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const [r, g, b] = m[1].split(',').map((x) => parseFloat(x));
    return [(r || 0) / 255, (g || 0) / 255, (b || 0) / 255];
  }
  return [0.97, 0.98, 0.99]; // fallback near-white
}

export function AnimatedBackground({
  variant = 'medium',
  intensity,
  speed,
  colorA = '--brand',
  colorB = '--blue-hover',
  colorC = '--info',
  baseColor = '--surface-page',
  scrim = true,
  fadeBottom = true,
  className,
  style,
}: AnimatedBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<GradientHandle | null>(null);

  // Monta/desmonta el shader (una sola vez). El primer paint ya muestra el estático.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = window.matchMedia('(max-width: 767px)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (reduce || (small && coarse)) return; // móvil/reduced-motion → solo estático

    let cancelled = false;
    let inView = true;
    let io: IntersectionObserver | null = null;

    const sync = () => handleRef.current?.setActive(inView && !document.hidden);
    const onVis = () => sync();

    const idle = (cb: () => void): void => {
      const ric = (window as unknown as { requestIdleCallback?: (c: () => void) => number }).requestIdleCallback;
      if (ric) ric(cb);
      else window.setTimeout(cb, 120);
    };

    // Cargar tras el primer paint para no competir con el LCP.
    requestAnimationFrame(() => requestAnimationFrame(() => idle(async () => {
      if (cancelled || !canvasRef.current) return;
      const { mountGradient } = await import('./glGradient');
      if (cancelled || !canvasRef.current) return;
      const opts = buildOptions(variant, intensity, speed, colorA, colorB, colorC, baseColor);
      const handle = mountGradient(canvasRef.current, opts);
      if (!handle) return; // sin WebGL → se queda el estático
      handleRef.current = handle;
      canvasRef.current.style.opacity = '1';

      io = new IntersectionObserver((entries) => { inView = entries[0]?.isIntersecting ?? true; sync(); }, { threshold: 0.01 });
      if (containerRef.current) io.observe(containerRef.current);
      document.addEventListener('visibilitychange', onVis);
    })));

    return () => {
      cancelled = true;
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      handleRef.current?.destroy();
      handleRef.current = null;
    };
    // Monta una sola vez; los cambios de props se aplican en el efecto de abajo.
  }, []);

  // Reaplica opciones si cambian las props (color/variant/intensidad/velocidad).
  useEffect(() => {
    handleRef.current?.setOptions(buildOptions(variant, intensity, speed, colorA, colorB, colorC, baseColor));
  }, [variant, intensity, speed, colorA, colorB, colorC, baseColor]);

  const fadeStart = typeof fadeBottom === 'number' ? fadeBottom : 56;
  const mask = fadeBottom ? `linear-gradient(to bottom, #000 ${fadeStart}%, transparent 100%)` : undefined;

  return (
    <div ref={containerRef} aria-hidden="true" className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0, WebkitMaskImage: mask, maskImage: mask, ...style }}>
      {/* Fallback estático (primer paint, reduced-motion, móvil, sin WebGL). Azul. */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(58% 72% at 78% 12%, var(--info-tint), transparent 62%), radial-gradient(64% 80% at 16% 24%, var(--brand-tint), transparent 66%), radial-gradient(90% 90% at 50% 118%, var(--info-tint), transparent 60%), ${cssVarOrColor(baseColor)}` }} />
      {/* Canvas WebGL (encima del estático, aparece con fade al cargar). */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', opacity: 0, transition: 'opacity 600ms ease' }} />
      {/* Scrim: garantiza contraste AA del texto del hero. */}
      {scrim && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, color-mix(in srgb, var(--surface-page) 78%, transparent) 0%, color-mix(in srgb, var(--surface-page) 30%, transparent) 46%, transparent 72%)' }} />}
    </div>
  );
}

function buildOptions(variant: Variant, intensity: number | undefined, speed: number | undefined, ca: string, cb: string, cc: string, base: string): GradientOptions {
  const p = VARIANTS[variant];
  return {
    ...p,
    intensity: intensity ?? p.intensity,
    speed: speed ?? p.speed,
    base: resolveColor(base),
    colorA: resolveColor(ca),
    colorB: resolveColor(cb),
    colorC: resolveColor(cc),
  };
}

function cssVarOrColor(c: string): string {
  return c.startsWith('--') ? `var(${c})` : c;
}
