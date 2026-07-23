import { useEffect, useMemo, useState } from 'react';
import { TipoProducto, type ProductoInventario } from '@orkalis/shared';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { Icon } from './ui';

/** Una línea elegida en el cobro. */
export interface LineaProducto {
  productoId: string;
  cantidad: number;
}

/**
 * Selector de productos vendidos en el cobro de una cita. Compartido por los tres
 * paneles (admin, recepción, especialista). Se apoya en `GET /inventario/productos`,
 * cuyo **403** (plan sin módulo o módulo apagado) es la señal de "sin inventario":
 * en ese caso NO se renderiza nada —ni un error— porque el cobro de servicios debe
 * seguir funcionando igual (Plan-Inventario §2.5).
 */
export function ProductosVenta({
  sucursalId,
  lineas,
  onChange,
  onSubtotalChange,
}: {
  sucursalId: string | null;
  lineas: LineaProducto[];
  onChange: (l: LineaProducto[]) => void;
  /** Reporta el subtotal de productos al padre (para sumarlo al total a cobrar). */
  onSubtotalChange?: (subtotal: number) => void;
}) {
  const [productos, setProductos] = useState<ProductoInventario[] | null>(null);
  const [disponible, setDisponible] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState('');
  // En el cobro se topea por stock disponible: es el default seguro y no exige leer
  // la config (que recepción/especialista no pueden). La venta directa del admin sí
  // respeta el flag de stock negativo; regularizar sobreventas se hace desde ahí.

  useEffect(() => {
    let vivo = true;
    const qs = sucursalId ? `?sucursalId=${sucursalId}` : '';
    api
      .get<ProductoInventario[]>(`/inventario/productos${qs}`)
      .then((data) => {
        if (!vivo) return;
        setProductos(data.filter((p) => p.tipo === TipoProducto.Venta && p.activo));
      })
      .catch(() => {
        // 403 (sin módulo/plan) o cualquier error de carga: se oculta la sección.
        if (vivo) setDisponible(false);
      });
    return () => {
      vivo = false;
    };
  }, [sucursalId]);

  const byId = useMemo(() => new Map((productos ?? []).map((p) => [p.id, p])), [productos]);
  const subtotal = lineas.reduce((s, l) => s + (Number(byId.get(l.productoId)?.precioVenta) || 0) * l.cantidad, 0);

  useEffect(() => {
    onSubtotalChange?.(subtotal);
    // Solo cuando cambia el subtotal calculado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  if (!disponible || productos === null || productos.length === 0) return null;

  const q = busca.trim().toLowerCase();
  const filtrados = q ? productos.filter((p) => p.nombre.toLowerCase().includes(q)) : productos;

  function setCantidad(p: ProductoInventario, cantidad: number) {
    const resto = lineas.filter((l) => l.productoId !== p.id);
    onChange(cantidad > 0 ? [...resto, { productoId: p.id, cantidad }] : resto);
  }
  function cantidadDe(id: string): number {
    return lineas.find((l) => l.productoId === id)?.cantidad ?? 0;
  }

  return (
    <div style={{ marginBottom: 16, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', background: 'var(--surface-sunken)', border: 'none', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}
      >
        <Icon name="package" size={16} color="var(--text-secondary)" />
        <span style={{ flex: 1, textAlign: 'left' }}>Agregar productos vendidos</span>
        {lineas.length > 0 && <span className="data" style={{ fontWeight: 700, color: 'var(--brand)' }}>{money(subtotal)}</span>}
        <Icon name={abierto ? 'chevron-up' : 'chevron-down'} size={16} color="var(--text-tertiary)" />
      </button>

      {abierto && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {productos.length > 6 && (
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar producto…"
              style={{ width: '100%', height: 34, padding: '0 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
            {filtrados.map((p) => {
              const n = cantidadDe(p.id);
              const quedaria = p.cantidad - n;
              const topeAlcanzado = quedaria <= 0;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      {money(p.precioVenta)} · stock {p.cantidad}
                    </div>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button type="button" aria-label="Quitar uno" disabled={n === 0} onClick={() => setCantidad(p, n - 1)} style={stepBtn(n === 0)}>−</button>
                    <span className="data" style={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{n}</span>
                    <button type="button" aria-label="Agregar uno" disabled={topeAlcanzado} onClick={() => setCantidad(p, n + 1)} style={stepBtn(topeAlcanzado)}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function stepBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface-card)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1,
  };
}

/** Subtotal de las líneas de producto dadas, usando un mapa de precios. */
export function subtotalProductos(lineas: LineaProducto[], precioDe: (id: string) => number): number {
  return lineas.reduce((s, l) => s + precioDe(l.productoId) * l.cantidad, 0);
}
