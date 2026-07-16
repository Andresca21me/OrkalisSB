import { useState, type CSSProperties, type ReactNode } from 'react';
import { Button, Dialog, Icon, IconButton, MenuItem, Popover } from '../../ui/ui';

/** Valor monetario: número o '' (vacío). */
export type MoneyValue = number | '';

const INPUT_BASE: CSSProperties = {
  height: 42,
  padding: '0 12px',
  borderRadius: 'var(--radius-xs)',
  outline: 'none',
  width: '100%',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-base)',
  color: 'var(--text-primary)',
  background: 'var(--surface-card)',
  transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
};
function borde(focus: boolean, invalid?: boolean): CSSProperties {
  return {
    border: `1px solid ${invalid ? 'var(--error)' : focus ? 'var(--brand)' : 'var(--border-default)'}`,
    boxShadow: focus ? `0 0 0 3px ${invalid ? 'var(--error-tint)' : 'var(--brand-tint)'}` : 'none',
  };
}

/** Campo con label arriba (patrón de la casa) + error/hint inline. */
export function GField({ label, hint, error, optional, span, children }: { label?: ReactNode; hint?: string; error?: string; optional?: boolean; span?: number; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: span ? `span ${span}` : undefined, minWidth: 0 }}>
      {label && (
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {label}{optional && <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}> · opcional</span>}
        </span>
      )}
      {children}
      {error ? (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Icon name="alert-circle" size={13} color="var(--error)" />{error}
        </span>
      ) : hint ? (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{hint}</span>
      ) : null}
    </label>
  );
}

/** Input de dinero COP: prefijo $ y separador de miles en vivo. */
export function GMoney({ value, onChange, placeholder = '0', invalid }: { value: MoneyValue; onChange: (v: MoneyValue) => void; placeholder?: string; invalid?: boolean }) {
  const [focus, setFocus] = useState(false);
  const display = value === '' || value == null || Number.isNaN(value) ? '' : Number(value).toLocaleString('es-CO');
  return (
    <div style={{ ...INPUT_BASE, padding: 0, display: 'flex', alignItems: 'center', ...borde(focus, invalid) }}>
      <span style={{ paddingLeft: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>$</span>
      <input
        value={display}
        inputMode="numeric"
        placeholder={placeholder}
        onChange={(e) => { const raw = e.target.value.replace(/[^\d]/g, ''); onChange(raw === '' ? '' : Number(raw)); }}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', height: 40, padding: '0 12px 0 8px', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}
      />
    </div>
  );
}

/** Entero con sufijo + steppers (duración, cantidad, %…). */
export function GNumber({ value, onChange, suffix, min = 0, step = 1, invalid }: { value: number | ''; onChange: (v: number) => void; suffix?: string; min?: number; step?: number; invalid?: boolean }) {
  const [focus, setFocus] = useState(false);
  const set = (n: number) => onChange(Math.max(min, n));
  return (
    <div style={{ ...INPUT_BASE, padding: 0, display: 'flex', alignItems: 'center', ...borde(focus, invalid) }}>
      <input
        value={value === '' || value == null ? '' : value}
        inputMode="numeric"
        onChange={(e) => { const raw = e.target.value.replace(/[^\d]/g, ''); onChange(raw === '' ? min : Number(raw)); }}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', height: 40, padding: '0 6px 0 12px', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}
      />
      {suffix && <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', paddingRight: 8, whiteSpace: 'nowrap' }}>{suffix}</span>}
      <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-subtle)' }}>
        <button type="button" onClick={() => set(Number(value || 0) + step)} style={stepBtn} aria-label="Aumentar"><Icon name="chevron-up" size={13} color="var(--text-tertiary)" /></button>
        <button type="button" onClick={() => set(Number(value || 0) - step)} style={{ ...stepBtn, borderTop: '1px solid var(--border-subtle)' }} aria-label="Disminuir"><Icon name="chevron-down" size={13} color="var(--text-tertiary)" /></button>
      </div>
    </div>
  );
}
const stepBtn: CSSProperties = { width: 30, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 };

// ── Estado de stock ──────────────────────────────────────────────────────────
export type StockStatus = 'En stock' | 'Stock bajo' | 'Agotado';
export function stockStatus(qty: number, min: number): StockStatus {
  if (qty <= 0) return 'Agotado';
  if (qty <= min) return 'Stock bajo';
  return 'En stock';
}
const STOCK_COLOR: Record<StockStatus, string> = { 'En stock': 'var(--success)', 'Stock bajo': 'var(--warning)', Agotado: 'var(--error)' };
export function StockDot({ status, withLabel = true }: { status: StockStatus; withLabel?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: STOCK_COLOR[status], flex: 'none' }} />
      {withLabel && <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: status === 'En stock' ? 'var(--text-secondary)' : STOCK_COLOR[status] }}>{status}</span>}
    </span>
  );
}

// ── Segmentado con icono + contador ──────────────────────────────────────────
export interface SegOption { value: string; label: string; icon?: string; count?: number }
export function GSegmented({ value, onChange, options, size = 'md' }: { value: string; onChange: (v: string) => void; options: SegOption[]; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 34 : 38;
  return (
    <div style={{ display: 'inline-flex', padding: 3, gap: 2, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: h, padding: '0 14px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-xs)', background: on ? 'var(--surface-card)' : 'transparent', boxShadow: on ? 'var(--shadow-xs)' : 'none', color: on ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, transition: 'background var(--dur-fast) var(--ease-out)' }}>
            {o.icon && <Icon name={o.icon} size={15} color={on ? 'var(--brand)' : 'var(--text-tertiary)'} />}
            {o.label}
            {o.count != null && <span className="data" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: on ? 'var(--brand-tint)' : 'var(--surface-card)', color: on ? 'var(--brand)' : 'var(--text-tertiary)' }}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Menú de fila (3 puntos) ──────────────────────────────────────────────────
export interface RowMenuItem { icon?: string; label?: string; danger?: boolean; divider?: boolean; onClick?: () => void }
export function RowMenu({ items, align = 'right' }: { items: RowMenuItem[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <IconButton name="more-vertical" title="Acciones" onClick={() => setOpen((o) => !o)} />
      <Popover open={open} onClose={() => setOpen(false)} align={align} width={200}>
        {items.map((it, i) =>
          it.divider ? (
            <div key={i} style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 4px' }} />
          ) : (
            <MenuItem key={i} icon={it.icon} danger={it.danger} onClick={() => { it.onClick?.(); setOpen(false); }}>{it.label}</MenuItem>
          ),
        )}
      </Popover>
    </div>
  );
}

// ── Confirmación genérica ────────────────────────────────────────────────────
export function GConfirm({ open, title, desc, confirmLabel = 'Confirmar', confirmIcon, danger, onClose, onConfirm, width = 440 }: { open: boolean; title: string; desc: ReactNode; confirmLabel?: string; confirmIcon?: string; danger?: boolean; onClose: () => void; onConfirm: () => void; width?: number }) {
  if (!open) return null;
  return (
    <Dialog open={open} onClose={onClose} title={title} width={width} footer={<>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button variant={danger ? 'danger' : 'primary'} iconLeft={confirmIcon} onClick={onConfirm}>{confirmLabel}</Button>
    </>}>
      <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', padding: '4px 0 16px', lineHeight: '24px' }}>{desc}</div>
    </Dialog>
  );
}

// ── Línea clave/valor (resúmenes, liquidación) ───────────────────────────────
export function GSummaryRow({ label, value, strong, tone, sub, first }: { label: string; value: ReactNode; strong?: boolean; tone?: 'pos' | 'neg'; sub?: string; first?: boolean }) {
  const color = tone === 'pos' ? 'var(--success)' : tone === 'neg' ? 'var(--error)' : 'var(--text-primary)';
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderTop: first ? 'none' : '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: strong ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: strong ? 600 : 400 }}>
        {label}{sub && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · {sub}</span>}
      </span>
      <span className="data" style={{ fontSize: strong ? 'var(--text-md)' : 'var(--text-sm)', fontWeight: strong ? 700 : 600, color, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}
