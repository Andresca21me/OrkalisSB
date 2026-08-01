import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { TipoProducto } from '@orkalis/shared';
import { useSucursal } from '../../lib/sucursal';
import { efectivoDe, moduloActivo, useConfig } from '../../lib/useConfig';
import { useInventario } from '../../lib/useInventario';
import { useEquipo } from '../../lib/useEquipo';
import { Button, Icon, Spinner } from '../../ui/ui';
import { CierreScreen } from './CierreScreen';
import { VentaModal, type ComisionProductoConfig } from './finanzas-modals';
import { PeriodPicker, periodoInicial } from '../../ui/PeriodPicker';

// Las pantallas con gráficos (recharts, ~380 kB) se cargan bajo demanda al abrir
// su pestaña — no al entrar al panel admin (FASE-14, lazy de gráficos).
const AnalisisScreen = lazy(() => import('./AnalisisScreen').then((m) => ({ default: m.AnalisisScreen })));
const TransaccionesScreen = lazy(() => import('./TransaccionesScreen').then((m) => ({ default: m.TransaccionesScreen })));
const GastosScreen = lazy(() => import('./GastosScreen').then((m) => ({ default: m.GastosScreen })));
const LiquidacionScreen = lazy(() => import('./LiquidacionScreen').then((m) => ({ default: m.LiquidacionScreen })));
const VentasInventarioScreen = lazy(() => import('./VentasInventarioScreen').then((m) => ({ default: m.VentasInventarioScreen })));

function ChartFallback() {
  return <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}><Spinner size={24} /></div>;
}

interface TabDef { id: string; label: string; icon: string }

export function FinanzasScreen() {
  const { sucursalActivaId } = useSucursal();
  const config = useConfig(sucursalActivaId);
  const cierreOn = moduloActivo(config.data, 'modulo.cierre_periodo');
  const inventarioOn = moduloActivo(config.data, 'modulo.inventario');
  const particion = moduloActivo(config.data, 'modulo.particion_por_especialista');

  const productos = useInventario(inventarioOn ? sucursalActivaId : undefined);
  const equipo = useEquipo();
  const [ventaOpen, setVentaOpen] = useState(false);

  // Período GLOBAL de Finanzas (Plan-Finanzas F4, D4): quincena/mes/rango.
  // Lo que se elige aquí manda en TODAS las pestañas — es la unidad del cierre.
  const [periodo, setPeriodo] = useState(periodoInicial);

  const tabs = useMemo<TabDef[]>(
    () => [
      { id: 'analisis', label: 'Resumen', icon: 'bar-chart-2' },
      { id: 'transacciones', label: 'Transacciones', icon: 'list' },
      { id: 'gastos', label: 'Gastos', icon: 'arrow-down-circle' },
      ...(particion ? [{ id: 'liquidacion', label: 'Liquidación', icon: 'users' }] : []),
      ...(cierreOn ? [{ id: 'cierres', label: 'Cierre de período', icon: 'lock' }] : []),
      ...(inventarioOn ? [{ id: 'inventario', label: 'Inventario y ventas', icon: 'package' }] : []),
    ],
    [cierreOn, inventarioOn, particion],
  );

  const [tab, setTab] = useState('analisis');
  useEffect(() => { if (!tabs.some((t) => t.id === tab)) setTab('analisis'); }, [tabs, tab]);

  const ventaProductos = (productos.data ?? []).filter((p) => p.tipo === TipoProducto.Venta);
  const comisionCfg: ComisionProductoConfig = {
    tipo: (efectivoDe(config.data ?? [], 'finanzas.comision_producto_tipo')?.valor as 'porcentaje' | 'valor_fijo') ?? 'porcentaje',
    valor: Number(efectivoDe(config.data ?? [], 'finanzas.comision_producto_valor')?.valor ?? 0),
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="ork-scroll-x" style={{ display: 'flex', gap: 4, minWidth: 0, maxWidth: '100%' }}>
          {tabs.map((t) => {
            const on = t.id === tab;
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto', whiteSpace: 'nowrap', gap: 9, height: 44, padding: '0 16px', marginBottom: -1, border: 'none', borderBottom: `2px solid ${on ? 'var(--brand)' : 'transparent'}`, background: 'transparent', cursor: 'pointer', color: on ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                <Icon name={t.icon} size={18} color={on ? 'var(--brand)' : 'var(--text-tertiary)'} />{t.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <PeriodPicker value={periodo} onChange={setPeriodo} />
          {inventarioOn && <Button variant="secondary" size="sm" iconLeft="plus" onClick={() => setVentaOpen(true)}>Registrar venta</Button>}
        </div>
      </div>

      <Suspense fallback={<ChartFallback />}>
        {tab === 'analisis' && <AnalisisScreen inventarioOn={inventarioOn} periodo={periodo} />}
        {tab === 'transacciones' && <TransaccionesScreen periodo={periodo} />}
        {tab === 'gastos' && <GastosScreen periodo={periodo} />}
        {tab === 'liquidacion' && particion && <LiquidacionScreen periodo={periodo} />}
        {tab === 'cierres' && cierreOn && <CierreScreen periodo={periodo} />}
        {tab === 'inventario' && inventarioOn && <VentasInventarioScreen periodo={periodo} />}
      </Suspense>

      {ventaOpen && <VentaModal productos={ventaProductos} especialistas={equipo.data ?? []} comisionCfg={comisionCfg} onClose={() => setVentaOpen(false)} onSaved={async () => { setVentaOpen(false); await productos.recargar(); }} />}
    </div>
  );
}
