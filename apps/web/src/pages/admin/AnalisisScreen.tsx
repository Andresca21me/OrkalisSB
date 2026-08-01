import { useState } from 'react';
import type { MetodoPago } from '@orkalis/shared';
import { useSucursal } from '../../lib/sucursal';
import { money } from '../../lib/format';
import { useAnalisis } from '../../lib/useReportes';
import { useValoracion } from '../../lib/useInventario';
import { useEquipo } from '../../lib/useEquipo';
import { useServicios } from '../../lib/useServicios';
import type { Periodo } from '../../ui/PeriodPicker';
import { BarChart, Donut, type DonutDato } from '../../ui/Chart';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Select,
  Spinner,
  useToast,
} from '../../ui/ui';
import { BreakdownBlock, FinTile, HBars, HealthBadge } from './finanzas-ui';
import { useVocabulario } from '../../lib/vocabulario';

const PAGO_LABEL: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', nequi: 'Nequi', otro: 'Otro' };

export function AnalisisScreen({ inventarioOn, periodo }: { inventarioOn: boolean; periodo: Periodo }) {
  const voc = useVocabulario();
  const { consolidado, sucursalActiva, sucursalActivaId } = useSucursal();
  const toast = useToast();
  // Filtros de transparencia (F4): acotan TODO el resumen a un especialista o
  // servicio; los gastos no se filtran (son del negocio) y se avisa.
  const [espId, setEspId] = useState('');
  const [servId, setServId] = useState('');
  const equipo = useEquipo();
  const servicios = useServicios();
  const filtroActivo = !!espId || !!servId;
  const a = useAnalisis(periodo.desde, periodo.hasta, sucursalActivaId, { especialistaId: espId || undefined, servicioId: servId || undefined });
  const valoracion = useValoracion(inventarioOn ? sucursalActivaId : undefined);

  const scope = consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal');
  const d = a.data;
  const empty = !!d && d.salud === 'sin_datos';

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
    link.href = url; link.download = `analisis-${periodo.etiqueta.replace(/\s+/g, '-')}.csv`; link.click();
    URL.revokeObjectURL(url);
    toast('Análisis exportado (CSV)', 'success');
  }

  const payDonut: DonutDato[] = (d?.porMetodoPago ?? []).map((p) => ({ label: PAGO_LABEL[p.metodo as MetodoPago] ?? p.metodo, value: p.total }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{scope}</div>
          <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>Resumen financiero</h1>
          {filtroActivo && (
            <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              Filtro activo: los ingresos y desgloses están acotados; los gastos siguen siendo del negocio completo.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Select value={espId} onChange={(e) => setEspId(e.target.value)} aria-label="Filtrar por especialista" style={{ height: 38 }}>
            <option value="">Todos los especialistas</option>
            {(equipo.data ?? []).filter((x) => x.activo).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </Select>
          <Select value={servId} onChange={(e) => setServId(e.target.value)} aria-label="Filtrar por servicio" style={{ height: 38 }}>
            <option value="">Todos los servicios</option>
            {(servicios.data ?? []).filter((x) => x.activo).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </Select>
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
              ]} total={`− ${money(d.egresos)}`} totalLabel="Total egresos" totalTone="neg"
              foot="El desglose gasto a gasto vive en la pestaña Gastos." />
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

          <Card padding={18} style={{ marginBottom: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Tendencia de ingresos del período</div>
            {d.tendencia.length === 0 ? (
              <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Sin datos para graficar.</div>
            ) : (
              <BarChart data={d.tendencia.map((t) => ({ label: t.etiqueta, value: t.total }))} />
            )}
          </Card>

          <div className="ork-cols-2" style={{ marginBottom: 24 }}>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Ingresos por servicio</div>
              {d.porServicio.length === 0 ? <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Sin servicios cobrados.</div> : <Donut data={d.porServicio.map((sv) => ({ label: sv.nombre, value: sv.total }))} />}
            </Card>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Ventas de producto</div>
              <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{money(d.ventasProducto)}</div>
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Facturado en productos (en citas y mostrador). El detalle vive en Inventario y ventas.</p>
            </Card>
          </div>

        </>
      ) : null}
    </div>
  );
}
