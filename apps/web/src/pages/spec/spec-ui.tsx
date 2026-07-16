import { useId, type ReactNode } from 'react';
import type { CitaAgenda, MetodoPago } from '@orkalis/shared';
import { hora, money } from '../../lib/format';
import { useDialogA11y } from '../../lib/useDialogA11y';
import { Badge, Card } from '../../ui/ui';

// ── Helpers de turno ─────────────────────────────────────────────────────────
export function turnoTotal(t: CitaAgenda): number {
  const serv = t.servicios.reduce((a, s) => a + Number(s.precio), 0);
  return serv || Number(t.precioEst ?? 0);
}
export function turnoDur(t: CitaAgenda): number {
  return Math.round((new Date(t.fin).getTime() - new Date(t.inicio).getTime()) / 60000);
}
export function turnoCliente(t: CitaAgenda): string {
  return t.clienteNombre ?? 'Walk-in';
}
export function minutosDelDia(iso: string): number {
  // Minutos desde medianoche en zona Bogotá.
  const s = new Date(new Date(iso).getTime() - 5 * 3600_000).toISOString();
  return Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));
}

export const ESTADO_COLOR: Record<string, string> = {
  solicitada: 'var(--warning)', confirmada: 'var(--success)', en_progreso: 'var(--info)',
  completada: 'var(--gray-400)', cancelada: 'var(--error)', no_asistio: 'var(--warning)',
};
export const ESTADO_TINT: Record<string, string> = {
  solicitada: 'var(--warning-tint)', confirmada: 'var(--success-tint)', en_progreso: 'var(--info-tint)',
  completada: 'var(--surface-sunken)', cancelada: 'var(--error-tint)', no_asistio: 'var(--warning-tint)',
};

export const PAGOS: { id: MetodoPago; label: string; icon: string }[] = [
  { id: 'efectivo' as MetodoPago, label: 'Efectivo', icon: 'dollar-sign' },
  { id: 'tarjeta' as MetodoPago, label: 'Tarjeta', icon: 'credit-card' },
  { id: 'transferencia' as MetodoPago, label: 'Transferencia', icon: 'repeat' },
  { id: 'nequi' as MetodoPago, label: 'Nequi', icon: 'smartphone' },
];

// ── Fila de turno compacta ───────────────────────────────────────────────────
export function TurnoRow({ turno, onClick }: { turno: CitaAgenda; onClick: () => void }) {
  const color = ESTADO_COLOR[turno.estado] ?? 'var(--gray-400)';
  return (
    <Card interactive padding={0} onClick={onClick} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: 4, flex: 'none', background: color, opacity: 0.9 }} />
        <div style={{ flex: 1, minWidth: 0, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 'none', textAlign: 'center', minWidth: 52 }}>
            <div className="data" style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{hora(turno.inicio)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{turnoDur(turno)}m</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{turnoCliente(turno)}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{turno.servicios.map((s) => s.nombre).join(' · ') || '—'}</div>
          </div>
          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span className="data" style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{money(turnoTotal(turno))}</span>
            <EstadoBadgeSpec estado={turno.estado} />
          </div>
        </div>
      </div>
    </Card>
  );
}

const ESTADO_LABEL: Record<string, string> = {
  solicitada: 'Solicitada', confirmada: 'Confirmada', en_progreso: 'En progreso',
  completada: 'Completada', cancelada: 'Cancelada', no_asistio: 'No asistió',
};
const ESTADO_TONE: Record<string, 'warning' | 'success' | 'info' | 'neutral' | 'error'> = {
  solicitada: 'warning', confirmada: 'success', en_progreso: 'info', completada: 'neutral', cancelada: 'error', no_asistio: 'warning',
};
export function EstadoBadgeSpec({ estado, size }: { estado: string; size?: 'md' | 'lg' }) {
  return <Badge tone={ESTADO_TONE[estado] ?? 'neutral'} size={size} dot>{ESTADO_LABEL[estado] ?? estado}</Badge>;
}

export function DayStat({ value, label, accent, mono }: { value: ReactNode; label: string; accent?: boolean; mono?: boolean }) {
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 10px', textAlign: 'center' }}>
      <div className={mono ? 'data' : ''} style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: mono ? 'var(--text-base)' : 'var(--text-xl)', color: accent ? '#0A8F5B' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="eyebrow" style={{ marginBottom: 10 }}>{children}</div>;
}

/** Bottom sheet móvil con overlay + footer opcional. */
export function Sheet({ open, onClose, title, footer, children }: { open: boolean; onClose: () => void; title?: string; footer?: ReactNode; children: ReactNode }) {
  const panelRef = useDialogA11y(open, onClose);
  const titleId = useId();
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,15,20,0.45)' }} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1} style={{ position: 'relative', background: 'var(--surface-card)', borderTopLeftRadius: 'var(--radius-xl)', borderTopRightRadius: 'var(--radius-xl)', maxHeight: '85%', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}><div style={{ width: 38, height: 4, borderRadius: 99, background: 'var(--border-default)' }} /></div>
        {title && <div id={titleId} style={{ padding: '6px 18px 12px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>{title}</div>}
        <div style={{ overflowY: 'auto', padding: '0 16px 16px' }}>{children}</div>
        {footer && <div style={{ padding: '12px 16px calc(env(safe-area-inset-bottom) + 14px)', borderTop: '1px solid var(--border-subtle)' }}>{footer}</div>}
      </div>
    </div>
  );
}

/** Botón fantasma sobre el hero navy. */
export const ghostDarkBtn: React.CSSProperties = {
  flex: 1, height: 44, borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.92)', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600,
};
