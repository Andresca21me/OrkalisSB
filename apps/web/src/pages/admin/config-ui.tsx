import type { CSSProperties, ReactNode } from 'react';
import type { Procedencia } from '../../lib/useConfig';
import { Badge, Card, Icon } from '../../ui/ui';

export type Scope = 'negocio' | 'sucursal';

export function ConfigCard({ title, desc, action, pad = 22, children }: { title?: string; desc?: string; action?: ReactNode; pad?: number; children: ReactNode }) {
  return (
    <Card padding={0} style={{ marginBottom: 16 }}>
      {/* `flexWrap` + `minWidth:0`: en móvil el botón de acción no cabe al lado
          del título y, sin envolver, empujaba el texto fuera de la tarjeta. Un
          ítem flex no se encoge por debajo del ancho de su contenido si no se
          le baja el min-width. */}
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: `18px ${pad}px 0` }}>
          <div style={{ minWidth: 0, flex: '1 1 240px' }}>
            {title && <h3 style={{ fontSize: 'var(--text-md)', letterSpacing: '-0.01em' }}>{title}</h3>}
            {desc && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '4px 0 0', maxWidth: 560 }}>{desc}</p>}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: `${title ? 14 : pad}px ${pad}px ${pad}px` }}>{children}</div>
    </Card>
  );
}

const BANNER: Record<string, { bg: string; border: string; fg: string; icon: string }> = {
  info: { bg: 'var(--info-tint)', border: 'rgba(59,130,246,0.22)', fg: 'var(--info)', icon: 'info' },
  warning: { bg: 'var(--warning-tint)', border: 'rgba(245,158,11,0.30)', fg: '#B45309', icon: 'alert-triangle' },
  brand: { bg: 'var(--brand-tint)', border: 'var(--brand-tint-border)', fg: 'var(--brand)', icon: 'info' },
  danger: { bg: 'var(--error-tint)', border: 'rgba(239,68,68,0.25)', fg: 'var(--error)', icon: 'alert-octagon' },
};
export function ConfigBanner({ tone = 'info', title, icon, action, children }: { tone?: 'info' | 'warning' | 'brand' | 'danger'; title: ReactNode; icon?: string; action?: ReactNode; children?: ReactNode }) {
  const b = BANNER[tone];
  return (
    <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 'var(--radius-md)', background: b.bg, border: `1px solid ${b.border}` }}>
      <Icon name={icon ?? b.icon} size={18} color={b.fg} style={{ flex: 'none', marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: children ? 4 : 0 }}>{title}</div>
        {children && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: '21px' }}>{children}</div>}
      </div>
      {action && <div style={{ flex: 'none' }}>{action}</div>}
    </div>
  );
}

const PROC_LABEL: Record<Procedencia, string> = { sistema: 'Por defecto', negocio: 'Del negocio', sucursal: 'De esta sucursal' };
const PROC_TONE: Record<Procedencia, 'neutral' | 'info' | 'brand'> = { sistema: 'neutral', negocio: 'info', sucursal: 'brand' };

/** Indicador de procedencia + acción sobrescribir/heredar (solo en scope sucursal). */
export function ProvControl({ scope, procedencia, onOverride, onInherit }: { scope: Scope; procedencia: Procedencia; onOverride: () => void; onInherit: () => void }) {
  const overridden = procedencia === 'sucursal';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Badge tone={PROC_TONE[procedencia]} size="md">{PROC_LABEL[procedencia]}</Badge>
      {scope === 'sucursal' && (
        <button type="button" onClick={overridden ? onInherit : onOverride} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px' }}>
          <Icon name={overridden ? 'corner-up-left' : 'edit'} size={12} color="var(--brand)" />
          {overridden ? 'Volver a heredar' : 'Sobrescribir aquí'}
        </button>
      )}
    </div>
  );
}

/** Fila de ajuste: icono + título + descripción + control a la derecha. */
export function SettingRow({ first, icon, title, desc, badge, prov, children }: { first?: boolean; icon?: string; title: string; desc?: string; badge?: ReactNode; prov?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', padding: '18px 0', borderTop: first ? 'none' : '1px solid var(--border-subtle)' }}>
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', flex: 'none' }}><Icon name={icon} size={18} color="var(--text-secondary)" /></span>}
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
          {badge}
        </div>
        {desc && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '3px 0 0', maxWidth: 460, lineHeight: '20px' }}>{desc}</p>}
        {prov && <div style={{ marginTop: 8 }}>{prov}</div>}
      </div>
      <div style={{ flex: 'none', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>{children}</div>
    </div>
  );
}

/** Campo con label + control + procedencia (parámetros numéricos/financieros). */
export function ProvField({ label, hint, error, prov, children }: { label: ReactNode; hint?: string; error?: string; prov?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ minWidth: 0, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        {prov}
      </div>
      {children}
      {error ? (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="alert-circle" size={13} color="var(--error)" />{error}</span>
      ) : hint ? (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{hint}</span>
      ) : null}
    </div>
  );
}

export const thConfig: CSSProperties = { textAlign: 'left', padding: '13px 22px', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' };
