import { useState } from 'react';
import { Icon, Popover } from './ui';
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
  /** Solo `rango`: los días Bogotá elegidos, para poder navegar con flechas. */
  dias?: RangoDias;
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

/** Suma días a un 'YYYY-MM-DD' (aritmética UTC, sin huso del navegador). */
function sumarDias(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function difDias(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400_000);
}

function etiquetaRango(r: RangoDias): string {
  const f = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
  const anio = r.desde.slice(0, 4) === r.hasta.slice(0, 4) ? ` ${r.hasta.slice(0, 4)}` : '';
  return `${f(r.desde)} – ${f(r.hasta)}${anio}`;
}

function periodoDeRango(r: RangoDias): Periodo {
  const { desde, hasta } = diasATimestamps(r);
  return { tipo: 'rango', ancla: '', desde, hasta, etiqueta: etiquetaRango(r), dias: r };
}

/**
 * Selector de período de Finanzas (Plan-Finanzas F4, D4). Un solo control:
 * `◀ [período ▾] ▶`. El centro abre las opciones (Quincena 1 · Quincena 2 ·
 * Mes · Rango personalizado) y las flechas navegan SIEMPRE: las quincenas y el
 * mes saltan de mes en mes; un rango libre se desplaza por su propia duración.
 * Es el reflejo del pago quincenal/mensual de los salones: lo que se elige
 * aquí aplica a TODAS las pestañas de Finanzas (el cierre se genera sobre esto).
 */
export function PeriodPicker({ value, onChange }: { value: Periodo; onChange: (p: Periodo) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [vistaCal, setVistaCal] = useState(false);

  const anclaActual = value.ancla || `${hoyBogota().slice(0, 7)}-01`;
  const [ay, am] = anclaActual.split('-').map(Number);
  const mesAncla = `${MESES[am - 1]} ${ay}`;

  const cerrar = () => { setAbierto(false); setVistaCal(false); };

  const elegir = (tipo: Exclude<TipoPeriodo, 'rango'>) => {
    onChange(periodoDe(tipo, anclaActual));
    cerrar();
  };

  const aplicarRango = (r: RangoDias) => {
    onChange(periodoDeRango(r));
    cerrar();
  };

  const navegar = (delta: number) => {
    if (value.tipo === 'rango') {
      // El rango se desplaza por su propia duración (p. ej. una semana → la
      // semana anterior/siguiente): las flechas nunca quedan muertas.
      const r = value.dias ?? { desde: hoyBogota(), hasta: hoyBogota() };
      const len = difDias(r.desde, r.hasta) + 1;
      aplicarRango({ desde: sumarDias(r.desde, delta * len), hasta: sumarDias(r.hasta, delta * len) });
      return;
    }
    onChange(periodoDe(value.tipo, moverMes(value.ancla, delta)));
  };

  const flecha: React.CSSProperties = {
    width: 34, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', background: 'transparent', cursor: 'pointer', flex: 'none',
  };

  const opciones: { tipo: Exclude<TipoPeriodo, 'rango'>; label: string; sub: string }[] = [
    { tipo: 'q1', label: 'Quincena 1', sub: `1–15 de ${mesAncla}` },
    { tipo: 'q2', label: 'Quincena 2', sub: `16–${ultimoDiaDelMes(ay, am)} de ${mesAncla}` },
    { tipo: 'mes', label: 'Mes', sub: `${mesAncla} completo` },
  ];

  const filaCss: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px',
    border: 'none', borderRadius: 'var(--radius-xs)', background: 'transparent', cursor: 'pointer',
    textAlign: 'left', fontFamily: 'var(--font-body)',
  };

  return (
    <div data-testid="period-picker" style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)', maxWidth: '100%' }}>
      <button type="button" aria-label="Período anterior" onClick={() => navegar(-1)} style={flecha}>
        <Icon name="chevron-left" size={16} color="var(--text-secondary)" />
      </button>

      <span style={{ position: 'relative', minWidth: 0 }}>
        <button
          type="button"
          data-testid="period-label"
          aria-haspopup="true"
          aria-expanded={abierto}
          onClick={() => { setVistaCal(false); setAbierto((v) => !v); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: '100%', height: 36, padding: '0 10px', border: 'none', borderInline: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
        >
          <Icon name="calendar" size={15} color="var(--text-tertiary)" style={{ flex: 'none' }} />
          <span className="data" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {value.tipo !== 'rango' && value.tipo !== 'mes' ? `${value.tipo === 'q1' ? 'Q1' : 'Q2'} · ` : ''}{value.etiqueta}
          </span>
          <Icon name="chevron-down" size={14} color="var(--text-tertiary)" style={{ flex: 'none' }} />
        </button>

        <Popover open={abierto} onClose={cerrar} align="left" width={vistaCal ? 320 : 268}>
          {vistaCal ? (
            <div style={{ padding: 4 }}>
              <button type="button" onClick={() => setVistaCal(false)} style={{ ...filaCss, padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="arrow-left" size={14} color="var(--text-tertiary)" /> Quincenas y mes
              </button>
              <RangeCalendar value={value.dias ?? { desde: hoyBogota(), hasta: hoyBogota() }} onApply={aplicarRango} />
            </div>
          ) : (
            <div style={{ padding: 6 }}>
              {opciones.map((o) => {
                const on = value.tipo === o.tipo;
                return (
                  <button key={o.tipo} type="button" onClick={() => elegir(o.tipo)} style={filaCss}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-sunken)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{o.label}</span>
                      <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>{o.sub}</span>
                    </span>
                    {on && <Icon name="check" size={15} color="var(--brand)" style={{ flex: 'none' }} />}
                  </button>
                );
              })}
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 4px' }} />
              <button type="button" onClick={() => setVistaCal(true)} style={filaCss}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-sunken)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Rango personalizado</span>
                  <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>
                    {value.tipo === 'rango' ? value.etiqueta : 'Elige las fechas en el calendario'}
                  </span>
                </span>
                {value.tipo === 'rango' ? <Icon name="check" size={15} color="var(--brand)" style={{ flex: 'none' }} /> : <Icon name="chevron-right" size={15} color="var(--text-tertiary)" style={{ flex: 'none' }} />}
              </button>
            </div>
          )}
        </Popover>
      </span>

      <button type="button" aria-label="Período siguiente" onClick={() => navegar(1)} style={flecha}>
        <Icon name="chevron-right" size={16} color="var(--text-secondary)" />
      </button>
    </div>
  );
}
