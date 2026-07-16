import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Aparición animada al entrar en viewport (IntersectionObserver) — para el sitio
 * de marketing. Funciona en la primera carga (lo que está sobre el pliegue
 * dispara de inmediato) y al hacer scroll. Solo opacity + transform (GPU).
 * Respeta `prefers-reduced-motion`.
 *
 * @param delay  retardo en ms (para escalonar tarjetas: `delay={i * 80}`).
 * @param y      desplazamiento inicial en px (sube al aparecer).
 * @param once   si false, vuelve a ocultarse al salir (re-anima al re-entrar).
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  once = true,
  threshold = 0.15,
  style,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  once?: boolean;
  threshold?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting) {
          setShown(true);
          if (once) io.disconnect();
        } else if (!once) {
          setShown(false);
        }
      },
      { threshold, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : `translateY(${y}px)`,
        transition: `opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.65s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: 'opacity, transform',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
