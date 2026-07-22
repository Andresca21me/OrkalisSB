import { MetodoPago } from '@orkalis/shared';
import type { PagoLinea } from '../lib/useCitas';
import { money } from '../lib/format';
import { Icon, Select } from './ui';

/**
 * Editor de pago dividido: una o varias líneas (método + monto) que deben sumar
 * el total. Reutilizable en el cobro del especialista (móvil) y del admin. El
 * padre inicia el estado con `pagoInicial(total)`, valida con `sumaPagos` y
 * envía las líneas a `completarCita`.
 */

const METODOS: { id: MetodoPago; label: string }[] = [
  { id: 'efectivo' as MetodoPago, label: 'Efectivo' },
  { id: 'tarjeta' as MetodoPago, label: 'Tarjeta' },
  { id: 'transferencia' as MetodoPago, label: 'Transferencia' },
  { id: 'nequi' as MetodoPago, label: 'Nequi' },
  { id: 'otro' as MetodoPago, label: 'Otro' },
];

/** Estado inicial: un solo método (efectivo) por el total. */
export function pagoInicial(total: number): PagoLinea[] {
  return [{ metodo: 'efectivo' as MetodoPago, monto: Math.round(total) }];
}

/** Suma (redondeada a peso) de las líneas de pago. */
export function sumaPagos(lineas: PagoLinea[]): number {
  return Math.round(lineas.reduce((s, l) => s + (l.monto || 0), 0));
}

function parseMonto(v: string): number {
  return Number(v.replace(/\D/g, '')) || 0;
}

function metodoLibre(lineas: PagoLinea[]): MetodoPago {
  const usados = new Set(lineas.map((l) => l.metodo));
  return (METODOS.find((m) => !usados.has(m.id))?.id ?? 'efectivo') as MetodoPago;
}

export function PagoSplit({ total, lineas, onChange }: { total: number; lineas: PagoLinea[]; onChange: (l: PagoLinea[]) => void }) {
  const suma = sumaPagos(lineas);
  const restante = Math.round(total) - suma;

  const setLinea = (i: number, patch: Partial<PagoLinea>) => onChange(lineas.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const quitar = (i: number) => onChange(lineas.filter((_, idx) => idx !== i));
  const agregar = () => onChange([...lineas, { metodo: metodoLibre(lineas), monto: Math.max(0, restante) }]);

  const inputCss: React.CSSProperties = {
    width: '100%', height: 40, padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)',
    background: 'var(--surface-card)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', fontWeight: 600, textAlign: 'right',
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lineas.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: '1 1 120px', minWidth: 0 }}>
              <Select value={l.metodo} onChange={(e) => setLinea(i, { metodo: e.target.value as MetodoPago })}>
                {METODOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </Select>
            </div>
            <div style={{ flex: '1 1 110px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>$</span>
              <input inputMode="numeric" value={l.monto ? String(l.monto) : ''} onChange={(e) => setLinea(i, { monto: parseMonto(e.target.value) })} placeholder="0" aria-label="Monto" style={inputCss} />
            </div>
            {lineas.length > 1 ? (
              <button type="button" onClick={() => quitar(i)} aria-label="Quitar método" style={{ flex: 'none', width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                <Icon name="x" size={16} color="var(--text-tertiary)" />
              </button>
            ) : (
              <div style={{ width: 34, flex: 'none' }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
        {lineas.length < METODOS.length ? (
          <button type="button" onClick={agregar} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--brand)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
            <Icon name="plus" size={15} color="var(--brand)" /> Dividir el pago
          </button>
        ) : <span />}
        <span className="data" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: restante === 0 ? 'var(--success)' : 'var(--error)' }}>
          {restante === 0 ? 'Cuadra ✓' : restante > 0 ? `Faltan ${money(restante)}` : `Sobran ${money(-restante)}`}
        </span>
      </div>
    </div>
  );
}
