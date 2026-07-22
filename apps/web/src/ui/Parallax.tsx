import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * Desplaza un elemento hacia arriba a distinta velocidad que la página, para
 * dar profundidad al hacer scroll (FASE-13).
 *
 * **Rendimiento — lo que hace que esto no vaya a tirones:**
 * - **Un solo listener de scroll para toda la página**, compartido por todas las
 *   instancias. Con un listener por elemento, media docena de tarjetas ya se
 *   notan en un portátil modesto.
 * - Las lecturas (`getBoundingClientRect`) y las escrituras (`transform`) van
 *   agrupadas dentro de un `requestAnimationFrame`, así el navegador no alterna
 *   medir/pintar y no provoca *layout thrashing*.
 * - Solo se toca `transform`: sin recalcular layout.
 * - Los elementos fuera de pantalla no se actualizan.
 *
 * Con `prefers-reduced-motion` no se registra nada: el elemento queda quieto.
 */

type Suscriptor = () => void;
const suscriptores = new Set<Suscriptor>();
let pendiente = false;
let listenerPuesto = false;

function alHacerScroll(): void {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => {
    pendiente = false;
    for (const fn of suscriptores) fn();
  });
}

function suscribir(fn: Suscriptor): () => void {
  suscriptores.add(fn);
  if (!listenerPuesto) {
    window.addEventListener('scroll', alHacerScroll, { passive: true });
    window.addEventListener('resize', alHacerScroll, { passive: true });
    listenerPuesto = true;
  }
  fn(); // posición inicial, sin esperar al primer scroll
  return () => {
    suscriptores.delete(fn);
    if (suscriptores.size === 0 && listenerPuesto) {
      window.removeEventListener('scroll', alHacerScroll);
      window.removeEventListener('resize', alHacerScroll);
      listenerPuesto = false;
    }
  };
}

export function Parallax({
  children,
  /** Cuánto se adelanta al scroll. 0.06–0.14 es sutil; más ya se nota artificial. */
  velocidad = 0.09,
  /** Tope en px, para que nunca se despegue tanto que rompa la composición. */
  maximo = 60,
  style,
}: {
  children: ReactNode;
  velocidad?: number;
  maximo?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    return suscribir(() => {
      const r = el.getBoundingClientRect();
      const alto = window.innerHeight;
      if (r.bottom < -200 || r.top > alto + 200) return; // fuera de pantalla

      // 0 cuando el elemento entra por abajo, 1 cuando sale por arriba.
      const avance = (alto - r.top) / (alto + r.height);
      const y = Math.max(-maximo, Math.min(maximo, -(avance - 0.5) * 2 * maximo * (velocidad / 0.09)));
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    });
  }, [velocidad, maximo]);

  return (
    <div ref={ref} style={{ willChange: 'transform', ...style }}>
      {children}
    </div>
  );
}
