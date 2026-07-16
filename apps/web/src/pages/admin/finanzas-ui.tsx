import type { ReactNode } from 'react';
import type { SaludFinanciera } from '@orkalis/shared';
import { Badge, Card, Icon, Skeleton } from '../../ui/ui';
import { GSegmented, GSummaryRow } from './gestion-ui';
import type { Periodo } from '../../lib/useReportes';

/** COP compacto para centros de donut y barras: $1,2M · $850k. */
export function compactCOP(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

export function PeriodSwitch({ value, onChange }: { value: Periodo; onChange: (v: Periodo) => void }) {
  return (
    <GSegmented value={value} onChange={(v) => onChange(v as Periodo)} options={[
      { value: 'semana', label: 'Esta semana' },
      { value: 'mes', label: 'Este mes' },
      { value: 'ano', label: 'Este año' },
    ]} />
  );
}

const SALUD: Record<SaludFinanciera, { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' }> = {
  saludable: { label: 'Saludable', tone: 'success' },
  ajustada: { label: 'Ajustada', tone: 'warning' },
  en_perdida: { label: 'En pérdida', tone: 'error' },
  sin_datos: { label: 'Sin datos', tone: 'neutral' },
};
export function HealthBadge({ health }: { health: SaludFinanciera }) {
  const s = SALUD[health];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

export function FinTile({ label, value, icon, tone, sub, loading, big }: { label: string; value?: ReactNode; icon?: string; tone?: 'neg' | 'pos'; sub?: ReactNode; loading?: boolean; big?: boolean }) {
  if (loading) return <Card padding={18}><Skeleton w={100} h={12} /><div style={{ height: 12 }} /><Skeleton w={120} h={26} /></Card>;
  const color = tone === 'neg' ? 'var(--error)' : 'var(--text-primary)';
  return (
    <Card padding={18} style={{ minHeight: 116, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: '18px' }}>{label}</span>
        {icon && <span style={{ display: 'inline-flex', width: 30, height: 30, flex: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={16} color="var(--text-tertiary)" /></span>}
      </div>
      <div style={{ marginTop: 'auto' }}>
        <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: big ? 'var(--text-2xl)' : 'var(--text-xl)', letterSpacing: '-0.02em', color, lineHeight: 1.05 }}>{value}</div>
        {sub && <div style={{ marginTop: 8 }}>{sub}</div>}
      </div>
    </Card>
  );
}

export interface BreakdownRow { label: string; sub?: string; value: ReactNode; tone?: 'pos' | 'neg' }
export function BreakdownBlock({ title, icon, iconColor, rows, total, totalLabel, totalTone }: { title: string; icon: string; iconColor: string; rows: BreakdownRow[]; total: ReactNode; totalLabel: string; totalTone?: 'pos' | 'neg' }) {
  return (
    <Card padding={18}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={16} color={iconColor} /></span>
        <span style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      <div>
        {rows.map((r, i) => <GSummaryRow key={i} first={i === 0} label={r.label} sub={r.sub} value={r.value} tone={r.tone} />)}
        <GSummaryRow strong label={totalLabel} value={total} tone={totalTone} />
      </div>
    </Card>
  );
}

/** Barras horizontales (rankings). */
export function HBars({ data, valueFmt }: { data: { nombre: string; valor: number }[]; valueFmt?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.valor));
  const fmt = valueFmt ?? ((v: number) => compactCOP(v));
  if (data.length === 0) return <div style={{ padding: '20px 8px', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', textAlign: 'center' }}>Sin datos en el período.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map((d) => (
        <div key={d.nombre}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 5 }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</span>
            <span className="data" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmt(d.valor)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((d.valor / max) * 100)}%`, height: '100%', borderRadius: 999, background: 'var(--brand)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
