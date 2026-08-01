import { useState } from 'react';
import type { GastoOcurrencia } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useSucursal } from '../../lib/sucursal';
import { money } from '../../lib/format';
import { eliminarGasto, useGastos, useGastosDetalle } from '../../lib/useGastos';
import { DataTable, type ColumnaTabla } from '../../ui/DataTable';
import type { Periodo } from '../../ui/PeriodPicker';
import { Badge, Button, Card, EmptyState, Icon, useToast } from '../../ui/ui';
import { GConfirm } from './gestion-ui';
import { FinTile } from './finanzas-ui';
import { GastoModal } from './finanzas-modals';

interface Sucursal { id: string; nombre: string; activa: boolean }

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 'YYYY-MM-DD' → "5 jul 2026" (la fecha ya viene en día Bogotá). */
function fechaDia(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/**
 * Pestaña Gastos (Plan-Gastos): el desglose de TODO lo gastado en el período
 * elegido — qué fue, cuándo golpeó las finanzas y cuánto — más la gestión de
 * los gastos fijos programados (recurren cada mes en su día de cobro) y el
 * alta de gastos variables puntuales.
 */
export function GastosScreen({ periodo }: { periodo: Periodo }) {
  const { consolidado, sucursalActiva, sucursalActivaId } = useSucursal();
  const toast = useToast();

  const detalle = useGastosDetalle(periodo.desde, periodo.hasta, sucursalActivaId);
  const gastos = useGastos(sucursalActivaId);
  const sucs = useApi<Sucursal[]>(() => api.get('/sucursales'));

  const [gastoModal, setGastoModal] = useState<'fijo' | 'variable' | null>(null);
  const [delGasto, setDelGasto] = useState<{ id: string; categoria: string | null; tipo: 'fijo' | 'variable' } | null>(null);

  const scope = consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal');
  const d = detalle.data;
  const fijosProgramados = (gastos.data ?? []).filter((g) => g.tipo === 'fijo' && g.activo);

  async function eliminar(id: string) {
    try {
      await eliminarGasto(id);
      setDelGasto(null);
      toast('Gasto eliminado', 'info');
      await Promise.all([gastos.recargar(), detalle.recargar()]);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const columnas: ColumnaTabla<GastoOcurrencia>[] = [
    { id: 'fecha', titulo: 'Fecha', render: (f) => <span className="data" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fechaDia(f.fecha)}</span> },
    { id: 'concepto', titulo: 'Concepto', render: (f) => <span style={{ fontWeight: 600 }}>{f.categoria || 'Gasto'}</span> },
    {
      id: 'tipo', titulo: 'Tipo',
      render: (f) => f.tipo === 'fijo' ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <Badge tone="info">Fijo</Badge>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            se cobra el día {f.diaCobro} de cada mes{f.activo ? '' : ' · ya desactivado'}
          </span>
        </span>
      ) : (
        <Badge tone="neutral">Variable</Badge>
      ),
    },
    { id: 'monto', titulo: 'Monto', align: 'right', render: (f) => <span className="data" style={{ fontWeight: 700, color: 'var(--error)', whiteSpace: 'nowrap' }}>− {money(f.monto)}</span> },
    {
      id: 'acciones', titulo: '', align: 'right',
      render: (f) => f.tipo === 'variable' ? (
        <button type="button" aria-label={`Eliminar ${f.categoria || 'gasto'}`} onClick={() => setDelGasto({ id: f.gastoId, categoria: f.categoria, tipo: 'variable' })}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', padding: 4 }}>
          <Icon name="trash-2" size={15} color="var(--text-tertiary)" />
        </button>
      ) : null,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{scope}</div>
          <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>Gastos</h1>
          <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
            Todo lo gastado en el período elegido, con su fecha. Los fijos se cobran solos cada mes.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" iconLeft="repeat" onClick={() => setGastoModal('fijo')}>Gasto fijo</Button>
          <Button variant="primary" iconLeft="plus" onClick={() => setGastoModal('variable')}>Gasto variable</Button>
        </div>
      </div>

      <div className="ork-kpis" style={{ marginBottom: 20 }}>
        <FinTile loading={detalle.cargando} big label="Total gastos del período" icon="arrow-down-circle" value={money(d?.total ?? 0)} tone="neg" />
        <FinTile loading={detalle.cargando} label="Gastos fijos" icon="repeat" value={money(d?.totalFijos ?? 0)}
          sub={<span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{fijosProgramados.length} programado{fijosProgramados.length === 1 ? '' : 's'}</span>} />
        <FinTile loading={detalle.cargando} label="Gastos variables" icon="zap" value={money(d?.totalVariables ?? 0)} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <DataTable
          columnas={columnas}
          filas={d?.filas ?? []}
          keyDe={(f) => `${f.gastoId}-${f.fecha}`}
          minWidth={640}
          vacio={<EmptyState icon="arrow-down-circle" title="Sin gastos en el período" desc="Registra un gasto variable o programa un gasto fijo y aparecerá aquí con su fecha." />}
          pie={d && d.filas.length > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, padding: '12px 14px', fontSize: 'var(--text-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total del período</span>
              <span className="data" style={{ fontWeight: 800, color: 'var(--error)' }}>− {money(d.total)}</span>
            </div>
          ) : undefined}
        />
      </div>

      <h2 style={{ fontSize: 'var(--text-lg)', letterSpacing: '-0.01em', marginBottom: 6 }}>Gastos fijos programados</h2>
      <p style={{ margin: '0 0 14px', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
        Se registran automáticamente cada mes en su día de cobro. Al eliminar uno deja de cobrarse desde hoy; lo ya cobrado en períodos pasados se conserva.
      </p>
      <Card padding={18}>
        {fijosProgramados.length === 0 ? (
          <div style={{ padding: '10px 4px', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
            No hay gastos fijos programados. Agrega el arriendo, los servicios públicos o la nómina y quedarán cobrándose solos.
          </div>
        ) : (
          <div>
            {fijosProgramados.map((g, i) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '11px 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                <span style={{ display: 'inline-flex', width: 32, height: 32, flex: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="repeat" size={15} color="var(--text-tertiary)" />
                </span>
                <span style={{ minWidth: 0, flex: '1 1 160px' }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{g.categoria || 'Gasto fijo'}</span>
                  <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Cada mes, el día {g.diaCobro ?? '—'}</span>
                </span>
                <span className="data" style={{ marginLeft: 'auto', fontWeight: 700 }}>{money(g.monto)}<span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-tertiary)' }}>/mes</span></span>
                <button type="button" aria-label={`Eliminar ${g.categoria || 'gasto fijo'}`} onClick={() => setDelGasto({ id: g.id, categoria: g.categoria, tipo: 'fijo' })}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', padding: 4 }}>
                  <Icon name="trash-2" size={15} color="var(--text-tertiary)" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {gastoModal && (
        <GastoModal kind={gastoModal} sucursales={sucs.data ?? []} defaultSucursalId={sucursalActivaId}
          onClose={() => setGastoModal(null)}
          onSaved={async () => { setGastoModal(null); await Promise.all([gastos.recargar(), detalle.recargar()]); }} />
      )}
      <GConfirm open={!!delGasto} danger title="Eliminar gasto" confirmLabel="Eliminar" confirmIcon="trash-2"
        desc={delGasto ? (
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>{delGasto.categoria || 'Gasto'}</strong>{' '}
            {delGasto.tipo === 'fijo'
              ? 'dejará de cobrarse desde hoy. Lo ya cobrado en períodos pasados se conserva en los reportes.'
              : 'se eliminará del período (borrado lógico, se conserva el registro).'}
          </span>
        ) : ''}
        onClose={() => setDelGasto(null)} onConfirm={() => delGasto && eliminar(delGasto.id)} />
    </div>
  );
}
