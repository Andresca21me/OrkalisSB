import { useMemo, useState } from 'react';
import { hoyISO, sumarDiasISO } from '../lib/format';
import { etiquetaRango, type RangoDias } from '../lib/useReportes';
import { Icon } from './ui';

/**
 * Calendario de rango de fechas (dos clics: inicio → fin) con atajos rápidos.
 * Componente puro reutilizable: en móvil va dentro de un `Sheet`, en escritorio
 * dentro de un `Popover`. Devuelve la franja elegida vía `onApply` y no maneja
 * apertura/cierre. Días futuros deshabilitados (no hay datos por delante).
 */

const WD_MIN = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

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

export function RangeCalendar({ value, onApply, presets = true }: { value: RangoDias; onApply: (r: RangoDias) => void; presets?: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [mes, setMes] = useState(() => { const [y, m] = value.hasta.split('-').map(Number); return { y, m }; });
  const atajos = useMemo(() => presetsRapidos(), []);
  const hoy = hoyISO();

  const firstDow = (new Date(Date.UTC(mes.y, mes.m - 1, 1)).getUTCDay() + 6) % 7;
  const totalDias = new Date(Date.UTC(mes.y, mes.m, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= totalDias; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const iso = (d: number) => `${mes.y}-${String(mes.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  let rs: string, re: string;
  if (pending !== null) {
    const other = hover ?? pending;
    [rs, re] = pending <= other ? [pending, other] : [other, pending];
  } else {
    [rs, re] = [value.desde, value.hasta];
  }

  function pick(k: string) {
    if (k > hoy) return;
    if (pending === null) { setPending(k); return; }
    const [a, b] = pending <= k ? [pending, k] : [k, pending];
    setPending(null);
    setHover(null);
    onApply({ desde: a, hasta: b });
  }

  function navMes(delta: number) {
    setMes((s) => {
      const idx = s.m - 1 + delta;
      return { y: s.y + Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 + 1 };
    });
  }

  return (
    <div onMouseLeave={() => setHover(null)}>
      {presets && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '2px 0 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 10 }}>
          {atajos.map((p) => (
            <button key={p.label} type="button" onClick={() => onApply(p.rango())}
              style={{ height: 30, padding: '0 12px', cursor: 'pointer', borderRadius: 999, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{MESES_LARGO[mes.m - 1]} {mes.y}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <NavBtn name="chevron-left" title="Mes anterior" onClick={() => navMes(-1)} />
          <NavBtn name="chevron-right" title="Mes siguiente" onClick={() => navMes(1)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {WD_MIN.map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>{w}</div>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} style={{ height: 40 }} />;
          const k = iso(d);
          const disabled = k > hoy;
          const isStart = k === rs;
          const isEnd = k === re;
          const single = rs === re;
          const pill = isStart || isEnd;
          const between = k > rs && k < re;
          const isToday = k === hoy;
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
                  width: '100%', height: 40, border: 'none', cursor: disabled ? 'default' : 'pointer',
                  borderRadius: 999,
                  background: pill ? 'var(--brand)' : 'transparent',
                  color: disabled ? 'var(--text-tertiary)' : pill ? '#fff' : between || isToday ? 'var(--brand)' : 'var(--text-primary)',
                  opacity: disabled ? 0.4 : 1,
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: pill || isToday ? 700 : 500,
                  outline: isToday && !pill ? '1px solid var(--brand)' : 'none', outlineOffset: -3,
                }}
              >
                {d}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', minHeight: 20, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'center' }}>
        {pending !== null ? 'Elige la fecha final…' : etiquetaRango(value)}
      </div>
    </div>
  );
}

function NavBtn({ name, title, onClick }: { name: string; title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      style={{ width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)', cursor: 'pointer' }}>
      <Icon name={name} size={16} color="var(--text-secondary)" />
    </button>
  );
}
