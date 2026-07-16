import type { ReactNode } from 'react';
import { Icon } from './ui';

/**
 * Chrome móvil-first (FASE-02), fiel a `screens-common.jsx` y `spec-ui.jsx`.
 * Usado por la reserva pública (FASE-03) y la app del especialista (FASE-10).
 * Respeta `safe-area-inset` (notch / barra inferior, RNF-003).
 */

/** Columna móvil centrada (máx. 480px) que ocupa el alto completo. */
export function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-sunken)', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          minHeight: '100vh',
          background: 'var(--surface-page)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Cabecera de la app: atrás opcional + título centrado + slot derecho. */
export function AppHeader({ title, sub, onBack, right }: { title: string; sub?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header
      style={{
        flex: 'none',
        paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
        background: 'var(--surface-card)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'relative',
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 12px', minHeight: 44 }}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: 'var(--radius-sm)', flex: 'none', marginLeft: -6 }}
          >
            <Icon name="chevron-left" size={24} />
          </button>
        ) : (
          <div style={{ width: 34, flex: 'none' }} />
        )}
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-md)', letterSpacing: '-0.02em', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>{sub}</div>}
        </div>
        <div style={{ width: 40, flex: 'none', display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
      </div>
    </header>
  );
}

/** Zona scrollable del contenido. */
export function ScrollArea({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', background: 'var(--surface-page)', ...style }}>
      {children}
    </main>
  );
}

/** Barra inferior fija (CTA + resumen) con safe-area. */
export function FooterBar({ children }: { children: ReactNode }) {
  return (
    <footer
      style={{
        flex: 'none',
        background: 'var(--surface-card)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '12px 16px calc(env(safe-area-inset-bottom) + 14px)',
        boxShadow: '0 -4px 16px rgba(15,25,35,0.05)',
        position: 'relative',
        zIndex: 5,
      }}
    >
      {children}
    </footer>
  );
}

/** Barra de progreso por pasos (flujo de reserva). */
export function ProgressBar({ steps, current }: { steps: string[]; current: string }) {
  const idx = steps.indexOf(current);
  if (idx < 0) return null;
  return (
    <div style={{ flex: 'none', display: 'flex', gap: 5, padding: '12px 16px 4px', background: 'var(--surface-card)' }}>
      {steps.map((s, i) => (
        <div key={s} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= idx ? 'var(--brand)' : 'var(--surface-sunken)', transition: 'background var(--dur-base) var(--ease-out)' }} />
      ))}
    </div>
  );
}

export interface SpecTab {
  id: string;
  label: string;
  icon: string;
  /** Acción central destacada (walk-in). */
  center?: boolean;
}

export const SPEC_TABS: SpecTab[] = [
  { id: 'miDia', label: 'Mi día', icon: 'home' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'walkin', label: 'Walk-in', icon: 'plus', center: true },
  { id: 'ganancias', label: 'Ganancias', icon: 'dollar-sign' },
  { id: 'perfil', label: 'Perfil', icon: 'user' },
];

/** Tab bar inferior del especialista (5 ítems, walk-in central). */
export function SpecTabBar({ active, onChange, tabs = SPEC_TABS }: { active: string; onChange: (id: string) => void; tabs?: SpecTab[] }) {
  return (
    <nav
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        background: 'var(--surface-card)',
        borderTop: '1px solid var(--border-subtle)',
        paddingTop: 8,
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        position: 'relative',
        zIndex: 6,
      }}
    >
      {tabs.map((tab) => {
        const on = active === tab.id;
        if (tab.center) {
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-label={tab.label}
              style={{
                flex: 'none',
                width: 56,
                height: 56,
                marginTop: -22,
                borderRadius: '9999px',
                border: '3px solid var(--surface-card)',
                background: on ? 'var(--brand-pressed)' : 'var(--brand)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <Icon name={tab.icon} size={24} color="#fff" />
            </button>
          );
        }
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '2px 0',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: on ? 'var(--brand)' : 'var(--text-tertiary)',
            }}
          >
            <Icon name={tab.icon} size={22} color={on ? 'var(--brand)' : 'var(--text-tertiary)'} />
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)' }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
