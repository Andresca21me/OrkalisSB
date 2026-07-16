import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Icon } from './ui';

/** Un paso del tour: resalta un elemento (por selector) y explica qué es/hace. */
export interface TourStep {
  /** Selector CSS del elemento a resaltar (p. ej. `[data-tour="nav-agenda"]`). Omitir = tarjeta centrada. */
  target?: string;
  title: string;
  body: ReactNode;
  /** Se ejecuta al entrar al paso (p. ej. cambiar de sección para que el elemento exista). */
  onEnter?: () => void;
  /** Texto del botón de avanzar (por defecto "Siguiente"; en el último, "¡Listo!"). */
  nextLabel?: string;
}

const RING = 8; // holgura del recuadro alrededor del objetivo
const CARD_W = 344;

/**
 * Tour guiado (coach marks) para el onboarding del panel. Oscurece la pantalla,
 * abre un "foco" sobre el elemento señalado y muestra una tarjeta con el título,
 * la explicación y los controles Atrás / Siguiente / Saltar. Avanza con el botón
 * (o ← → / Esc). Respeta `prefers-reduced-motion`.
 */
export function Tour({
  steps,
  open,
  onClose,
  onFinish,
}: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  onFinish?: () => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(200);
  // En móvil el nav de escritorio está oculto (Shell, ≤920px): no hay elementos
  // que resaltar, así que el tour se muestra como una secuencia de tarjetas
  // centradas (sin spotlight), legible a pantalla completa.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 920px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 920px)');
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const last = i >= steps.length - 1;
  const step = steps[i];

  // Reinicia al abrir.
  useEffect(() => { if (open) setI(0); }, [open]);

  // Al entrar a un paso: ejecuta su efecto y mide el objetivo (reintenta hasta que exista).
  useLayoutEffect(() => {
    if (!open || !step) return;
    step.onEnter?.();
    // Móvil: sin objetivo que resaltar → tarjeta centrada. No medimos ni hacemos
    // scroll a elementos del nav de escritorio (que están ocultos).
    if (isMobile) { setRect(null); return; }
    let raf = 0;
    let tries = 0;
    // Rect visible: descarta objetivos ocultos (display:none → 0×0), p. ej. el nav
    // en móvil; en ese caso el paso se muestra como tarjeta centrada.
    const visibleRect = (el: HTMLElement | null): DOMRect | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : null;
    };
    const measure = () => {
      const el = step.target ? document.querySelector<HTMLElement>(step.target) : null;
      if (step.target && !el && tries < 30) { tries += 1; raf = requestAnimationFrame(measure); return; }
      if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      setRect(visibleRect(el));
    };
    raf = requestAnimationFrame(measure);
    const onMove = () => {
      const el = step.target ? document.querySelector<HTMLElement>(step.target) : null;
      setRect(visibleRect(el));
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [i, open, isMobile]);

  // Mide la altura de la tarjeta para ubicarla arriba/abajo del objetivo.
  useLayoutEffect(() => { if (cardRef.current) setCardH(cardRef.current.offsetHeight); }, [i, rect]);

  // Teclado: ← → avanzan/retroceden, Esc salta.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setI((v) => Math.min(steps.length - 1, v + 1));
      else if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, steps.length, onClose]);

  if (!open || !step) return null;

  const next = () => (last ? finish() : setI((v) => v + 1));
  const finish = () => { onFinish?.(); onClose(); };

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Posición de la tarjeta: centrada si no hay objetivo; si hay, debajo (o arriba si no cabe).
  let cardStyle: React.CSSProperties;
  let arrow: 'up' | 'down' | null = null;
  if (!rect) {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  } else {
    const below = rect.bottom + 14 + cardH < vh;
    const top = below ? rect.bottom + 14 : Math.max(14, rect.top - 14 - cardH);
    const left = Math.min(Math.max(14, rect.left + rect.width / 2 - CARD_W / 2), vw - CARD_W - 14);
    cardStyle = { top, left };
    arrow = below ? 'up' : 'down';
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} role="dialog" aria-modal="true" aria-label="Tutorial">
      {/* Capa oscura con "foco". Si hay objetivo, un recuadro con sombra gigante recorta el hueco. */}
      {rect ? (
        <div
          style={{
            position: 'fixed',
            top: rect.top - RING,
            left: rect.left - RING,
            width: rect.width + RING * 2,
            height: rect.height + RING * 2,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(9,14,20,0.62)',
            outline: '2px solid var(--brand)',
            transition: 'all 0.28s cubic-bezier(0.16,1,0.3,1)',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,14,20,0.62)' }} onClick={onClose} />
      )}

      {/* Tarjeta del paso */}
      <div
        ref={cardRef}
        style={{
          position: 'fixed',
          width: CARD_W,
          maxWidth: 'calc(100vw - 28px)',
          maxHeight: 'calc(100vh - 28px)',
          overflowY: 'auto',
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl, var(--shadow-lg))',
          padding: 18,
          transition: 'top 0.28s cubic-bezier(0.16,1,0.3,1), left 0.28s cubic-bezier(0.16,1,0.3,1)',
          ...cardStyle,
        }}
      >
        {arrow && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              [arrow === 'up' ? 'top' : 'bottom']: -6,
              left: Math.min(Math.max(16, (rect!.left + rect!.width / 2) - (cardStyle.left as number)), CARD_W - 28),
              width: 12,
              height: 12,
              background: 'var(--surface-card)',
              borderTop: '1px solid var(--border-subtle)',
              borderLeft: '1px solid var(--border-subtle)',
              transform: `rotate(${arrow === 'up' ? 45 : 225}deg)`,
            }}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--brand)' }}>
            <Icon name="compass" size={14} color="var(--brand)" />
            Tutorial · {i + 1} de {steps.length}
          </span>
          <button type="button" onClick={onClose} aria-label="Saltar tutorial" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'inline-flex', padding: 2 }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{step.title}</h3>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '8px 0 0' }}>{step.body}</div>

        {/* Progreso (puntos) */}
        <div style={{ display: 'flex', gap: 5, margin: '16px 0 14px' }}>
          {steps.map((_, s) => (
            <span key={s} style={{ height: 5, flex: 1, borderRadius: 99, background: s <= i ? 'var(--brand)' : 'var(--border-default)', transition: 'background 0.2s' }} />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', fontWeight: 600, padding: '6px 4px' }}>Saltar</button>
          <div style={{ flex: 1 }} />
          {i > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setI((v) => Math.max(0, v - 1))}>Atrás</Button>
          )}
          <Button variant="primary" size="sm" iconRight={last ? 'check' : 'arrow-right'} onClick={next}>
            {step.nextLabel ?? (last ? '¡Listo!' : 'Siguiente')}
          </Button>
        </div>
      </div>
    </div>
  );
}
