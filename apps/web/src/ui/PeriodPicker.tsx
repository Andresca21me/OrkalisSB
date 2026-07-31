import { useState } from 'react';
import { Icon, Popover, Segmented } from './ui';
import { RangeCalendar } from './RangeCalendar';
import { diasATimestamps, type RangoDias } from '../lib/useReportes';
import { rangoDiaBogota } from '../lib/useCitas';

export type TipoPeriodo = 'q1' | 'q2' | 'mes' | 'rango';

/** Período resuelto: timestamps UTC del rango + identidad para navegar/cerrar. */
export interface Periodo {
  tipo: TipoPeriodo;
  /** Primer día del mes ancla, 'YYYY-MM-01' (zona Bogotá). Vacío en `rango`. */
  ancla: string;
  desde: string; // ISO UTC inclusive
  hasta: string; // ISO UTC exclusivo-ish (fin del último día Bogotá)
  etiqueta: string;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Hoy en fecha local Bogotá (YYYY-MM-DD), sin depender del huso del navegador. */
function hoyBogota(): string {
  return new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
}

function ultimoDiaDelMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Construye el período de una quincena/mes a partir del ancla (año-mes Bogotá). */
export function periodoDe(tipo: Exclude<TipoPeriodo, 'rango'>, ancla: string): Periodo {
  const [y, m] = ancla.split('-').map(Number);
  const fin = ultimoDiaDelMes(y, m);
  const dia = (d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const rangos: Record<Exclude<TipoPeriodo, 'rango'>, { d1: number; d2: number; label: string }> = {
    q1: { d1: 1, d2: 15, label: `1–15 ${MESES[m - 1]} ${y}` },
    q2: { d1: 16, d2: fin, label: `16–${fin} ${MESES[m - 1]} ${y}` },
    mes: { d1: 1, d2: fin, label: `${MESES[m - 1]} ${y}` },
  };
  const r = rangos[tipo];
  return {
    tipo,
    ancla: dia(1),
    desde: rangoDiaBogota(dia(r.d1)).desde,
    hasta: rangoDiaBogota(dia(r.d2)).hasta,
    etiqueta: r.label,
  };
}

/** Período por defecto: la QUINCENA en curso (así se paga en los salones). */
export function periodoInicial(): Periodo {
  const hoy = hoyBogota();
  const diaDelMes = Number(hoy.slice(8, 10));
  return periodoDe(diaDelMes <= 15 ? 'q1' : 'q2', `${hoy.slice(0, 7)}-01`);
}

function moverMes(ancla: string, delta: number): string {
  const [y, m] = ancla.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Selector de período de Finanzas (Plan-Finanzas F4, D4): Quincena 1 · Quincena
 * 2 · Mes · Rango libre, con flechas para navegar a períodos anteriores. Es el
 * reflejo del pago quincenal/mensual de los salones: lo que se elige aquí
 * aplica a TODAS las pestañas de Finanzas (el cierre se genera sobre esto).
 */
export function PeriodPicker({ value, onChange }: { value: Periodo; onChange: (p: Periodo) => void }) {
  const [calAbierto, setCalAbierto] = useState(false);

  const cambiarTipo = (tipo: string) => {
    if (tipo === 'rango') {
      setCalAbierto(true);
      return;
    }
    const ancla = value.ancla || `${hoyBogota().slice(0, 7)}-01`;
    onChange(periodoDe(tipo as Exclude<TipoPeriodo, 'rango'>, ancla));
  };

  const navegar = (delta: number) => {
    if (value.tipo === 'rango') return;
    onChange(periodoDe(value.tipo, moverMes(value.ancla, delta)));
  };

  const aplicarRango = (r: RangoDias) => {
    const { desde, hasta } = diasATimestamps(r);
    onChange({ tipo: 'rango', ancla: '', desde, hasta, etiqueta: `${r.desde.slice(8, 10)} ${MESES[Number(r.desde.slice(5, 7)) - 1]} – ${r.hasta.slice(8, 10)} ${MESES[Number(r.hasta.slice(5, 7)) - 1]}` });
    setCalAbierto(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }} data-testid="period-picker">
      <Segmented
        options={[
          { value: 'q1', label: 'Quincena 1' },
          { value: 'q2', label: 'Quincena 2' },
          { value: 'mes', label: 'Mes' },
          { value: 'rango', label: 'Rango' },
        ]}
        value={value.tipo}
        onChange={cambiarTipo}
      />
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <button type="button" aria-label="Período anterior" disabled={value.tipo === 'rango'} onClick={() => navegar(-1)} style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xs)', background: 'var(--surface-card)', cursor: value.tipo === 'rango' ? 'not-allowed' : 'pointer', opacity: value.tipo === 'rango' ? 0.5 : 1 }}>
          <Icon name="chevron-left" size={15} color="var(--text-secondary)" />
        </button>
        <span className="data" data-testid="period-label" style={{ minWidth: 118, textAlign: 'center', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
          {value.etiqueta}
        </span>
        <button type="button" aria-label="Período siguiente" disabled={value.tipo === 'rango'} onClick={() => navegar(1)} style={{ width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xs)', background: 'var(--surface-card)', cursor: value.tipo === 'rango' ? 'not-allowed' : 'pointer', opacity: value.tipo === 'rango' ? 0.5 : 1 }}>
          <Icon name="chevron-right" size={15} color="var(--text-secondary)" />
        </button>
      </div>
      <div style={{ position: 'relative' }}>
        <Popover open={calAbierto} onClose={() => setCalAbierto(false)} align="right" width={320}>
          <RangeCalendar value={{ desde: hoyBogota(), hasta: hoyBogota() }} onApply={aplicarRango} />
        </Popover>
      </div>
    </div>
  );
}
