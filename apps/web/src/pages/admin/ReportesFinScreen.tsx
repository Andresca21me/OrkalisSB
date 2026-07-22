import { useMemo, useState } from 'react';
import type { MetodoPago } from '@orkalis/shared';
import { useSucursal } from '../../lib/sucursal';
import { money } from '../../lib/format';
import { diasATimestamps, etiquetaRango, presetRango, useAnalisis, type RangoDias } from '../../lib/useReportes';
import { BarChart, Donut, type DonutDato, type SeriePunto } from '../../ui/Chart';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, Spinner, useToast } from '../../ui/ui';
import { compactCOP, FinTile, HBars, RangePicker } from './finanzas-ui';
import { GSegmented } from './gestion-ui';
import { useVocabulario } from '../../lib/vocabulario';

const PAGO_LABEL: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', nequi: 'Nequi', otro: 'Otro' };

export function ReportesFinScreen({ particion }: { particion: boolean }) {
  const voc = useVocabulario();
  const { consolidado, sucursalActiva, sucursalActivaId } = useSucursal();
  const toast = useToast();
  const [tipo, setTipo] = useState('admin');
  const [rango, setRango] = useState<RangoDias>(() => presetRango('mes'));
  const { desde, hasta } = useMemo(() => diasATimestamps(rango), [rango]);
  const a = useAnalisis(desde, hasta, sucursalActivaId);
  const rangoLabel = etiquetaRango(rango);

  const scope = consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal');
  const d = a.data;
  const empty = !!d && d.salud === 'sin_datos';

  function exportarCsv() {
    if (!d) return;
    const filas = [['servicio', 'total'], ...d.porServicio.map((s) => [s.nombre, s.total])].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + filas + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `reporte-${rango.desde}_${rango.hasta}.csv`; link.click();
    URL.revokeObjectURL(url);
    toast('Reporte exportado (CSV)', 'success');
  }

  const trend: SeriePunto[] = (d?.tendencia ?? []).map((t) => ({ label: t.etiqueta, value: t.total }));
  const svcDonut: DonutDato[] = (d?.porServicio ?? []).slice(0, 6).map((s) => ({ label: s.nombre, value: s.total }));
  const payDonut: DonutDato[] = (d?.porMetodoPago ?? []).map((p) => ({ label: PAGO_LABEL[p.metodo as MetodoPago] ?? p.metodo, value: p.total }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{scope}</div>
          <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>Reportes y gráficos</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" iconLeft="refresh-cw" onClick={() => void a.recargar()}>Refrescar</Button>
          <Button variant="secondary" iconLeft="download" disabled={!d} onClick={exportarCsv}>CSV</Button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600 }}>Tipo de reporte</div>
          <GSegmented value={tipo} onChange={setTipo} options={[{ value: 'admin', label: 'Administrativo' }, { value: 'profesional', label: 'Por profesional' }]} />
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600 }}>Período</div>
          <RangePicker value={rango} onChange={setRango} />
        </div>
      </div>

      {a.error ? (
        <ErrorState onRetry={a.recargar} />
      ) : tipo === 'profesional' ? (
        <Card padding={0}>
          <div style={{ padding: '64px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 'var(--radius-lg)', background: 'var(--brand-tint)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}><Icon name="users" size={26} color="var(--brand)" /></span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <h3 style={{ fontSize: 'var(--text-md)' }}>Reporte por profesional</h3>
              <Badge tone="warning">En desarrollo</Badge>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: 420, margin: 0, lineHeight: '21px' }}>
              {particion ? 'El análisis individual por profesional (servicios, ganancias y comisiones) llega próximamente.' : 'Este reporte requiere la partición por especialista, desactivada. Actívala en Configuración para habilitar el desglose individual.'}
            </p>
          </div>
        </Card>
      ) : a.cargando ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>
      ) : empty ? (
        <Card padding={0}><EmptyState icon="bar-chart-2" title="Sin datos en el período" desc={`No hay actividad para “${rangoLabel}”. Los gráficos aparecerán cuando se registren servicios.`} /></Card>
      ) : d ? (
        <>
          <div className="ork-kpis" style={{ marginBottom: 20 }}>
            <FinTile label="Ingresos totales" icon="dollar-sign" value={money(d.ingresosTotales)} sub={<span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{d.servicios} servicios</span>} />
            <FinTile label="Ganaron los profesionales" icon="users" value={money(d.ganProfesionales)} />
            <FinTile label={`Ganó ${voc.elNegocio}`} icon="wallet" value={money(d.ingresosSalon)} />
            <FinTile label="Ventas de producto" icon="package" value={money(d.ventasProducto)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Tendencia de ingresos · {rangoLabel}</div>
              {trend.length === 0 ? <SinDatos /> : <BarChart data={trend} formatY={compactCOP} />}
            </Card>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Distribución por tipo de servicio</div>
              {svcDonut.length === 0 ? <SinDatos /> : <Donut data={svcDonut} />}
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Distribución por método de pago</div>
              {payDonut.length === 0 ? <SinDatos /> : <Donut data={payDonut} />}
            </Card>
            <Card padding={18}>
              <div className="eyebrow" style={{ marginBottom: 16 }}>Ranking de profesionales</div>
              {particion ? <HBars data={d.porEspecialista.map((e) => ({ nombre: e.nombre, valor: e.ingresos }))} />
                : <div style={{ padding: '20px 8px', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', textAlign: 'center' }}>El ranking por profesional requiere la partición por especialista (desactivada).</div>}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SinDatos() {
  return <div style={{ display: 'grid', placeItems: 'center', height: 220, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Sin datos en el período.</div>;
}
