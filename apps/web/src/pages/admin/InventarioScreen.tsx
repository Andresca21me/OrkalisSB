import { useEffect, useState } from 'react';
import { TipoProducto, type ProductoInventario } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useSucursal } from '../../lib/sucursal';
import { money } from '../../lib/format';
import {
  crearProducto,
  editarProducto,
  eliminarProducto,
  registrarMovimiento,
  useAlertasStock,
  useInventario,
  useValoracion,
} from '../../lib/useInventario';
import { PageHead } from '../../ui/Shell';
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Select,
  Skeleton,
  StatTile,
  Switch,
  useToast,
} from '../../ui/ui';
import { GConfirm, GField, GMoney, GNumber, GSegmented, RowMenu, StockDot, stockStatus, type MoneyValue } from './gestion-ui';

interface Sucursal { id: string; nombre: string; activa: boolean }

export function InventarioScreen({ sucursalId }: { sucursalId: string | null }) {
  const { consolidado, sucursalActiva } = useSucursal();
  const toast = useToast();
  const productos = useInventario(sucursalId);
  const alertas = useAlertasStock(sucursalId);
  const valoracion = useValoracion(sucursalId);
  const sucs = useApi<Sucursal[]>(() => api.get('/sucursales'));

  const [seg, setSeg] = useState<TipoProducto>(TipoProducto.Venta);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editP, setEditP] = useState<ProductoInventario | null>(null);
  const [movP, setMovP] = useState<ProductoInventario | null>(null);
  const [delP, setDelP] = useState<ProductoInventario | null>(null);

  const lista = productos.data ?? [];
  const counts = {
    servicio: lista.filter((p) => p.tipo === TipoProducto.Servicio).length,
    venta: lista.filter((p) => p.tipo === TipoProducto.Venta).length,
  };
  const scope = consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal');

  const q = query.trim().toLowerCase();
  let rows = lista.filter((p) => p.tipo === seg);
  if (q) rows = rows.filter((p) => p.nombre.toLowerCase().includes(q));

  async function refrescar() {
    await Promise.all([productos.recargar(), alertas.recargar(), valoracion.recargar()]);
  }
  async function eliminar(p: ProductoInventario) {
    try { await eliminarProducto(p.id); setDelP(null); toast(`${p.nombre} eliminado`, 'info'); await refrescar(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  const cargando = productos.cargando;

  return (
    <div>
      <PageHead title="Inventario" desc={`Control de stock de consumo y de venta · ${scope}`} action={<Button iconLeft="plus" onClick={() => { setEditP(null); setFormOpen(true); }}>Nuevo producto</Button>} />

      <div className="ork-kpis" style={{ marginBottom: 20 }}>
        <StatTile label="Productos" value={cargando ? '—' : lista.length} icon="package" loading={cargando} />
        <StatTile label="En stock bajo" value={cargando ? '—' : (alertas.data ?? []).length} icon="alert-triangle" loading={cargando} accent={(alertas.data ?? []).length > 0} />
        <StatTile label="Valor del inventario" value={cargando ? '—' : money(valoracion.data?.valoracion ?? 0)} icon="dollar-sign" loading={cargando} />
      </div>

      {productos.error ? (
        <ErrorState onRetry={refrescar} />
      ) : cargando ? (
        <Card padding={0}>{[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
            <div style={{ flex: 1 }}><Skeleton w="40%" h={14} /><div style={{ height: 8 }} /><Skeleton w="25%" h={11} /></div>
            <Skeleton w={80} h={14} /><Skeleton w={70} h={14} /><Skeleton w={90} h={14} />
          </div>
        ))}</Card>
      ) : lista.length === 0 ? (
        <Card padding={0}><EmptyState icon="package" title="Tu inventario está vacío" desc="Agrega productos de consumo o de venta para controlar stock, costos y alertas de reposición." action={<Button iconLeft="plus" onClick={() => { setEditP(null); setFormOpen(true); }}>Nuevo producto</Button>} /></Card>
      ) : (
        <>
          {(alertas.data ?? []).length > 0 && <LowStockPanel items={alertas.data ?? []} onMove={(p) => setMovP(p)} />}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <GSegmented value={seg} onChange={(v) => setSeg(v as TipoProducto)} options={[
              { value: TipoProducto.Servicio, label: 'De servicio', icon: 'scissors', count: counts.servicio },
              { value: TipoProducto.Venta, label: 'De venta', icon: 'store', count: counts.venta },
            ]} />
            <div style={{ width: 320, maxWidth: '100%' }}><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre…" /></div>
          </div>

          {rows.length === 0 ? (
            <Card padding={0}><EmptyState icon="search" title="Sin resultados" desc={q ? `Ningún producto coincide con “${query}”.` : `No hay productos ${seg === TipoProducto.Venta ? 'de venta' : 'de servicio'} registrados.`} action={q ? <Button variant="secondary" onClick={() => setQuery('')}>Limpiar búsqueda</Button> : <Button iconLeft="plus" onClick={() => { setEditP(null); setFormOpen(true); }}>Nuevo producto</Button>} /></Card>
          ) : (
            <ProductTable rows={rows} tipo={seg} onMove={setMovP} onEdit={(p) => { setEditP(p); setFormOpen(true); }} onDelete={setDelP} />
          )}
        </>
      )}

      {formOpen && <ProductModal producto={editP} sucursales={sucs.data ?? []} defaultSucursalId={sucursalId} onClose={() => { setFormOpen(false); setEditP(null); }} onSaved={async () => { setFormOpen(false); setEditP(null); await refrescar(); }} />}
      {movP && <MovementModal producto={movP} onClose={() => setMovP(null)} onSaved={async () => { setMovP(null); await refrescar(); }} />}
      <GConfirm open={!!delP} title="Eliminar producto" danger confirmLabel="Eliminar" confirmIcon="trash-2"
        desc={delP ? <span><strong style={{ color: 'var(--text-primary)' }}>{delP.nombre}</strong> se eliminará del inventario. Esta acción no afecta los movimientos ya registrados.</span> : ''}
        onClose={() => setDelP(null)} onConfirm={() => delP && eliminar(delP)} />
    </div>
  );
}

function LowStockPanel({ items, onMove }: { items: ProductoInventario[]; onMove: (p: ProductoInventario) => void }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '16px 18px', borderRadius: 'var(--radius-md)', marginBottom: 20, background: 'var(--warning-tint)', border: '1px solid rgba(245,158,11,0.30)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.18)', flex: 'none' }}><Icon name="alert-triangle" size={20} color="#B45309" /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#92400E' }}>{items.length} {items.length === 1 ? 'producto necesita' : 'productos necesitan'} reposición</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {items.map((p) => (
            <button key={p.id} type="button" onClick={() => onMove(p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 30, padding: '0 10px', cursor: 'pointer', background: 'var(--surface-card)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
              <StockDot status={stockStatus(p.cantidad, p.stockMin)} withLabel={false} />
              {p.nombre}
              <span className="data" style={{ color: p.cantidad === 0 ? 'var(--error)' : '#B45309', fontWeight: 700 }}>{p.cantidad}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductTable({ rows, tipo, onMove, onEdit, onDelete }: { rows: ProductoInventario[]; tipo: TipoProducto; onMove: (p: ProductoInventario) => void; onEdit: (p: ProductoInventario) => void; onDelete: (p: ProductoInventario) => void }) {
  const th: React.CSSProperties = { textAlign: 'left', padding: '0 14px 10px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '14px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)', verticalAlign: 'middle' };
  const num: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' };
  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead><tr>
            <th style={{ ...th, paddingLeft: 18 }}>Producto</th>
            <th style={th}>Estado</th>
            <th style={{ ...th, textAlign: 'right' }}>Cantidad</th>
            <th style={{ ...th, textAlign: 'right' }}>Costo</th>
            {tipo === TipoProducto.Venta && <th style={{ ...th, textAlign: 'right' }}>Precio venta</th>}
            <th style={{ ...th, textAlign: 'right' }}>Mínimo</th>
            <th style={{ ...th, textAlign: 'right' }}>Valor total</th>
            <th style={{ ...th, paddingRight: 18 }} />
          </tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} data-testid={`producto-row-${p.id}`}>
                <td style={{ ...td, paddingLeft: 18, fontWeight: 600 }}>{p.nombre}</td>
                <td style={td}><StockDot status={stockStatus(p.cantidad, p.stockMin)} /></td>
                <td style={num}>{p.cantidad}</td>
                <td style={num}>{money(p.costo)}</td>
                {tipo === TipoProducto.Venta && <td style={num}>{money(p.precioVenta)}</td>}
                <td style={{ ...num, color: 'var(--text-tertiary)' }}>{p.stockMin}</td>
                <td style={{ ...num, fontWeight: 700 }}>{money(p.cantidad * Number(p.costo))}</td>
                <td style={{ ...td, textAlign: 'right', paddingRight: 12 }}>
                  <div style={{ display: 'inline-flex', justifyContent: 'flex-end' }}>
                    <RowMenu items={[
                      { icon: 'repeat', label: 'Registrar movimiento', onClick: () => onMove(p) },
                      { icon: 'edit', label: 'Editar', onClick: () => onEdit(p) },
                      { divider: true },
                      { icon: 'trash-2', label: 'Eliminar', danger: true, onClick: () => onDelete(p) },
                    ]} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ProductModal({ producto, sucursales, defaultSucursalId, onClose, onSaved }: { producto: ProductoInventario | null; sucursales: Sucursal[]; defaultSucursalId: string | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [tipo, setTipo] = useState<TipoProducto>(producto?.tipo ?? TipoProducto.Venta);
  const [sucId, setSucId] = useState(producto?.sucursalId ?? defaultSucursalId ?? sucursales[0]?.id ?? '');
  const [cantidad, setCantidad] = useState<number>(producto?.cantidad ?? 0);
  const [stockMin, setStockMin] = useState<number>(producto?.stockMin ?? 5);
  const [costo, setCosto] = useState<MoneyValue>(producto ? Number(producto.costo) : '');
  const [precioVenta, setPrecioVenta] = useState<MoneyValue>(producto ? Number(producto.precioVenta) : '');
  const [touched, setTouched] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const nombreErr = touched && nombre.trim().length < 2 ? 'Escribe un nombre' : undefined;
  const costoErr = touched && (costo === '' || costo == null) ? 'Indica el costo de compra' : undefined;
  const sucErr = touched && !sucId ? 'Elige una sucursal' : undefined;
  const valid = nombre.trim().length >= 2 && costo !== '' && costo != null && !!sucId;

  async function guardar() {
    setTouched(true);
    if (!valid) return;
    setGuardando(true);
    try {
      if (producto) {
        await editarProducto(producto.id, { nombre: nombre.trim(), tipo, stockMin: Number(stockMin) || 0, costo: Number(costo), precioVenta: Number(precioVenta) || 0 });
        toast('Producto actualizado', 'success');
      } else {
        await crearProducto({ sucursalId: sucId, nombre: nombre.trim(), tipo, cantidad: Number(cantidad) || 0, stockMin: Number(stockMin) || 0, costo: Number(costo), precioVenta: Number(precioVenta) || 0 });
        toast('Producto creado', 'success');
      }
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} width={600} title={producto ? 'Editar producto' : 'Nuevo producto'} subtitle={producto ? producto.nombre : 'Registra un producto de consumo interno o de venta al público.'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={guardando} onClick={guardar}>{producto ? 'Guardar cambios' : 'Crear producto'}</Button>
      </>}>
      <div style={{ padding: '8px 0 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          <GField label="Nombre del producto" span={2} error={nombreErr}><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Pomada mate" /></GField>
          {!producto && sucursales.length > 1 && (
            <GField label="Sucursal" span={2} error={sucErr}><Select value={sucId} onChange={(e) => setSucId(e.target.value)}>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</Select></GField>
          )}
        </div>

        <GField label="Tipo de producto">
          <GSegmented value={tipo} onChange={(v) => setTipo(v as TipoProducto)} options={[
            { value: TipoProducto.Servicio, label: 'De servicio', icon: 'scissors' },
            { value: TipoProducto.Venta, label: 'De venta', icon: 'store' },
          ]} />
        </GField>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
          <GField label="Costo de compra" hint="Por unidad" error={costoErr}><GMoney value={costo} onChange={setCosto} invalid={!!costoErr} /></GField>
          {tipo === TipoProducto.Venta && <GField label="Precio de venta" hint="Al público"><GMoney value={precioVenta} onChange={setPrecioVenta} /></GField>}
          <GField label="Stock mínimo" hint="Avisa cuando baje de aquí"><GNumber value={stockMin} onChange={setStockMin} min={0} /></GField>
        </div>

        {!producto && (
          <GField label="Cantidad inicial" hint="Después se ajusta por movimientos."><GNumber value={cantidad} onChange={setCantidad} min={0} /></GField>
        )}
      </div>
    </Dialog>
  );
}

function MovementModal({ producto, onClose, onSaved }: { producto: ProductoInventario; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [dir, setDir] = useState<'entrada' | 'salida' | 'ajuste'>('entrada');
  const [cantidad, setCantidad] = useState<number>(1);
  const [motivo, setMotivo] = useState('Compra');
  const [gasto, setGasto] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const motivos: Record<string, string[]> = {
    entrada: ['Compra', 'Devolución de cliente', 'Ajuste de inventario'],
    salida: ['Consumo en servicio', 'Merma / daño', 'Ajuste de inventario'],
    ajuste: ['Conteo físico', 'Corrección'],
  };
  useEffect(() => { setMotivo(motivos[dir][0]); }, [dir]);

  const delta = dir === 'entrada' ? cantidad : dir === 'salida' ? -cantidad : 0;
  const nuevo = dir === 'ajuste' ? cantidad : Math.max(0, producto.cantidad + delta);
  const esCompra = dir === 'entrada' && motivo === 'Compra';
  const gastoMonto = cantidad * Number(producto.costo);

  async function registrar() {
    setGuardando(true);
    try {
      await registrarMovimiento({ productoId: producto.id, tipoMov: dir, cantidad, motivo, generaGasto: esCompra && gasto, costoTotal: esCompra && gasto ? gastoMonto : undefined });
      toast(esCompra && gasto ? `Entrada registrada · gasto de ${money(gastoMonto)}` : 'Movimiento registrado', 'success');
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} width={480} title="Registrar movimiento" subtitle={producto.nombre}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={guardando} onClick={registrar}>Registrar</Button>
      </>}>
      <div style={{ padding: '8px 0 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <GField label="Tipo de movimiento">
          <GSegmented value={dir} onChange={(v) => setDir(v as typeof dir)} options={[
            { value: 'entrada', label: 'Entrada', icon: 'plus' },
            { value: 'salida', label: 'Salida', icon: 'minus' },
            { value: 'ajuste', label: 'Ajuste', icon: 'repeat' },
          ]} />
        </GField>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          <GField label={dir === 'ajuste' ? 'Stock final' : 'Cantidad'}><GNumber value={cantidad} onChange={setCantidad} min={dir === 'ajuste' ? 0 : 1} /></GField>
          <GField label="Motivo"><Select value={motivo} onChange={(e) => setMotivo(e.target.value)}>{motivos[dir].map((m) => <option key={m} value={m}>{m}</option>)}</Select></GField>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '14px 0', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)' }}>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Actual</div><div className="data" style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{producto.cantidad}</div></div>
          <Icon name="arrow-right" size={18} color="var(--text-tertiary)" />
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Nuevo</div><div className="data" style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: nuevo === 0 ? 'var(--error)' : nuevo <= producto.stockMin ? '#B45309' : 'var(--success)' }}>{nuevo}</div></div>
        </div>

        {esCompra && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
            <Switch checked={gasto} onChange={setGasto} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Generar gasto variable asociado</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Registra {money(gastoMonto)} como gasto de compra en Finanzas.</div>
            </div>
          </label>
        )}
      </div>
    </Dialog>
  );
}
