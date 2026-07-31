import { useState } from 'react';
import type { Cierre, CierreArchivo, ReporteFinanciero } from '@orkalis/shared';
import { money } from '../../lib/format';
import { useSucursal } from '../../lib/sucursal';
import { useAnalisis } from '../../lib/useReportes';
import { crearCierre, useCierres } from '../../lib/useCierres';
import { DataTable, type ColumnaTabla } from '../../ui/DataTable';
import type { Periodo } from '../../ui/PeriodPicker';
import { Alert, Badge, Button, ErrorState, Icon, Spinner, useToast } from '../../ui/ui';
import { FinTile } from './finanzas-ui';
import { GConfirm, GSummaryRow } from './gestion-ui';

const FMT = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' });

/** ¿El snapshot es del formato nuevo (análisis + liquidaciones)? */
function esArchivoCompleto(d: Cierre['datosArchivados']): d is CierreArchivo {
  return typeof d === 'object' && d !== null && 'analisis' in d;
}

/**
 * Cierre de período (Plan-Finanzas F6, gate `modulo.cierre_periodo`). El
 * período lo manda el selector global de Finanzas: aquí se revisa el resumen,
 * se genera el cierre (quincena o mes — el backend deriva el rango y rechaza
 * solapes) y se consulta el histórico con su snapshot completo.
 */
export function CierreScreen({ periodo }: { periodo: Periodo }) {
  const { consolidado, sucursalActiva, sucursalActivaId } = useSucursal();
  const toast = useToast();
  const a = useAnalisis(periodo.desde, periodo.hasta, sucursalActivaId);
  const cierres = useCierres();
  const [confirmar, setConfirmar] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  const esRangoLibre = periodo.tipo === 'rango';
  const tipo: 'quincenal' | 'mensual' = periodo.tipo === 'mes' ? 'mensual' : 'quincenal';
  // Ancla del período: el día que identifica la quincena (1 o 16) o el mes.
  const ancla = periodo.tipo === 'q2' ? periodo.ancla.replace(/-01$/, '-16') : periodo.ancla;

  // ¿El período elegido ya se pisa con un cierre del MISMO alcance?
  const solapado = (cierres.data ?? []).find((c) => {
    const mismoAlcance = (c.sucursalId ?? null) === (sucursalActivaId ?? null);
    return mismoAlcance && new Date(c.desde) < new Date(periodo.hasta) && new Date(c.hasta) > new Date(periodo.desde);
  });

  async function cerrar() {
    setCerrando(true);
    try {
      await crearCierre({ tipo, ancla, sucursalId: sucursalActivaId ?? undefined });
      setConfirmar(false);
      toast(`Cierre ${tipo === 'mensual' ? 'del mes' : 'de la quincena'} generado`, 'success');
      await cierres.recargar();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setCerrando(false);
    }
  }

  const d = a.data;
  const alcanceDe = (c: Cierre) => (c.sucursalId ? 'Sucursal' : 'Consolidado');
  const columnas: ColumnaTabla<Cierre>[] = [
    { id: 'periodo', titulo: 'Período', render: (c) => <span className="data" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{FMT.format(new Date(c.desde))} – {FMT.format(new Date(c.hasta))}</span> },
    { id: 'tipo', titulo: 'Tipo', render: (c) => <Badge tone={c.tipo === 'mensual' ? 'brand' : 'info'}>{c.tipo === 'mensual' ? 'Mensual' : 'Quincenal'}</Badge> },
    { id: 'alcance', titulo: 'Alcance', render: (c) => <span style={{ color: 'var(--text-secondary)' }}>{alcanceDe(c)}</span> },
    {
      id: 'ingresos', titulo: 'Ingresos', align: 'right',
      render: (c) => <span className="data" style={{ fontWeight: 600 }}>{money(esArchivoCompleto(c.datosArchivados) ? c.datosArchivados.analisis.ingresosTotales : (c.datosArchivados as ReporteFinanciero).ingresos)}</span>,
    },
    {
      id: 'neta', titulo: 'Ganancia neta', align: 'right',
      render: (c) => <span className="data" style={{ fontWeight: 700 }}>{money(esArchivoCompleto(c.datosArchivados) ? c.datosArchivados.analisis.gananciaNeta : (c.datosArchivados as ReporteFinanciero).gananciaNeta)}</span>,
    },
    { id: 'creado', titulo: 'Cerrado el', align: 'right', render: (c) => <span style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{FMT.format(new Date(c.creadoEn))}</span> },
  ];

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal')} · {periodo.etiqueta}</div>
        <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>Cierre de período</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: 640 }}>
          Cierra la quincena o el mes para dejar constancia de lo facturado y lo liquidado a cada especialista. El archivo del cierre queda congelado, listo para auditar el pago.
        </p>
      </div>

      {esRangoLibre ? (
        <Alert tone="info" title="Elige una quincena o un mes">
          Los cierres se generan sobre quincenas o meses completos. Cambia el período en el selector de arriba.
        </Alert>
      ) : (
        <>
          <div className="ork-kpis" style={{ marginBottom: 18 }}>
            <FinTile loading={a.cargando} label="Ingresos del período" icon="trending-up" value={money(d?.ingresosTotales ?? 0)} />
            <FinTile loading={a.cargando} label="Transacciones" icon="list" value={String(d?.servicios ?? 0)} />
            <FinTile loading={a.cargando} label="Parte de especialistas" icon="users" value={money(d?.ganProfesionales ?? 0)} />
            <FinTile loading={a.cargando} big label="Ganancia del negocio" icon="wallet" value={money(d?.gananciaNeta ?? 0)} tone={(d?.gananciaNeta ?? 0) < 0 ? 'neg' : 'pos'} />
          </div>

          {solapado ? (
            <Alert tone="warning" title="Este período ya tiene cierre">
              Se cerró el {FMT.format(new Date(solapado.creadoEn))} ({FMT.format(new Date(solapado.desde))} – {FMT.format(new Date(solapado.hasta))}). Un período se cierra una sola vez; consúltalo en el histórico de abajo.
            </Alert>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '16px 18px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', marginBottom: 8 }}>
              <Icon name="lock" size={18} color="var(--text-tertiary)" />
              <span style={{ flex: 1, minWidth: 220, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Al cerrar se archivan el análisis completo y la liquidación por especialista de <strong style={{ color: 'var(--text-primary)' }}>{periodo.etiqueta}</strong>{consolidado ? ' (consolidado)' : ` (${sucursalActiva?.nombre ?? 'sucursal'})`}.
              </span>
              <Button iconLeft="lock" disabled={a.cargando || !d} onClick={() => setConfirmar(true)}>
                Cerrar {tipo === 'mensual' ? 'el mes' : 'la quincena'}
              </Button>
            </div>
          )}
        </>
      )}

      <h2 style={{ fontSize: 'var(--text-lg)', letterSpacing: '-0.01em', margin: '24px 0 14px' }}>Períodos cerrados</h2>
      {cierres.error ? (
        <ErrorState onRetry={cierres.recargar} />
      ) : cierres.cargando ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>
      ) : (
        <DataTable
          columnas={columnas}
          filas={cierres.data ?? []}
          keyDe={(c) => c.id}
          minWidth={760}
          vacio="Aún no has cerrado ningún período."
          expandible={(c) => <SnapshotCierre cierre={c} />}
        />
      )}

      <GConfirm
        open={confirmar}
        title={`Cerrar ${tipo === 'mensual' ? 'el mes' : 'la quincena'} · ${periodo.etiqueta}`}
        confirmLabel="Generar cierre"
        confirmIcon="lock"
        desc={<span>Se archiva el snapshot del período tal como se ve hoy. Las operaciones posteriores (p. ej. revertir un cobro) <strong style={{ color: 'var(--text-primary)' }}>no modifican</strong> el archivo: quedará como constancia del pago.</span>}
        onClose={() => setConfirmar(false)}
        onConfirm={() => { if (!cerrando) void cerrar(); }}
      />
    </div>
  );
}

/** Snapshot archivado de un cierre (fila expandida del histórico). */
function SnapshotCierre({ cierre }: { cierre: Cierre }) {
  if (!esArchivoCompleto(cierre.datosArchivados)) {
    const f = cierre.datosArchivados as ReporteFinanciero;
    return (
      <div style={{ maxWidth: 520 }}>
        <p style={{ margin: '0 0 8px', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Cierre anterior al archivo completo: solo conserva los totales.</p>
        <GSummaryRow first label="Ingresos" value={money(f.ingresos)} />
        <GSummaryRow label="Gastos" value={money(f.gastos)} tone="neg" />
        <GSummaryRow label="Ganancia neta" value={money(f.gananciaNeta)} strong />
      </div>
    );
  }
  const { analisis, liquidaciones } = cierre.datosArchivados;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, maxWidth: 900 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Resumen archivado</div>
        <GSummaryRow first label="Ingresos totales" value={money(analisis.ingresosTotales)} />
        <GSummaryRow label="Parte de especialistas" value={money(analisis.ganProfesionales)} />
        <GSummaryRow label="Ingresos del negocio" value={money(analisis.ingresosSalon)} />
        <GSummaryRow label="Egresos" value={money(analisis.egresos)} tone="neg" />
        <GSummaryRow label="Ganancia neta" value={money(analisis.gananciaNeta)} strong tone={analisis.gananciaNeta < 0 ? 'neg' : 'pos'} />
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Liquidación archivada</div>
        {liquidaciones.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Sin liquidación (partición por especialista inactiva en el período).</p>
        ) : (
          <>
            {liquidaciones.map((l, i) => (
              <GSummaryRow key={l.especialistaId} first={i === 0} label={l.nombre} sub={`Servicios ${money(l.comisionServicios)} · Productos ${money(l.comisionProductos)}`} value={money(l.neto)} />
            ))}
            <GSummaryRow label="Total liquidado" value={money(liquidaciones.reduce((s, l) => s + l.neto, 0))} strong />
          </>
        )}
      </div>
    </div>
  );
}
