import { useMemo, useState } from 'react';
import type { EspecialistaEquipo, ProductoInventario } from '@orkalis/shared';
import { money } from '../../lib/format';
import { crearGasto, registrarVenta } from '../../lib/useGastos';
import { Button, Dialog, Select, useToast } from '../../ui/ui';
import { GField, GMoney, GNumber, GSummaryRow, type MoneyValue } from './gestion-ui';

interface Sucursal { id: string; nombre: string; activa: boolean }

/** Config de comisión por producto para la vista previa (la verdad la calcula el servidor). */
export interface ComisionProductoConfig {
  tipo: 'porcentaje' | 'valor_fijo';
  valor: number;
}

/** Comisión previa de una venta (misma fórmula que el backend `comisionProducto`). */
function comisionPreview(cantidad: number, precioUnit: number, cfg: ComisionProductoConfig): number {
  if (!(cfg.valor > 0) || !(cantidad > 0)) return 0;
  const totalLinea = cantidad * precioUnit;
  if (cfg.tipo === 'valor_fijo') return Math.min(cantidad * cfg.valor, totalLinea);
  return Math.round((totalLinea * cfg.valor) / 100);
}

export function GastoModal({ kind, sucursales, defaultSucursalId, onClose, onSaved }: { kind: 'fijo' | 'variable'; sucursales: Sucursal[]; defaultSucursalId: string | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const hoy = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10); // día Bogotá
  const [sucId, setSucId] = useState(defaultSucursalId ?? sucursales[0]?.id ?? '');
  const [categoria, setCategoria] = useState('');
  const [monto, setMonto] = useState<MoneyValue>('');
  // Fijos: día del mes en que el negocio paga este gasto (arriendo → día 1…).
  const [diaCobro, setDiaCobro] = useState(Number(hoy.slice(8, 10)));
  // Variables: día en que se hizo el gasto (por defecto, hoy).
  const [fecha, setFecha] = useState(hoy);
  const [touched, setTouched] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const montoErr = touched && (monto === '' || monto == null) ? 'Indica el monto' : undefined;
  const sucErr = touched && !sucId ? 'Elige una sucursal' : undefined;
  const fechaErr = touched && kind === 'variable' && !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? 'Indica la fecha' : undefined;
  const valid = monto !== '' && monto != null && !!sucId && (kind === 'fijo' || /^\d{4}-\d{2}-\d{2}$/.test(fecha));

  const inputCss: React.CSSProperties = { height: 42, padding: '0 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-default)', outline: 'none', width: '100%', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', background: 'var(--surface-card)' };

  async function guardar() {
    setTouched(true);
    if (!valid) return;
    setGuardando(true);
    try {
      await crearGasto({
        sucursalId: sucId,
        tipo: kind,
        categoria: categoria.trim() || undefined,
        monto: Number(monto),
        ...(kind === 'fijo' ? { diaCobro } : { fecha }),
      });
      toast('Gasto registrado', 'success');
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} width={480} title={kind === 'fijo' ? 'Nuevo gasto fijo' : 'Nuevo gasto variable'}
      subtitle={kind === 'fijo' ? 'Recurrente (arriendo, servicios…): se cobra solo cada mes, el día que elijas.' : 'Gasto puntual: cuenta en el período de su fecha.'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={guardando} onClick={guardar}>Registrar gasto</Button>
      </>}>
      <div style={{ padding: '8px 0 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sucursales.length > 1 && (
          <GField label="Sucursal" error={sucErr}><Select value={sucId} onChange={(e) => setSucId(e.target.value)}>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</Select></GField>
        )}
        <GField label="Categoría" optional><input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Arriendo, servicios públicos…" style={inputCss} /></GField>
        <GField label="Monto" error={montoErr}><GMoney value={monto} onChange={setMonto} invalid={!!montoErr} /></GField>
        {kind === 'fijo' ? (
          <GField label="Día de cobro" hint="Cada mes se registra en ese día (en meses más cortos, el último día).">
            <Select value={String(diaCobro)} onChange={(e) => setDiaCobro(Number(e.target.value))} aria-label="Día de cobro">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>El día {d} de cada mes</option>)}
            </Select>
          </GField>
        ) : (
          <GField label="Fecha del gasto" error={fechaErr}>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha del gasto" style={inputCss} />
          </GField>
        )}
      </div>
    </Dialog>
  );
}

export function VentaModal({ productos, especialistas, comisionCfg, onClose, onSaved }: { productos: ProductoInventario[]; especialistas: EspecialistaEquipo[]; comisionCfg: ComisionProductoConfig; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const disponibles = useMemo(() => productos.filter((p) => p.cantidad > 0), [productos]);
  const [productoId, setProductoId] = useState(disponibles[0]?.id ?? '');
  const [cantidad, setCantidad] = useState(1);
  const [vendidoPor, setVendidoPor] = useState('salon');
  const [guardando, setGuardando] = useState(false);

  const producto = disponibles.find((p) => p.id === productoId);
  const total = producto ? Number(producto.precioVenta) * cantidad : 0;
  const bySpec = vendidoPor !== 'salon';
  // Vista previa: la comisión definitiva la calcula el servidor con la config.
  const comision = bySpec && producto ? comisionPreview(cantidad, Number(producto.precioVenta), comisionCfg) : 0;
  const stockError = !!producto && cantidad > producto.cantidad;
  const valid = !!producto && cantidad >= 1 && !stockError;
  const comisionLabel = comisionCfg.tipo === 'porcentaje' ? `${comisionCfg.valor}%` : `${money(comisionCfg.valor)}/u`;

  async function registrar() {
    if (!valid || !producto) return;
    setGuardando(true);
    try {
      const r = await registrarVenta({ productoId: producto.id, cantidad, especialistaId: bySpec ? vendidoPor : undefined });
      toast(`Venta registrada · ${money(r.total)}`, 'success');
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} width={520} title="Venta de productos" subtitle="Registra una venta directa de producto, sin servicio."
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" iconLeft="check" loading={guardando} disabled={!valid} onClick={registrar}>Registrar venta · {money(total)}</Button>
      </>}>
      <div style={{ padding: '8px 0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {disponibles.length === 0 ? (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', padding: '8px 0' }}>No hay productos de venta con stock disponible.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
              <GField label="Producto"><Select value={productoId} onChange={(e) => { setProductoId(e.target.value); setCantidad(1); }}>{disponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.cantidad} disp.)</option>)}</Select></GField>
              <GField label="Cantidad" error={stockError ? `Máx. ${producto?.cantidad}` : undefined}><GNumber value={cantidad} onChange={setCantidad} min={1} invalid={stockError} /></GField>
            </div>
            <GField label="Vendido por" hint={bySpec ? (comisionCfg.valor > 0 ? `Comisión de ${comisionLabel} para el especialista (según configuración).` : 'Sin comisión configurada: la venta es 100% del negocio.') : 'La venta es 100% del negocio.'}>
              <Select value={vendidoPor} onChange={(e) => setVendidoPor(e.target.value)}>
                <option value="salon">El negocio (directo)</option>
                {especialistas.filter((s) => s.activo).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Select>
            </GField>
            <div style={{ padding: '4px 16px 8px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
              <GSummaryRow first strong label="Total de la venta" value={money(total)} />
              {bySpec && comision > 0 ? (
                <>
                  <GSummaryRow label="Comisión especialista" sub={comisionLabel} value={money(comision)} tone="pos" />
                  <GSummaryRow label="Para el negocio" value={money(total - comision)} />
                </>
              ) : (
                <GSummaryRow label="Para el negocio" sub="100%" value={money(total)} />
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
