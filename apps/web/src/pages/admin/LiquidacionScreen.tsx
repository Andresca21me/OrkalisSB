import { useEffect, useState } from 'react';
import type { GananciasDetalle, LiquidacionResultado } from '@orkalis/shared';
import { api } from '../../lib/api';
import { money, hora } from '../../lib/format';
import { useSucursal } from '../../lib/sucursal';
import { previewLiquidacion } from '../../lib/useEquipo';
import { DataTable, type ColumnaTabla } from '../../ui/DataTable';
import type { Periodo } from '../../ui/PeriodPicker';
import { Avatar, Button, ErrorState, Spinner, useToast } from '../../ui/ui';
import { GSummaryRow } from './gestion-ui';

const FMT_FECHA = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short' });

/**
 * Liquidación por especialista (Plan-Finanzas F5). Vivía en Gestión → Equipo;
 * pertenece a Finanzas porque ES el pago del período: usa el período global
 * (quincenas incluidas — así se paga en los salones), soporta consolidado, y
 * cada fila se expande con el desglose y las transacciones que la componen.
 * Sin columna de descuento: la comisión bancaria la absorbe el negocio (D3).
 */
export function LiquidacionScreen({ periodo }: { periodo: Periodo }) {
  const { consolidado, sucursalActiva, sucursalActivaId } = useSucursal();
  const toast = useToast();
  const [rows, setRows] = useState<LiquidacionResultado[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    setRows(null);
    setError(false);
    previewLiquidacion({ desde: periodo.desde, hasta: periodo.hasta, sucursalId: sucursalActivaId ?? undefined })
      .then((r) => vivo && setRows(r))
      .catch(() => vivo && setError(true));
    return () => { vivo = false; };
  }, [periodo.desde, periodo.hasta, sucursalActivaId]);

  async function exportarCsv() {
    try {
      const csv = await api.postRaw('/liquidaciones/csv', { desde: periodo.desde, hasta: periodo.hasta, sucursalId: sucursalActivaId ?? undefined });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `liquidacion-${periodo.etiqueta.replace(/\s+/g, '-')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast('Liquidación exportada (CSV)', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const totalNeto = (rows ?? []).reduce((s, r) => s + r.neto, 0);

  const columnas: ColumnaTabla<LiquidacionResultado>[] = [
    {
      id: 'nombre', titulo: 'Especialista',
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={r.nombre} size={28} />
          <span style={{ fontWeight: 600 }}>{r.nombre}</span>
        </span>
      ),
    },
    { id: 'servicios', titulo: 'Por servicios', align: 'right', render: (r) => <span className="data" style={{ color: 'var(--text-secondary)' }}>{money(r.comisionServicios)}</span> },
    { id: 'productos', titulo: 'Por productos', align: 'right', render: (r) => <span className="data" style={{ color: 'var(--text-secondary)' }}>{money(r.comisionProductos)}</span> },
    { id: 'neto', titulo: 'Neto a pagar', align: 'right', render: (r) => <span className="data" style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{money(r.neto)}</span> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal')} · {periodo.etiqueta}</div>
          <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>Liquidación del período</h1>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Lo que le corresponde a cada especialista. Expande una fila para ver sus transacciones.
          </p>
        </div>
        <Button variant="secondary" iconLeft="download" disabled={!rows?.length} onClick={() => void exportarCsv()}>CSV</Button>
      </div>

      {error ? (
        <ErrorState onRetry={() => { setError(false); setRows(null); previewLiquidacion({ desde: periodo.desde, hasta: periodo.hasta, sucursalId: sucursalActivaId ?? undefined }).then(setRows).catch(() => setError(true)); }} />
      ) : rows === null ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}><Spinner /></div>
      ) : (
        <DataTable
          columnas={columnas}
          filas={rows}
          keyDe={(r) => r.especialistaId}
          minWidth={640}
          expandible={(r) => <TransaccionesDeLiquidacion especialistaId={r.especialistaId} periodo={periodo} />}
          vacio="Sin actividad de especialistas en este período."
          pie={
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Total neto del período</span>
              <span className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>{money(totalNeto)}</span>
            </div>
          }
        />
      )}
    </div>
  );
}

/** Las transacciones que componen la liquidación de UN especialista. */
function TransaccionesDeLiquidacion({ especialistaId, periodo }: { especialistaId: string; periodo: Periodo }) {
  const [datos, setDatos] = useState<GananciasDetalle | null>(null);
  const [error, setError] = useState(false);

  const cargar = () => {
    setDatos(null);
    setError(false);
    api
      .get<GananciasDetalle>(`/especialistas/${especialistaId}/ganancias/detalle?desde=${periodo.desde}&hasta=${periodo.hasta}`)
      .then(setDatos)
      .catch(() => setError(true));
  };
  useEffect(cargar, [especialistaId, periodo.desde, periodo.hasta]);

  if (error) return <ErrorState onRetry={cargar} />;
  if (!datos) return <div style={{ display: 'grid', placeItems: 'center', padding: 20 }}><Spinner /></div>;

  return (
    <div style={{ maxWidth: 680 }}>
      {datos.transacciones.map((t, i) => (
        <GSummaryRow
          key={t.atencionId ?? t.ventaId ?? i}
          first={i === 0}
          label={`${FMT_FECHA.format(new Date(t.fecha))} · ${hora(t.fecha)} — ${t.tipo === 'venta_directa' ? 'Venta directa' : (t.clienteNombre ?? 'Walk-in')}`}
          sub={`${t.concepto} · ${t.reglaResumen} · bruto ${money(t.bruto)}`}
          value={money(t.neto)}
        />
      ))}
      <GSummaryRow label="Total del especialista" value={money(datos.total)} strong />
    </div>
  );
}
