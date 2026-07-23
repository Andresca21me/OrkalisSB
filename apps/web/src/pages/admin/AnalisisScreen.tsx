import { useMemo, useState } from 'react';
import type { MetodoPago } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useSucursal } from '../../lib/sucursal';
import { money } from '../../lib/format';
import { diasATimestamps, presetRango, useAnalisis, type RangoDias } from '../../lib/useReportes';
import { eliminarGasto, useGastos } from '../../lib/useGastos';
import { useValoracion } from '../../lib/useInventario';
import { Donut, type DonutDato } from '../../ui/Chart';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Spinner,
  useToast,
} from '../../ui/ui';
import { GConfirm } from './gestion-ui';
import { BreakdownBlock, FinTile, HBars, HealthBadge, RangePicker } from './finanzas-ui';
import { GastoModal } from './finanzas-modals';
import { useVocabulario } from '../../lib/vocabulario';

interface Sucursal { id: string; nombre: string; activa: boolean }

const PAGO_LABEL: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', nequi: 'Nequi', otro: 'Otro' };

export function AnalisisScreen({ inventarioOn }: { inventarioOn: boolean }) {
  const voc = useVocabulario();
  const { consolidado, sucursalActiva, sucursalActivaId } = useSucursal();
  const toast = useToast();
  const [rango, setRango] = useState<RangoDias>(() => presetRango('mes'));
  const { desde, hasta } = useMemo(() => diasATimestamps(rango), [rango]);
  const a = useAnalisis(desde, hasta, sucursalActivaId);
  const gastos = useGastos(sucursalActivaId);
  const valoracion = useValoracion(inventarioOn ? sucursalActivaId : undefined);
  const sucs = useApi<Sucursal[]>(() => api.get('/sucursales'));

  const [gastoModal, setGastoModal] = useState<'fijo' | 'variable' | null>(null);
  const [delGasto, setDelGasto] = useState<{ id: string; categoria: string | null } | null>(null);

  const scope = consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal');
  const d = a.data;
  const empty = !!d && d.salud === 'sin_datos';

  const fijos = (gastos.data ?? []).filter((g) => g.tipo === 'fijo' && g.activo);
  const variables = (gastos.data ?? []).filter((g) => g.tipo === 'variable' && g.activo);

  async function eliminar(id: string) {
    try { await eliminarGasto(id); setDelGasto(null); toast('Gasto eliminado', 'info'); await Promise.all([gastos.recargar(), a.recargar()]); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  function exportarCsv() {
    if (!d) return;
    const filas = [
      ['concepto', 'valor'],
      ['Ingresos totales', d.ingresosTotales],
      ['Ingresos del salón', d.ingresosSalon],
      ['Parte profesionales', d.ganProfesionales],
      ['Gastos fijos', d.gastosFijos],
      ['Gastos variables', d.gastosVariables],
      ['Ganancia neta', d.gananciaNeta],
    ].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + filas + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `analisis-${rango.desde}_${rango.hasta}.csv`; link.click();
    URL.revokeObjectURL(url);
    toast('Análisis exportado (CSV)', 'success');
  }

  const payDonut: DonutDato[] = (d?.porMetodoPago ?? []).map((p) => ({ label: PAGO_LABEL[p.metodo as MetodoPago] ?? p.metodo, value: p.total }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{scope}</div>
          <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>Análisis financiero</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <RangePicker value={rango} onChange={setRango} />
          <Button variant="secondary" iconLeft="download" disabled={!d} onClick={exportarCsv}>CSV</Button>
        </div>
      </div>

      <div className="ork-kpis" style={{ marginBottom: 20 }}>
        {inventarioOn && <FinTile loading={a.cargando} label="Inventario actual" icon="package" value={money(valoracion.data?.valoracion ?? 0)} sub={<span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>valor invertido</span>} />}
        <FinTile loading={a.cargando} label="Ingresos del salón" icon="trending-up" value={money(d?.ingresosSalon ?? 0)} />
        <FinTile loading={a.cargando} label="Total gastos" icon="arrow-down-circle" value={money(d?.egresos ?? 0)} tone="neg" />
        <FinTile loading={a.cargando} big label="Ganancia neta" icon="wallet" value={money(d?.gananciaNeta ?? 0)} tone={(d?.gananciaNeta ?? 0) < 0 ? 'neg' : 'pos'} sub={d ? <HealthBadge health={d.salud} /> : undefined} />
      </div>

      {a.error ? (
        <ErrorState onRetry={a.recargar} />
      ) : a.cargando ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>
      ) : empty ? (
        <Card padding={0}><EmptyState icon="bar-chart-2" title="Sin movimientos en el período" desc="No hay ingresos ni gastos registrados. Cuando se registren citas y gastos, verás aquí el desglose." /></Card>
      ) : d ? (
        <>
          <div className="ork-cols-2" style={{ marginBottom: 16 }}>
            <BreakdownBlock title={`Ingresos ${voc.delNegocio}`} icon="trending-up" iconColor="var(--success)"
              rows={[
                { label: 'Facturado total', value: money(d.ingresosTotales) },
                { label: 'Parte de profesionales', value: `− ${money(d.ganProfesionales)}`, tone: 'neg' },
              ]} total={money(d.ingresosSalon)} totalLabel="Total ingresos" />
            <BreakdownBlock title="Egresos operativos" icon="arrow-down-circle" iconColor="var(--error)"
              rows={[
                { label: 'Gastos fijos', value: `− ${money(d.gastosFijos)}`, tone: 'neg' },
                { label: 'Gastos variables', value: `− ${money(d.gastosVariables)}`, tone: 'neg' },
              ]} total={`− ${money(d.egresos)}`} totalLabel="Total egresos" totalTone="neg" />
          </div>

          <div className="ork-cols-2" style={{ marginBottom: 24, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', gap: 12, padding: '16px 18px', borderRadius: 'var(--radius-md)', background: 'var(--info-tint)', border: '1px solid rgba(59,130,246,0.22)' }}>
              <Icon name="info" size={18} color="var(--info)" style={{ flex: 'none', marginTop: 1 }} />
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: '21px' }}>
                Los <strong style={{ color: 'var(--text-primary)' }}>pagos a profesionales no son egreso</strong>: su parte ({money(d.ganProfesionales)} este período) ya se separó en origen según la repartición. Aquí solo ves lo que corresponde {voc.alNegocio}.
              </div>
            </div>
            <Card padding={18} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', background: d.gananciaNeta < 0 ? 'var(--error-tint)' : 'var(--surface-card)', borderColor: d.gananciaNeta < 0 ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Ganancia neta</span>
                <HealthBadge health={d.salud} />
              </div>
              <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em', color: d.gananciaNeta < 0 ? 'var(--error)' : 'var(--text-primary)', margin: '8px 0 2px' }}>{money(d.gananciaNeta)}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Margen de utilidad: <span className="data" style={{ fontWeight: 700, color: d.gananciaNeta < 0 ? 'var(--error)' : 'var(--text-secondary)' }}>{(d.margen * 100).toFixed(1)}%</span></div>
            </Card>
          </div>

          <div className="ork-cols-2" style={{ marginBottom: 24 }}>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Ingresos por método de pago</div>
              {payDonut.length === 0 ? <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Sin pagos en el período.</div> : <Donut data={payDonut} />}
            </Card>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 16 }}>Ganancias por especialista</div>
              <HBars data={d.porEspecialista.map((e) => ({ nombre: e.nombre, valor: e.ingresos }))} />
            </Card>
          </div>

          <h2 style={{ fontSize: 'var(--text-lg)', letterSpacing: '-0.01em', marginBottom: 14 }}>Gestión de gastos</h2>
          <div className="ork-cols-2">
            <ExpenseCard titulo="Gastos fijos" items={fijos} onAdd={() => setGastoModal('fijo')} onDelete={(g) => setDelGasto(g)} />
            <ExpenseCard titulo="Gastos variables" items={variables} onAdd={() => setGastoModal('variable')} onDelete={(g) => setDelGasto(g)} />
          </div>
        </>
      ) : null}

      {gastoModal && <GastoModal kind={gastoModal} sucursales={sucs.data ?? []} defaultSucursalId={sucursalActivaId} onClose={() => setGastoModal(null)} onSaved={async () => { setGastoModal(null); await Promise.all([gastos.recargar(), a.recargar()]); }} />}
      <GConfirm open={!!delGasto} danger title="Eliminar gasto" confirmLabel="Eliminar" confirmIcon="trash-2"
        desc={delGasto ? <span><strong style={{ color: 'var(--text-primary)' }}>{delGasto.categoria || 'Gasto'}</strong> se eliminará del período (borrado lógico, se conserva el historial).</span> : ''}
        onClose={() => setDelGasto(null)} onConfirm={() => delGasto && eliminar(delGasto.id)} />
    </div>
  );
}

function ExpenseCard({ titulo, items, onAdd, onDelete }: { titulo: string; items: { id: string; categoria: string | null; monto: string }[]; onAdd: () => void; onDelete: (g: { id: string; categoria: string | null }) => void }) {
  return (
    <Card padding={18}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ minWidth: 0, fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)' }}>{titulo}</span>
        <Button variant="secondary" size="sm" iconLeft="plus" onClick={onAdd}>Agregar gasto</Button>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '16px 4px', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Sin gastos registrados.</div>
      ) : (
        <div>
          {items.map((g, i) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
              <Badge tone="neutral">{g.categoria || 'Gasto'}</Badge>
              <span className="data" style={{ marginLeft: 'auto', fontWeight: 600 }}>{money(g.monto)}</span>
              <button type="button" onClick={() => onDelete(g)} aria-label="Eliminar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', padding: 4 }}><Icon name="trash-2" size={15} color="var(--text-tertiary)" /></button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
