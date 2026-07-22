import type { CSSProperties } from 'react';

/**
 * Cuadrados que ascienden despacio, como una lluvia al revés.
 *
 * Decoración pura: `aria-hidden` y sin eventos de puntero, así que no interfiere
 * con el formulario que tiene delante ni con un lector de pantalla.
 *
 * **Por qué está escrito así:**
 * - Las posiciones son **fijas, no aleatorias**. Con `Math.random()` cada
 *   re-render (escribir en el formulario provoca varios) recolocaría los
 *   cuadrados de golpe y el efecto se rompería.
 * - Solo anima `transform` y `opacity`, que el navegador resuelve en la GPU sin
 *   recalcular layout. Con `top`/`height` esto costaría cuadros en un portátil
 *   modesto.
 * - Los `delay` negativos hacen que al cargar la pantalla la animación ya esté
 *   en marcha y repartida, en vez de arrancar con todos los cuadrados abajo.
 * - El color sale de los tokens de marca, así que sigue el tema de cada vertical
 *   (barbería azul / salón rosa) sin tocar este archivo.
 */

interface Cuadrado {
  /** % horizontal donde nace. */
  x: number;
  /** Lado en px. */
  lado: number;
  /** Segundos que tarda en cruzar de abajo arriba. */
  dur: number;
  /** Desfase inicial (negativo: ya empezó). */
  delay: number;
  opacidad: number;
  /** Grados que gira mientras sube. */
  giro: number;
}

/** Mezcla de tamaños y ritmos: los grandes suben lento, los pequeños rápido. */
const CUADRADOS: Cuadrado[] = [
  { x: 8, lado: 54, dur: 26, delay: -2, opacidad: 0.16, giro: 24 },
  { x: 22, lado: 22, dur: 18, delay: -9, opacidad: 0.22, giro: -30 },
  { x: 35, lado: 88, dur: 34, delay: -17, opacidad: 0.1, giro: 16 },
  { x: 49, lado: 16, dur: 15, delay: -5, opacidad: 0.26, giro: 40 },
  { x: 61, lado: 42, dur: 23, delay: -13, opacidad: 0.18, giro: -20 },
  { x: 74, lado: 68, dur: 30, delay: -21, opacidad: 0.12, giro: 28 },
  { x: 86, lado: 26, dur: 19, delay: -7, opacidad: 0.2, giro: -36 },
  { x: 94, lado: 38, dur: 27, delay: -15, opacidad: 0.14, giro: 18 },
  { x: 15, lado: 30, dur: 21, delay: -11, opacidad: 0.19, giro: -14 },
  { x: 43, lado: 60, dur: 32, delay: -25, opacidad: 0.11, giro: 22 },
  { x: 68, lado: 18, dur: 16, delay: -3, opacidad: 0.24, giro: -44 },
  { x: 81, lado: 46, dur: 25, delay: -19, opacidad: 0.15, giro: 12 },
];

export function RisingSquares({
  color = 'var(--brand)',
  className,
  style,
}: {
  /** Color base; se usa con alfa baja para que no compita con el contenido. */
  color?: string;
  /** Para mostrarla/ocultarla por breakpoint desde quien la usa. */
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={`ork-rising ${className ?? ''}`}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', ...style }}
    >
      {CUADRADOS.map((c, i) => (
        <span
          key={i}
          className="ork-rising-sq"
          style={{
            left: `${c.x}%`,
            width: c.lado,
            height: c.lado,
            // El radio crece con el lado: los pequeños casi redondos, los
            // grandes con esquina suave (mismo lenguaje que las tarjetas).
            borderRadius: Math.max(6, c.lado * 0.28),
            background: `color-mix(in srgb, ${color} ${Math.round(c.opacidad * 100)}%, transparent)`,
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
            ['--ork-giro' as string]: `${c.giro}deg`,
          }}
        />
      ))}
    </div>
  );
}
