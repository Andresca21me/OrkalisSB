import { useMemo, useState } from 'react';
import type { MovimientoInventarioItem, VentaProductoHistorial } from '@orkalis/shared';
import { useSucursal } from '../../lib/sucursal';
import { money } from '../../lib/format';
import { useCompras, useHistorialVentas } from '../../lib/useInventario';
import { useEquipo } from '../../lib/useEquipo';
import type { Periodo } from '../../ui/PeriodPicker';
import { Card, EmptyState, ErrorState, Select, Skeleton } from '../../ui/ui';
import { FinTile } from './finanzas-ui';

type OrigenFiltro = 'todas' | 'cita' | 'directa';

/**
 * Pestaña "Inventario y ventas" de Finanzas. Une el historial de ventas de
 * producto (en cita + directas) con las compras/inversión del período. Solo se
 * monta con el módulo de inventario activo (lo decide `FinanzasScreen`).
 */
export function VentasInventarioScreen({ periodo }: { periodo: Periodo }) {
  const { sucursalActivaId } = useSucursal();
  const [origen, setOrigen] = useState<OrigenFiltro>('todas');
  const [especialistaId, setEspecialistaId] = useState('');
  const equipo = useEquipo();

  // El rango viene del período GLOBAL de Finanzas (F4).
  const ts = { desde: periodo.desde, hasta: periodo.hasta };
  const ventas = useHistorialVentas({
    sucursalId: sucursalActivaId,
    desde: ts.desde,
    hasta: ts.hasta,
    especialistaId: especialistaId || undefined,
    origen: origen === 'todas' ? undefined : origen,
  });
  const compras = useCompras(sucursalActivaId, ts.desde, ts.hasta);

  const totales = ventas.data?.totales;
  const invertido = useMemo(
    () => (compras.data?.items ?? []).reduce((s, m) => s + (m.costoTotal ? Number(m.costoTotal) : 0), 0),
    [compras.data],
  );

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span className="eyebrow">{periodo.etiqueta}</span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Select value={origen} onChange={(e) => setOrigen(e.target.value as OrigenFiltro)}>
            <option value="todas">Todas las ventas</option>
            <option value="cita">En cita</option>
            <option value="directa">Directas</option>
          </Select>
          <Select value={especialistaId} onChange={(e) => setEspecialistaId(e.target.value)}>
            <option value="">Todos los especialistas</option>
            {(equipo.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </Select>
        </div>
      </div>

      <div className="ork-kpis" style={{ marginBottom: 22 }}>
        <FinTile label="Ingresos por productos" value={totales ? money(totales.total) : '—'} icon="dollar-sign" loading={ventas.cargando} />
        <FinTile label="Costo de lo vendido" value={totales ? money(totales.costo) : '—'} icon="package" loading={ventas.cargando} />
        <FinTile label="Margen bruto" value={totales ? money(totales.margen) : '—'} icon="trending-up" tone={totales && totales.margen < 0 ? 'neg' : undefined} loading={ventas.cargando} />
        <FinTile label="Unidades vendidas" value={totales ? String(totales.unidades) : '—'} icon="list" loading={ventas.cargando} />
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)' }}>Historial de ventas</h3>
      {ventas.error ? (
        <ErrorState onRetry={ventas.recargar} />
      ) : ventas.cargando ? (
        <Card padding={18}><Skeleton w="100%" h={120} /></Card>
      ) : (ventas.data?.items.length ?? 0) === 0 ? (
        <Card padding={0}><EmptyState icon="package" title="Sin ventas en el período" desc="Cuando vendas productos —en una cita o directamente— aparecerán aquí." /></Card>
      ) : (
        <VentasTabla items={ventas.data!.items} />
      )}

      <h3 style={{ margin: '26px 0 4px', fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)' }}>Compras e inversión en inventario</h3>
      <p style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Invertido en el período: <strong className="data" style={{ color: 'var(--text-primary)' }}>{money(invertido)}</strong></p>
      {compras.error ? (
        <ErrorState onRetry={compras.recargar} />
      ) : compras.cargando ? (
        <Card padding={18}><Skeleton w="100%" h={80} /></Card>
      ) : (compras.data?.items.length ?? 0) === 0 ? (
        <Card padding={0}><EmptyState icon="package" title="Sin compras registradas" desc="Las entradas de stock con costo aparecerán aquí como inversión." /></Card>
      ) : (
        <ComprasTabla items={compras.data!.items} />
      )}
    </div>
  );
}

function th(align: 'left' | 'right'): React.CSSProperties {
  return { textAlign: align, padding: '0 12px 10px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };
}
function td(align: 'left' | 'right'): React.CSSProperties {
  return { padding: '12px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)', textAlign: align, whiteSpace: align === 'right' ? 'nowrap' : undefined, fontFamily: align === 'right' ? 'var(--font-mono)' : undefined };
}
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' });

function VentasTabla({ items }: { items: VentaProductoHistorial[] }) {
  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead><tr>
            <th style={{ ...th('left'), paddingLeft: 16 }}>Fecha</th>
            <th style={th('left')}>Producto</th>
            <th style={th('left')}>Origen</th>
            <th style={th('left')}>Especialista</th>
            <th style={th('right')}>Cant.</th>
            <th style={th('right')}>Total</th>
            <th style={th('right')}>Comisión</th>
            <th style={{ ...th('right'), paddingRight: 16 }}>Margen</th>
          </tr></thead>
          <tbody>
            {items.map((v) => (
              <tr key={`${v.origen}-${v.id}`}>
                <td style={{ ...td('left'), paddingLeft: 16 }}>{fechaCorta(v.fecha)}</td>
                <td style={{ ...td('left'), fontWeight: 600 }}>{v.productoNombre}</td>
                <td style={td('left')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-xs)', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: v.origen === 'cita' ? 'var(--brand-tint)' : 'var(--surface-sunken)', color: v.origen === 'cita' ? 'var(--brand)' : 'var(--text-secondary)' }}>
                    {v.origen === 'cita' ? 'En cita' : 'Directa'}
                  </span>
                  {v.clienteNombre && <span style={{ marginLeft: 8, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{v.clienteNombre}</span>}
                </td>
                <td style={{ ...td('left'), color: 'var(--text-secondary)' }}>{v.especialistaNombre ?? '—'}</td>
                <td style={td('right')}>{v.cantidad}</td>
                <td style={{ ...td('right'), fontWeight: 700 }}>{money(v.total)}</td>
                <td style={{ ...td('right'), color: v.comision > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>{v.comision > 0 ? money(v.comision) : '—'}</td>
                <td style={{ ...td('right'), paddingRight: 16, color: v.margen < 0 ? 'var(--error)' : undefined }}>{money(v.margen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ComprasTabla({ items }: { items: MovimientoInventarioItem[] }) {
  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead><tr>
            <th style={{ ...th('left'), paddingLeft: 16 }}>Fecha</th>
            <th style={th('left')}>Producto</th>
            <th style={th('right')}>Cantidad</th>
            <th style={th('right')}>Costo total</th>
            <th style={{ ...th('left'), paddingLeft: 16 }}>Motivo</th>
          </tr></thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id}>
                <td style={{ ...td('left'), paddingLeft: 16 }}>{fechaCorta(m.creadoEn)}</td>
                <td style={{ ...td('left'), fontWeight: 600 }}>{m.productoNombre}</td>
                <td style={td('right')}>+{m.cantidad}</td>
                <td style={{ ...td('right'), fontWeight: 700 }}>{m.costoTotal ? money(m.costoTotal) : '—'}</td>
                <td style={{ ...td('left'), paddingLeft: 16, color: 'var(--text-secondary)' }}>{m.motivo ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
