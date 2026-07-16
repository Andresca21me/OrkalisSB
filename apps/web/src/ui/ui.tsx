import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ICONS } from './icons';
import { useDialogA11y } from '../lib/useDialogA11y';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info' | 'accent';

/** Icono Lucide (2px stroke, currentColor). `name` en kebab-case (ver icons.ts). */
export function Icon({
  name,
  size = 20,
  color = 'currentColor',
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  const Comp = ICONS[name];
  if (!Comp) {
    if (import.meta.env.DEV) console.warn(`[Icon] nombre Lucide desconocido: "${name}" (añádelo en ui/icons.ts)`);
    return <span style={{ display: 'inline-flex', width: size, height: size, flex: 'none', ...style }} />;
  }
  return (
    <span style={{ display: 'inline-flex', width: size, height: size, flex: 'none', ...style }}>
      <Comp width={size} height={size} stroke={color} strokeWidth={2} />
    </span>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost';
type BtnSize = 'sm' | 'md' | 'lg';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  fullWidth,
  iconLeft,
  iconRight,
  onClick,
  type = 'button',
  style,
}: {
  children?: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  iconLeft?: string;
  iconRight?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  style?: CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  const sizes = {
    sm: { height: 36, padding: '0 14px', font: 'var(--text-sm)', gap: 6, icon: 16 },
    md: { height: 44, padding: '0 18px', font: 'var(--text-base)', gap: 8, icon: 18 },
    lg: { height: 52, padding: '0 24px', font: 'var(--text-md)', gap: 8, icon: 20 },
  }[size];
  const palettes: Record<BtnVariant, { bg: string; color: string; border: string }> = {
    primary: { bg: hover ? 'var(--brand-hover)' : 'var(--brand)', color: '#fff', border: 'transparent' },
    secondary: {
      bg: hover ? 'var(--surface-sunken)' : 'var(--surface-card)',
      color: 'var(--text-primary)',
      border: 'var(--border-default)',
    },
    ghost: { bg: hover ? 'var(--surface-sunken)' : 'transparent', color: 'var(--text-secondary)', border: 'transparent' },
    danger: { bg: hover ? '#F05E54' : 'var(--error)', color: '#fff', border: 'transparent' },
    dangerGhost: { bg: hover ? 'var(--error-tint)' : 'transparent', color: 'var(--error)', border: 'transparent' },
  };
  const p = palettes[variant];
  const off = disabled || loading;
  const isPrimary = variant === 'primary';
  return (
    <button
      type={type}
      disabled={off}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={isPrimary ? 'ork-btn-primary' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: sizes.gap,
        height: sizes.height,
        padding: sizes.padding,
        width: fullWidth ? '100%' : 'auto',
        fontFamily: 'var(--font-body)',
        fontSize: sizes.font,
        fontWeight: 600,
        lineHeight: 1,
        color: p.color,
        border: `1px solid ${p.border}`,
        borderRadius: 'var(--radius-sm)',
        cursor: off ? 'not-allowed' : 'pointer',
        opacity: off ? 0.55 : 1,
        whiteSpace: 'nowrap',
        // El primario usa el gradiente animado de la clase CSS; el resto, bg inline.
        ...(isPrimary ? {} : { background: p.bg, transition: 'background var(--dur-fast) var(--ease-out)' }),
        ...style,
      }}
    >
      {loading ? <Spinner size={sizes.icon} color={p.color} /> : iconLeft && <Icon name={iconLeft} size={sizes.icon} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={sizes.icon} />}
    </button>
  );
}

export function IconButton({ name, onClick, title, size = 18 }: { name: string; onClick?: () => void; title?: string; size?: number }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        border: '1px solid var(--border-subtle)',
        background: h ? 'var(--surface-sunken)' : 'var(--surface-card)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
      }}
    >
      <Icon name={name} size={size} />
    </button>
  );
}

export function Spinner({ size = 18, color = 'var(--brand)' }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
        borderRadius: '9999px',
        animation: 'ork-spin 0.7s linear infinite',
      }}
    />
  );
}

export function Badge({
  children,
  tone = 'neutral',
  dot,
  solid,
  size = 'md',
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  solid?: boolean;
  size?: 'md' | 'lg';
  style?: CSSProperties;
}) {
  const tones: Record<Tone, { fg: string; bg: string; solidBg: string }> = {
    neutral: { fg: 'var(--text-secondary)', bg: 'var(--surface-sunken)', solidBg: 'var(--gray-600)' },
    brand: { fg: 'var(--brand)', bg: 'var(--brand-tint)', solidBg: 'var(--brand)' },
    success: { fg: '#0A8F5B', bg: 'var(--success-tint)', solidBg: 'var(--success)' },
    warning: { fg: '#B45309', bg: 'var(--warning-tint)', solidBg: 'var(--warning)' },
    error: { fg: 'var(--error)', bg: 'var(--error-tint)', solidBg: 'var(--error)' },
    info: { fg: 'var(--info)', bg: 'var(--info-tint)', solidBg: 'var(--info)' },
    accent: { fg: '#0A8F76', bg: 'var(--teal-tint)', solidBg: 'var(--accent)' },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: size === 'lg' ? 26 : 22,
        padding: size === 'lg' ? '0 10px' : '0 8px',
        fontFamily: 'var(--font-body)',
        fontSize: size === 'lg' ? 'var(--text-sm)' : 'var(--text-xs)',
        fontWeight: 600,
        lineHeight: 1,
        color: solid ? '#fff' : t.fg,
        background: solid ? t.solidBg : t.bg,
        borderRadius: 'var(--radius-xs)',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: 9999, background: solid ? '#fff' : t.fg, flex: 'none' }} />}
      {children}
    </span>
  );
}

/** Pill / etiqueta redondeada (radius-pill). Para chips de estado del sitio y filtros estáticos. */
export function Tag({ children, tone = 'accent', icon, style }: { children: ReactNode; tone?: 'accent' | 'brand'; icon?: string; style?: CSSProperties }) {
  const map = {
    accent: { c: '#0A8F76', bg: 'var(--teal-tint)', dot: 'var(--accent)' },
    brand: { c: 'var(--brand)', bg: 'var(--brand-tint)', dot: 'var(--brand)' },
  } as const;
  const m = map[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 13px',
        borderRadius: 'var(--radius-pill)',
        background: m.bg,
        color: m.c,
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {icon ? <Icon name={icon} size={13} color={m.c} /> : <span style={{ width: 6, height: 6, borderRadius: 99, background: m.dot }} />}
      {children}
    </span>
  );
}

const ESTADO_TONE: Record<string, Tone> = {
  solicitada: 'warning',
  confirmada: 'success',
  en_progreso: 'info',
  completada: 'neutral',
  cancelada: 'error',
  no_asistio: 'neutral',
  activa: 'success',
  suspendida: 'error',
  prueba: 'info',
  en_gracia: 'warning',
  cortesia: 'brand',
};
const ESTADO_LABEL: Record<string, string> = {
  solicitada: 'Solicitada',
  confirmada: 'Confirmada',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
  activa: 'Activa',
  suspendida: 'Suspendida',
  prueba: 'Prueba',
  en_gracia: 'En gracia',
  cortesia: 'Cortesía',
};
export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <Badge tone={ESTADO_TONE[estado] ?? 'neutral'} dot>
      {ESTADO_LABEL[estado] ?? estado}
    </Badge>
  );
}

export function Avatar({ name = '', size = 40 }: { name?: string; size?: number }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const palette = ['#1A73E8', '#0F1923', '#475569', '#00A88A', '#3B82F6', '#334155'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const bg = palette[Math.abs(hash) % palette.length];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
        width: size,
        height: size,
        borderRadius: '9999px',
        background: bg,
        color: '#fff',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: size * 0.38,
      }}
    >
      {initials || '?'}
    </span>
  );
}

export function Card({
  children,
  interactive,
  selected,
  onClick,
  padding = 16,
  style,
  testId,
  className,
}: {
  children: ReactNode;
  interactive?: boolean;
  selected?: boolean;
  onClick?: () => void;
  padding?: number;
  style?: CSSProperties;
  /** data-testid opcional (inerte) — para localizar la tarjeta en pruebas E2E. */
  testId?: string;
  /** Clase CSS opcional (p. ej. para reglas responsive). */
  className?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      data-testid={testId}
      className={className}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface-card)',
        border: `1px solid ${selected ? 'var(--brand)' : interactive && hover ? 'var(--border-default)' : 'var(--border-subtle)'}`,
        borderRadius: 'var(--radius-md)',
        padding,
        boxShadow: selected ? '0 0 0 1px var(--brand)' : 'var(--shadow-sm)',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'box-shadow var(--dur-base), border-color var(--dur-base)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="eyebrow" style={{ marginBottom: 10, ...style }}>
      {children}
    </div>
  );
}

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      {label && (
        <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
          {label}
        </span>
      )}
      {children}
      {error ? (
        <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--error)', marginTop: 5 }}>{error}</span>
      ) : (
        hint && <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 5 }}>{hint}</span>
      )}
    </label>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  height: 44,
  padding: '0 14px',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-base)',
  color: 'var(--text-primary)',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  outline: 'none',
};

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />;
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} style={{ ...inputStyle, ...props.style }}>
      {children}
    </select>
  );
}

export function Switch({ checked, onChange, tone = 'brand', disabled, testId }: { checked: boolean; onChange: (v: boolean) => void; tone?: 'brand' | 'success'; disabled?: boolean; testId?: string }) {
  const onColor = tone === 'success' ? 'var(--success)' : 'var(--brand)';
  return (
    <button
      type="button"
      role="switch"
      data-testid={testId}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 52,
        height: 32,
        borderRadius: 99,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flex: 'none',
        background: checked ? onColor : 'var(--border-default)',
        opacity: disabled ? 0.55 : 1,
        padding: 3,
        display: 'flex',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        alignItems: 'center',
        transition: 'background var(--dur-base) var(--ease-out)',
      }}
    >
      <span style={{ width: 26, height: 26, borderRadius: 99, background: '#fff', boxShadow: 'var(--shadow-sm)' }} />
    </button>
  );
}

export function Modal({ open, onClose, title, children, footer, ancho = 480 }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode; ancho?: number }) {
  const panelRef = useDialogA11y(open, onClose);
  const titleId = useId();
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,15,20,0.5)', animation: 'ork-fade var(--dur-base)' }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: ancho,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 id={titleId} style={{ fontSize: 'var(--text-lg)' }}>{title}</h3>
            <IconButton name="x" onClick={onClose} />
          </div>
        )}
        <div style={{ padding: 20, overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  hint,
  desc,
  action,
  compact,
}: {
  icon?: string;
  title: string;
  /** Texto secundario. `hint` y `desc` son equivalentes (compat). */
  hint?: string;
  desc?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  const body = desc ?? hint;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: compact ? '40px 24px' : '72px 24px', gap: 6 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 'var(--radius-lg)', background: 'var(--surface-sunken)', marginBottom: 8 }}>
        <Icon name={icon} size={26} color="var(--text-tertiary)" />
      </span>
      <h3 style={{ fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>{title}</h3>
      {body && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: 340, margin: 0 }}>{body}</p>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}

/** Estado de error con reintento (envuelto en Card como en el prototipo). */
export function ErrorState({
  onRetry,
  title = 'No pudimos cargar la información',
  desc = 'Revisa tu conexión e inténtalo de nuevo.',
}: {
  onRetry?: () => void;
  title?: string;
  desc?: string;
}) {
  return (
    <Card padding={0}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '64px 24px', gap: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 'var(--radius-lg)', background: 'var(--error-tint)', marginBottom: 8 }}>
          <Icon name="alert-octagon" size={26} color="var(--error)" />
        </span>
        <h3 style={{ fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>{title}</h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: 340, margin: 0 }}>{desc}</p>
        {onRetry && (
          <div style={{ marginTop: 12 }}>
            <Button variant="secondary" size="md" iconLeft="refresh-cw" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function Skeleton({ w = '100%', h = 16, r = 6, style }: { w?: number | string; h?: number; r?: number; style?: CSSProperties }) {
  return <div className="ork-shimmer" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

// ── Toasts ──────────────────────────────────────────────────────────────────
type Toast = { id: number; msg: string; tone: Tone };
const ToastCtx = createContext<(msg: string, tone?: Tone) => void>(() => {});
export function useToast() {
  return useContext(ToastCtx);
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  const iconFor: Record<string, string> = { success: 'check-circle', error: 'alert-circle', info: 'info', warning: 'alert-triangle' };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 200, pointerEvents: 'none' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--navy)',
              color: '#fff',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-xl)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              animation: 'ork-toast var(--dur-slow)',
            }}
          >
            <Icon name={iconFor[t.tone] ?? 'info'} size={18} color={`var(--${t.tone === 'neutral' ? 'brand' : t.tone})`} />
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ── Logo (marca "O" geométrica) ──────────────────────────────────────────────
export function Logo({ size = 26, color = 'var(--navy)', word = true }: { size?: number; color?: string; word?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <span
        style={{ display: 'inline-flex', width: size, height: size, flex: 'none' }}
        dangerouslySetInnerHTML={{
          __html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="2.5" width="19" height="19" rx="6.5" stroke="${color}" stroke-width="2.4"/><circle cx="14.5" cy="14.5" r="4.2" fill="${color}"/></svg>`,
        }}
      />
      {word && <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.04em', color, textTransform: 'uppercase' }}>Orkalis</span>}
    </span>
  );
}

// ── Popover (menú/selector anclado) ──────────────────────────────────────────
export function Popover({ open, onClose, children, align = 'left', width }: { open: boolean; onClose: () => void; children: ReactNode; align?: 'left' | 'right'; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div
        role="menu"
        style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          [align]: 0,
          zIndex: 41,
          width,
          minWidth: 200,
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          padding: 6,
          animation: 'ork-pop var(--dur-base) var(--ease-out)',
        }}
      >
        {children}
      </div>
    </>
  );
}

// ── MenuItem (fila de menú) ──────────────────────────────────────────────────
export function MenuItem({ icon, children, onClick, danger, active, hint }: { icon?: string; children: ReactNode; onClick?: () => void; danger?: boolean; active?: boolean; hint?: string }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 38,
        padding: '0 10px',
        border: 'none',
        borderRadius: 'var(--radius-xs)',
        cursor: 'pointer',
        textAlign: 'left',
        background: hover ? (danger ? 'var(--error-tint)' : 'var(--surface-sunken)') : 'transparent',
        color: danger ? 'var(--error)' : active ? 'var(--brand)' : 'var(--text-primary)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
      }}
    >
      {icon && <Icon name={icon} size={16} color={danger ? 'var(--error)' : active ? 'var(--brand)' : 'var(--text-tertiary)'} />}
      <span style={{ flex: 1 }}>{children}</span>
      {hint && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{hint}</span>}
      {active && <Icon name="check" size={15} color="var(--brand)" />}
    </button>
  );
}

// ── BranchSelector (sucursal vs. consolidado) ────────────────────────────────
export function BranchSelector({
  consolidado,
  sucursales,
  activaNombre,
  onConsolidado,
  onPick,
}: {
  consolidado: boolean;
  sucursales: { id: string; nombre: string }[];
  activaNombre?: string;
  onConsolidado: () => void;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = consolidado ? 'Todo el negocio' : (activaNombre ?? 'Sucursal');
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        data-testid="branch-selector"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9,
          height: 38,
          padding: '0 12px',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-xs)',
          maxWidth: 240,
        }}
      >
        <Icon name={consolidado ? 'layout-grid' : 'store'} size={16} color="var(--text-tertiary)" />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <Icon name="chevron-down" size={15} color="var(--text-tertiary)" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} width={248}>
        <div className="eyebrow" style={{ padding: '6px 10px 4px' }}>Vista</div>
        <MenuItem icon="layout-grid" active={consolidado} onClick={() => { onConsolidado(); setOpen(false); }}>
          Todo el negocio
        </MenuItem>
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 4px' }} />
        <div className="eyebrow" style={{ padding: '2px 10px 4px' }}>Sucursales</div>
        {sucursales.map((b) => (
          <MenuItem key={b.id} icon="store" active={!consolidado && b.nombre === activaNombre} onClick={() => { onPick(b.id); setOpen(false); }}>
            {b.nombre}
          </MenuItem>
        ))}
      </Popover>
    </div>
  );
}

// ── Checkbox ─────────────────────────────────────────────────────────────────
export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 20,
          height: 20,
          flex: 'none',
          borderRadius: 'var(--radius-xs)',
          border: `1px solid ${checked ? 'var(--brand)' : 'var(--border-default)'}`,
          background: checked ? 'var(--brand)' : 'var(--surface-card)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
        }}
      >
        {checked && <Icon name="check" size={14} color="#fff" />}
      </button>
      {label && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{label}</span>}
    </label>
  );
}

// ── Textarea ─────────────────────────────────────────────────────────────────
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        ...inputStyle,
        height: 'auto',
        minHeight: 88,
        padding: '10px 14px',
        lineHeight: 'var(--leading-base)',
        resize: 'vertical',
        ...props.style,
      }}
    />
  );
}

// ── KpiCard ──────────────────────────────────────────────────────────────────
export function KpiCard({
  label,
  value,
  icon,
  trend,
  sub,
  loading,
}: {
  label: string;
  value?: ReactNode;
  icon?: string;
  trend?: { dir?: 'up' | 'down'; tone?: 'neutral'; value: string };
  sub?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card padding={18} style={{ minHeight: 116 }}>
        <Skeleton w={120} h={13} />
        <div style={{ height: 14 }} />
        <Skeleton w={96} h={28} />
        <div style={{ height: 12 }} />
        <Skeleton w={80} h={12} />
      </Card>
    );
  }
  const up = trend?.dir === 'up';
  const down = trend?.dir === 'down';
  const trendColor = trend
    ? trend.tone === 'neutral'
      ? 'var(--text-tertiary)'
      : up
        ? 'var(--accent)'
        : down
          ? 'var(--error)'
          : 'var(--text-secondary)'
    : undefined;
  return (
    <Card padding={18} style={{ minHeight: 116, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
        {icon && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', flex: 'none' }}>
            <Icon name={icon} size={17} color="var(--text-tertiary)" />
          </span>
        )}
      </div>
      <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginTop: 8, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ flex: 1 }} />
      {(trend || sub) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          {trend && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 600, color: trendColor }}>
              {(up || down) && <span style={{ fontSize: 13 }}>{up ? '↑' : '↓'}</span>}
              {trend.value}
            </span>
          )}
          {sub && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{sub}</span>}
        </div>
      )}
    </Card>
  );
}

// ── StatTile (estadística compacta en fila) ──────────────────────────────────
export function StatTile({ label, value, icon, accent, loading }: { label: string; value?: ReactNode; icon?: string; accent?: boolean; loading?: boolean }) {
  if (loading) {
    return (
      <Card padding={16}>
        <Skeleton w={90} h={12} />
        <div style={{ height: 10 }} />
        <Skeleton w={70} h={24} />
      </Card>
    );
  }
  return (
    <Card padding={16} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {icon && (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 'var(--radius-sm)', flex: 'none', background: accent ? 'var(--brand-tint)' : 'var(--surface-sunken)' }}>
          <Icon name={icon} size={19} color={accent ? 'var(--brand)' : 'var(--text-tertiary)'} />
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</div>
        <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-xl)', letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.2 }}>{value}</div>
      </div>
    </Card>
  );
}

// ── Tabs (subrayadas) ────────────────────────────────────────────────────────
type TabItem = string | { value: string; label: string };
export function Tabs({ tabs, value, onChange }: { tabs: TabItem[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)' }}>
      {tabs.map((tab) => {
        const v = typeof tab === 'object' ? tab.value : tab;
        const l = typeof tab === 'object' ? tab.label : tab;
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{
              position: 'relative',
              height: 40,
              padding: '0 4px',
              marginRight: 14,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: on ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          >
            {l}
            <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, borderRadius: 2, background: on ? 'var(--brand)' : 'transparent' }} />
          </button>
        );
      })}
    </div>
  );
}

// ── Segmented (control segmentado) ───────────────────────────────────────────
export function Segmented({ options, value, onChange, size = 'md' }: { options: TabItem[]; value: string; onChange: (v: string) => void; size?: 'md' | 'lg' }) {
  const h = size === 'lg' ? 44 : 38;
  return (
    <div style={{ display: 'flex', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', padding: 3, gap: 3 }}>
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? o.label : o;
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{
              flex: 1,
              height: h,
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
              background: on ? 'var(--surface-card)' : 'transparent',
              color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              boxShadow: on ? 'var(--shadow-xs)' : 'none',
              transition: 'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

// ── Alert (banner contextual) ────────────────────────────────────────────────
export function Alert({ tone = 'info', title, children, icon, style }: { tone?: 'info' | 'success' | 'warning' | 'error'; title?: ReactNode; children?: ReactNode; icon?: string; style?: CSSProperties }) {
  const map = {
    info: { fg: 'var(--info)', bg: 'var(--info-tint)', bd: 'rgba(59,130,246,0.22)', icon: 'info' },
    success: { fg: 'var(--success)', bg: 'var(--success-tint)', bd: 'rgba(16,185,129,0.22)', icon: 'check-circle' },
    warning: { fg: '#B45309', bg: 'var(--warning-tint)', bd: 'rgba(245,158,11,0.28)', icon: 'alert-triangle' },
    error: { fg: 'var(--error)', bg: 'var(--error-tint)', bd: 'rgba(239,68,68,0.22)', icon: 'alert-octagon' },
  } as const;
  const m = map[tone];
  return (
    <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 'var(--radius-md)', background: m.bg, border: `1px solid ${m.bd}`, ...style }}>
      <Icon name={icon ?? m.icon} size={18} color={m.fg} style={{ marginTop: 1, flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: children ? 3 : 0 }}>{title}</div>}
        {children && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: '18px' }}>{children}</div>}
      </div>
    </div>
  );
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--navy)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            zIndex: 120,
            pointerEvents: 'none',
            animation: 'ork-fade var(--dur-fast) var(--ease-out)',
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}

// ── SearchInput ──────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Buscar…', width }: { value: string; onChange: (v: string) => void; placeholder?: string; width?: number | string }) {
  const [focus, setFocus] = useState(false);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 40,
        padding: '0 12px',
        width,
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${focus ? 'var(--brand)' : 'var(--border-default)'}`,
        boxShadow: focus ? '0 0 0 3px var(--brand-tint)' : 'var(--shadow-xs)',
        transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
      }}
    >
      <Icon name="search" size={17} color="var(--text-tertiary)" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', padding: 2 }}>
          <Icon name="x" size={15} color="var(--text-tertiary)" />
        </button>
      )}
    </div>
  );
}

// ── QtyStepper ───────────────────────────────────────────────────────────────
export function QtyStepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const btn = (icon: string, fn: () => void, disabled: boolean) => (
    <button
      type="button"
      disabled={disabled}
      onClick={fn}
      style={{
        width: 32,
        height: 32,
        borderRadius: 'var(--radius-xs)',
        border: '1px solid var(--border-default)',
        background: 'var(--surface-card)',
        color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      <Icon name={icon} size={16} />
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {btn('minus', () => onChange(Math.max(min, value - 1)), value <= min)}
      <span className="data" style={{ minWidth: 20, textAlign: 'center', fontWeight: 600, fontSize: 'var(--text-base)' }}>{value}</span>
      {btn('plus', () => onChange(Math.min(max, value + 1)), value >= max)}
    </div>
  );
}

// ── Stars (rating) ───────────────────────────────────────────────────────────
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <Icon name="star" size={size} color="#F59E0B" style={{ fill: '#F59E0B' }} />
      <span className="data" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{value.toFixed(1)}</span>
    </span>
  );
}

// ── Chip (seleccionable: métodos de pago, filtros) ───────────────────────────
export function Chip({ active, children, onClick, icon, disabled }: { active?: boolean; children: ReactNode; onClick?: () => void; icon?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 42,
        padding: '0 14px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: 'var(--radius-sm)',
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        border: `1px solid ${active ? 'var(--brand)' : 'var(--border-default)'}`,
        background: active ? 'var(--brand-tint)' : 'var(--surface-card)',
        color: active ? 'var(--brand)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        transition: 'all var(--dur-fast) var(--ease-out)',
      }}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

// ── Dialog (modal de escritorio con subtítulo) ───────────────────────────────
export function Dialog({ open, onClose, title, subtitle, children, footer, width = 520 }: { open: boolean; onClose: () => void; title?: string; subtitle?: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  const panelRef = useDialogA11y(open, onClose);
  const titleId = useId();
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,15,20,0.5)', animation: 'ork-fade var(--dur-base) var(--ease-out)' }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: width,
          maxHeight: 'calc(100vh - 48px)',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '20px 22px 14px' }}>
          <div>
            <h2 id={titleId} style={{ fontSize: 'var(--text-xl)', letterSpacing: '-0.02em' }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{subtitle}</p>}
          </div>
          <IconButton name="x" onClick={onClose} title="Cerrar" />
        </div>
        <div style={{ overflowY: 'auto', padding: '0 22px 4px', flex: 1 }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px 20px', borderTop: '1px solid var(--border-subtle)', marginTop: 8 }}>{footer}</div>}
      </div>
    </div>
  );
}
