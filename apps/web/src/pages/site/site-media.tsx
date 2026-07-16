import { useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../../ui/ui';

/**
 * Marco de imagen del sitio de marketing. Muestra la **foto real** si existe en
 * `src` (colócala en `apps/web/public/marketing/…`); mientras no exista, muestra
 * un **placeholder guiado** que indica qué imagen va ahí (tipo, uso y medida).
 * Así la página se ve intencional aún sin fotos y tú ves dónde colocar cada una.
 *
 * Nunca desborda: ancho 100% + `aspect-ratio` + `object-fit: cover`.
 */
export function MediaFrame({
  src,
  alt,
  ratio = '16 / 10',
  label,
  hint,
  icon = 'image',
  circle = false,
  kenburns = false,
  frame = true,
  style,
  children,
}: {
  src?: string;
  alt: string;
  ratio?: string;
  label?: string;
  hint?: string;
  icon?: string;
  circle?: boolean;
  kenburns?: boolean;
  frame?: boolean;
  style?: CSSProperties;
  children?: ReactNode; // overlays (chips, textos) posicionados sobre la imagen
}) {
  const [ok, setOk] = useState(false);
  const radius = circle ? '50%' : 'var(--radius-lg)';
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: circle ? '1 / 1' : ratio,
        borderRadius: radius,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--surface-sunken), color-mix(in srgb, var(--brand-tint) 60%, var(--surface-sunken)))',
        border: frame ? '1px solid var(--border-subtle)' : 'none',
        boxShadow: frame && !circle ? 'var(--shadow-lg)' : 'none',
        ...style,
      }}
    >
      {src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setOk(true)}
          onError={() => setOk(false)}
          className={kenburns ? 'mkt-kenburns' : undefined}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: ok ? 1 : 0, transition: 'opacity 0.5s ease' }}
        />
      )}
      {/* Placeholder guiado (visible mientras no cargue la foto real). */}
      {!ok && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 16 }}>
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46, borderRadius: 'var(--radius-md)', background: 'color-mix(in srgb, var(--brand) 12%, transparent)', marginBottom: 10 }}>
              <Icon name={icon} size={22} color="var(--brand)" />
            </span>
            {label && <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</div>}
            {hint && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 3, maxWidth: 220, marginInline: 'auto', lineHeight: 1.4 }}>{hint}</div>}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

/** Chip "notificación" flotante para superponer sobre el mock/foto del hero. */
export function FloatingChip({
  icon,
  title,
  sub,
  tone = 'brand',
  style,
  float = 'slow',
}: {
  icon: string;
  title: string;
  sub?: string;
  tone?: 'brand' | 'accent';
  style?: CSSProperties;
  float?: 'slow' | 'fast' | 'none';
}) {
  const c = tone === 'accent' ? 'var(--accent)' : 'var(--brand)';
  const bg = tone === 'accent' ? 'var(--teal-tint)' : 'var(--brand-tint)';
  const cls = float === 'fast' ? 'mkt-float' : float === 'slow' ? 'mkt-float-slow' : undefined;
  return (
    <div
      className={cls}
      style={{
        position: 'absolute',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 13px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-lg)',
        ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: bg, flex: 'none' }}>
        <Icon name={icon} size={17} color={c} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{title}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
    </div>
  );
}

/** Mancha de color difusa, decorativa (profundidad detrás del mock/CTA). */
export function GlowBlob({ color = 'var(--brand)', size = 340, style }: { color?: string; size?: number; style?: CSSProperties }) {
  return (
    <div aria-hidden style={{ position: 'absolute', width: size, height: size, borderRadius: '50%', background: color, filter: 'blur(90px)', opacity: 0.18, pointerEvents: 'none', ...style }} />
  );
}

/** Franja "confían en nosotros" que se desliza en bucle (ciudades / negocios). */
export function Marquee({ items }: { items: string[] }) {
  const loop = [...items, ...items];
  return (
    <div className="mkt-marquee-mask" style={{ overflow: 'hidden', width: '100%' }}>
      <div className="mkt-marquee-track">
        {loop.map((it, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-tertiary)' }}>
            <Icon name="map-pin" size={14} color="var(--text-tertiary)" />
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
