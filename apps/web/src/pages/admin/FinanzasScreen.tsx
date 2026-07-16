import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { TipoProducto } from '@orkalis/shared';
import { useSucursal } from '../../lib/sucursal';
import { moduloActivo, useConfig } from '../../lib/useConfig';
import { useInventario } from '../../lib/useInventario';
import { useEquipo } from '../../lib/useEquipo';
import { Button, Icon, Spinner } from '../../ui/ui';
import { QuincenalScreen } from './QuincenalScreen';
import { VentaModal } from './finanzas-modals';

// Las pantallas con gráficos (recharts, ~380 kB) se cargan bajo demanda al abrir
// su pestaña — no al entrar al panel admin (FASE-14, lazy de gráficos).
const AnalisisScreen = lazy(() => import('./AnalisisScreen').then((m) => ({ default: m.AnalisisScreen })));
const ReportesFinScreen = lazy(() => import('./ReportesFinScreen').then((m) => ({ default: m.ReportesFinScreen })));

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

  const tabs = useMemo<TabDef[]>(
    () => [
      { id: 'analisis', label: 'Análisis', icon: 'bar-chart-2' },
      ...(cierreOn ? [{ id: 'quincenal', label: 'Control quincenal', icon: 'calendar' }] : []),
      { id: 'reportes', label: 'Reportes', icon: 'pie-chart' },
    ],
    [cierreOn],
  );

  const [tab, setTab] = useState('analisis');
  useEffect(() => { if (!tabs.some((t) => t.id === tab)) setTab('analisis'); }, [tabs, tab]);

  const ventaProductos = (productos.data ?? []).filter((p) => p.tipo === TipoProducto.Venta);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map((t) => {
            const on = t.id === tab;
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, height: 44, padding: '0 16px', marginBottom: -1, border: 'none', borderBottom: `2px solid ${on ? 'var(--brand)' : 'transparent'}`, background: 'transparent', cursor: 'pointer', color: on ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                <Icon name={t.icon} size={18} color={on ? 'var(--brand)' : 'var(--text-tertiary)'} />{t.label}
              </button>
            );
          })}
        </div>
        {inventarioOn && <Button variant="secondary" size="sm" iconLeft="plus" onClick={() => setVentaOpen(true)} style={{ marginBottom: 8 }}>Registrar venta</Button>}
      </div>

      <Suspense fallback={<ChartFallback />}>
        {tab === 'analisis' && <AnalisisScreen inventarioOn={inventarioOn} />}
        {tab === 'quincenal' && cierreOn && <QuincenalScreen />}
        {tab === 'reportes' && <ReportesFinScreen particion={particion} />}
      </Suspense>

      {ventaOpen && <VentaModal productos={ventaProductos} especialistas={equipo.data ?? []} onClose={() => setVentaOpen(false)} onSaved={async () => { setVentaOpen(false); await productos.recargar(); }} />}
    </div>
  );
}
