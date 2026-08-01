import { useMemo, useState, type ReactNode } from 'react';
import type { SaludFinanciera } from '@orkalis/shared';
import { Badge, Card, Icon, Popover, Skeleton } from '../../ui/ui';
import { GSummaryRow } from './gestion-ui';
import { hoyISO, sumarDiasISO } from '../../lib/format';
import { etiquetaRango, type RangoDias } from '../../lib/useReportes';

/** COP compacto para centros de donut y barras: $1,2M · $850k. */
export function compactCOP(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

// ── Selector de franja de fechas (calendario, dos clics) ─────────────────────

/** Atajos rápidos del popover; cada uno resuelve a una franja concreta. */
function presetsRapidos(): { label: string; rango: () => RangoDias }[] {
  const hoy = hoyISO();
  const [y, m] = hoy.split('-').map(Number);
  const mesPasado = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const ultimoDiaMesPasado = new Date(Date.UTC(mesPasado.y, mesPasado.m, 0)).getUTCDate();
  const mm = (mo: number) => String(mo).padStart(2, '0');
  return [
    { label: 'Hoy', rango: () => ({ desde: hoy, hasta: hoy }) },
    { label: 'Últimos 7 días', rango: () => ({ desde: sumarDiasISO(hoy, -6), hasta: hoy }) },
    { label: 'Últimos 30 días', rango: () => ({ desde: sumarDiasISO(hoy, -29), hasta: hoy }) },
    { label: 'Este mes', rango: () => ({ desde: `${y}-${mm(m)}-01`, hasta: hoy }) },
    { label: 'Mes pasado', rango: () => ({ desde: `${mesPasado.y}-${mm(mesPasado.m)}-01`, hasta: `${mesPasado.y}-${mm(mesPasado.m)}-${mm(ultimoDiaMesPasado)}` }) },
    { label: 'Este año', rango: () => ({ desde: `${y}-01-01`, hasta: hoy }) },
  ];
}

/**
 * Selector de franja de fechas: un botón que abre un calendario donde, en dos
 * clics (fecha inicial y final), el admin define el rango a visualizar. Incluye
 * atajos rápidos. Sustituye al viejo switch semana/mes/año.
 */
export function RangePicker({ value, onChange }: { value: RangoDias; onChange: (r: RangoDias) => void }) {
  const [open, setOpen] = useState(false);
  const apply = (r: RangoDias) => { onChange(r); setOpen(false); };
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 9, height: 40, padding: '0 12px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', border: `1px solid ${open ? 'var(--brand)' : 'var(--border-default)'}`, background: 'var(--surface-card)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, transition: 'border-color var(--dur-fast) var(--ease-out)' }}
      >
        <Icon name="calendar" size={16} color="var(--brand)" />
        <span className="data" style={{ whiteSpace: 'nowrap' }}>{etiquetaRango(value)}</span>
        <Icon name="chevron-down" size={15} color="var(--text-tertiary)" />
      </button>
      {/* Ancho acotado al viewport: en móvil el calendario se salía de la
          pantalla y las últimas columnas de días quedaban fuera de alcance. */}
      <Popover open={open} onClose={() => setOpen(false)} align="right" width="min(340px, calc(100vw - 24px))">
        <RangeCalendar value={value} onApply={apply} />
      </Popover>
    </div>
  );
}

const WD_MIN = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function RangeCalendar({ value, onApply }: { value: RangoDias; onApply: (r: RangoDias) => void }) {
  // `pending`: primer clic (inicio) a la espera del segundo (fin). null = sin selección en curso.
  const [pending, setPending] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [mes, setMes] = useState(() => { const [y, m] = value.hasta.split('-').map(Number); return { y, m }; });
  const presets = useMemo(() => presetsRapidos(), []);
  const hoy = hoyISO();

  const primero = new Date(Date.UTC(mes.y, mes.m - 1, 1));
  const firstDow = (primero.getUTCDay() + 6) % 7; // lunes = 0
  const totalDias = new Date(Date.UTC(mes.y, mes.m, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= totalDias; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const iso = (d: number) => `${mes.y}-${String(mes.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // Rango a resaltar: el que se está formando (pending + hover) o el ya aplicado.
  let rs: string, re: string;
  if (pending !== null) {
    const other = hover ?? pending;
    [rs, re] = pending <= other ? [pending, other] : [other, pending];
  } else {
    [rs, re] = [value.desde, value.hasta];
  }

  function pick(k: string) {
    if (k > hoy) return; // sin datos a futuro
    if (pending === null) { setPending(k); return; }
    const [a, b] = pending <= k ? [pending, k] : [k, pending];
    setPending(null);
    setHover(null);
    onApply({ desde: a, hasta: b });
  }

  function navMes(delta: number) {
    setMes((s) => {
      const idx = (s.m - 1) + delta;
      return { y: s.y + Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 + 1 };
    });
  }

  return (
    <div style={{ width: 'min(320px, calc(100vw - 40px))' }} onMouseLeave={() => setHover(null)}>
      {/* Atajos rápidos */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 4px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 10 }}>
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => onApply(p.rango())}
            style={{ height: 28, padding: '0 10px', cursor: 'pointer', borderRadius: 999, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Cabecera del mes */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{MESES_LARGO[mes.m - 1]} {mes.y}</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <NavBtn name="chevron-left" title="Mes anterior" onClick={() => navMes(-1)} />
          <NavBtn name="chevron-right" title="Mes siguiente" onClick={() => navMes(1)} />
        </div>
      </div>

      {/* Días de la semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {WD_MIN.map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>{w}</div>)}
      </div>

      {/* Rejilla del mes con resaltado de rango continuo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} style={{ height: 36 }} />;
          const k = iso(d);
          const disabled = k > hoy;
          const isStart = k === rs;
          const isEnd = k === re;
          const single = rs === re;
          const pill = isStart || isEnd;            // extremo → píldora sólida
          const between = k > rs && k < re;         // intermedio → banda tint
          const isToday = k === hoy;
          // Fondo de celda que conecta la banda con las píldoras (mitad tint en los extremos).
          const cellBg = between
            ? 'var(--brand-tint)'
            : !single && isStart
              ? 'linear-gradient(90deg, transparent 50%, var(--brand-tint) 50%)'
              : !single && isEnd
                ? 'linear-gradient(90deg, var(--brand-tint) 50%, transparent 50%)'
                : 'transparent';
          return (
            <div key={i} style={{ background: cellBg }}>
              <button
                type="button"
                data-testid={`rango-dia-${k}`}
                disabled={disabled}
                onClick={() => pick(k)}
                onMouseEnter={() => !disabled && setHover(k)}
                aria-label={k}
                style={{
                  width: '100%', height: 36, border: 'none', cursor: disabled ? 'default' : 'pointer',
                  borderRadius: 999,
                  background: pill ? 'var(--brand)' : 'transparent',
                  color: disabled ? 'var(--text-tertiary)' : pill ? '#fff' : between || isToday ? 'var(--brand)' : 'var(--text-primary)',
                  opacity: disabled ? 0.4 : 1,
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: (pill || isToday) ? 700 : 500,
                  outline: isToday && !pill ? '1px solid var(--brand)' : 'none', outlineOffset: -3,
                }}
              >
                {d}
              </button>
            </div>
          );
        })}
      </div>

      {/* Pie: estado de la selección */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', minHeight: 20, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'center' }}>
        {pending !== null ? 'Elige la fecha final…' : etiquetaRango(value)}
      </div>
    </div>
  );
}

function NavBtn({ name, title, onClick }: { name: string; title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)', cursor: 'pointer' }}>
      <Icon name={name} size={16} color="var(--text-secondary)" />
    </button>
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
        <span style={{ minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: '18px' }}>{label}</span>
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
export function BreakdownBlock({ title, icon, iconColor, rows, total, totalLabel, totalTone, foot }: { title: string; icon: string; iconColor: string; rows: BreakdownRow[]; total: ReactNode; totalLabel: string; totalTone?: 'pos' | 'neg'; foot?: string }) {
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
      {foot && <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{foot}</p>}
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
