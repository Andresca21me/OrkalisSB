import { useState, type CSSProperties, type ReactNode } from 'react';
import { Badge, Icon } from '../../ui';

/**
 * Piezas visuales del asistente de alta (prototipo «Onboarding del negocio»).
 *
 * Viven aparte porque las comparten DOS pantallas: el alta pública
 * (`pages/site/alta-wizard.tsx`, sin sesión) y la configuración guiada del
 * panel (`OnboardingApp`). Si el stepper o las tarjetas de perfil se tocan,
 * se tocan una sola vez y las dos siguen iguales al prototipo.
 */

/** Reglas responsive del asistente (se inyecta una vez por pantalla). */
export const ONB_CSS = `
.onb-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.onb-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.onb-horario { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.onb-hora { width: 130px; }
@media (max-width: 860px) {
  .onb-grid-3 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 680px) {
  .onb-grid-2, .onb-grid-3 { grid-template-columns: 1fr; }
  /* Con 7 pasos las etiquetas no caben en móvil: quedan los números. */
  .onb-step-label { display: none; }
  .onb-hora { width: 116px; }
}
`;

export interface PasoOnb {
  n: number;
  label: string;
  /** El paso se puede omitir (muestra el botón «Omitir por ahora»). */
  opcional?: boolean;
}

// ── Stepper ──────────────────────────────────────────────────────────────────
/** Barra de progreso por pasos: puntos + conectores. Solo deja volver atrás. */
export function Stepper({ steps, current, onJump }: { steps: PasoOnb[]; current: number; onJump: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {steps.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        const reachable = s.n < current;
        return (
          <span key={s.n} style={{ display: 'contents' }}>
            <button type="button" onClick={() => reachable && onJump(s.n)} disabled={!reachable} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', cursor: reachable ? 'pointer' : 'default', padding: 0, flex: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 999, flex: 'none', background: done ? 'var(--brand)' : active ? 'var(--brand-tint)' : 'var(--surface-sunken)', border: `2px solid ${done || active ? 'var(--brand)' : 'var(--border-default)'}`, color: done ? '#fff' : active ? 'var(--brand)' : 'var(--text-tertiary)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                {done ? <Icon name="check" size={17} color="#fff" /> : s.n}
              </span>
              <span className="onb-step-label" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: active ? 'var(--text-primary)' : 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{s.label}</span>
            </button>
            {i < steps.length - 1 && <span style={{ flex: 1, height: 2, margin: '0 8px 22px', background: s.n < current ? 'var(--brand)' : 'var(--border-default)' }} />}
          </span>
        );
      })}
    </div>
  );
}

// ── StepShell ────────────────────────────────────────────────────────────────
/** Encabezado de paso: «Paso n de N», título y bajada. */
export function StepShell({ n, total = 5, title, desc, optional, children }: { n: number; total?: number; title: string; desc?: ReactNode; optional?: boolean; children: ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span className="eyebrow" style={{ whiteSpace: 'nowrap' }}>Paso {n} de {total}</span>
          {optional && <Badge tone="neutral" size="lg">Opcional</Badge>}
        </div>
        {/* `line-height` explícito: los títulos heredan el interlineado del
            cuerpo y a 38px las dos líneas se montan al partir en móvil. */}
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-3xl)', lineHeight: 1.12, letterSpacing: '-0.025em', margin: 0 }}>{title}</h1>
        {desc && <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-secondary)', margin: '10px 0 0', lineHeight: 1.5, maxWidth: 560 }}>{desc}</p>}
      </div>
      {children}
    </div>
  );
}

// ── ChoiceCard ───────────────────────────────────────────────────────────────
/** Tarjeta seleccionable con radio (perfil del negocio, plan…). */
export function ChoiceCard({ selected, onClick, icon, title, desc, tag, children }: { selected: boolean; onClick: () => void; icon: string; title: string; desc: string; tag?: string; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', padding: 20, cursor: 'pointer', border: `1.5px solid ${selected ? 'var(--brand)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-lg)', background: selected ? 'var(--brand-tint)' : 'var(--surface-card)', boxShadow: selected ? '0 0 0 1px var(--brand)' : 'var(--shadow-xs)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46, borderRadius: 'var(--radius-md)', background: selected ? 'var(--brand)' : 'var(--surface-sunken)' }}>
          <Icon name={icon} size={23} color={selected ? '#fff' : 'var(--text-secondary)'} />
        </span>
        <span style={{ width: 22, height: 22, borderRadius: 999, border: `2px solid ${selected ? 'var(--brand)' : 'var(--border-strong)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          {selected && <span style={{ width: 11, height: 11, borderRadius: 999, background: 'var(--brand)' }} />}
        </span>
      </div>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>{title}</span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>{desc}</span>
      {tag && <span style={{ marginTop: 12 }}><Badge tone="neutral" size="lg">{tag}</Badge></span>}
      {children}
    </button>
  );
}

// ── Aviso en caja tintada (el «¿Tienes más sedes?» del prototipo) ────────────
export function OnbNota({ icon = 'info', children }: { icon?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 11, padding: 13, borderRadius: 'var(--radius-sm)', background: 'var(--brand-tint)' }}>
      <Icon name={icon} size={17} color="var(--brand)" style={{ flex: 'none', marginTop: 1 }} />
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: '20px' }}>{children}</span>
    </div>
  );
}

// ── Campos ───────────────────────────────────────────────────────────────────
export function GField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
        {label}
        {hint && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · {hint}</span>}
      </span>
      {children}
      {error && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="alert-circle" size={13} color="var(--error)" />{error}</span>}
    </div>
  );
}

export function GInput({ value, onChange, placeholder, invalid, onEnter, type = 'text', autoComplete, revelable }: { value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean; onEnter?: () => void; type?: string; autoComplete?: string; revelable?: boolean }) {
  const [visible, setVisible] = useState(false);
  const input = (
    <input
      type={revelable && visible ? 'text' : type}
      value={value}
      autoComplete={autoComplete}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      placeholder={placeholder}
      style={revelable ? { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-md)', color: 'var(--text-primary)' } : inputCss(!!invalid)}
    />
  );
  if (!revelable) return input;
  return (
    <div style={{ ...inputCss(!!invalid), display: 'flex', alignItems: 'center', gap: 8 }}>
      {input}
      <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', padding: 4 }}>
        <Icon name={visible ? 'eye-off' : 'eye'} size={17} color="var(--text-tertiary)" />
      </button>
    </div>
  );
}

export function GSelect({ value, onChange, options, invalid }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; invalid?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputCss(!!invalid), appearance: 'none', cursor: 'pointer', backgroundImage: 'linear-gradient(45deg, transparent 50%, var(--text-tertiary) 50%), linear-gradient(135deg, var(--text-tertiary) 50%, transparent 50%)', backgroundPosition: 'calc(100% - 18px) 22px, calc(100% - 13px) 22px', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function inputCss(err: boolean): CSSProperties {
  return { height: 48, padding: '0 14px', width: '100%', boxSizing: 'border-box', border: `1px solid ${err ? 'var(--error)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-md)', color: 'var(--text-primary)', outline: 'none', boxShadow: 'var(--shadow-xs)' };
}

/** Horas seleccionables del horario base (cada 30 min, de 05:00 a 23:30). */
export const HORAS: { value: string; label: string }[] = Array.from({ length: 38 }, (_, i) => {
  const min = 5 * 60 + i * 30;
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return { value: `${h}:${m}`, label: `${h}:${m}` };
});
