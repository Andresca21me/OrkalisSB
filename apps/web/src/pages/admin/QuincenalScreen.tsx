import { useMemo, useState } from 'react';
import { useSucursal } from '../../lib/sucursal';
import { fechaCorta, hoyISO, money } from '../../lib/format';
import { useAnalisis } from '../../lib/useReportes';
import { crearCierre, useCierres } from '../../lib/useCierres';
import { Button, Card, EmptyState, ErrorState, Icon, Spinner, useToast } from '../../ui/ui';
import { FinTile } from './finanzas-ui';
import { GConfirm, GSegmented } from './gestion-ui';
import { useVocabulario } from '../../lib/vocabulario';

type Quincena = 'primera' | 'segunda' | 'mes';

/** Rangos de quincena/mes en curso (zona Bogotá, UTC-5). */
function rangosQuincena(): Record<Quincena, { desde: string; hasta: string; label: string }> {
  const [y, m] = hoyISO().split('-').map(Number);
  const at = (day: number) => new Date(Date.UTC(y, m - 1, day, 5, 0, 0)).toISOString();
  const finMes = new Date(Date.UTC(y, m, 1, 4, 59, 59)).toISOString();
  const mesLabel = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(Date.UTC(y, m - 1, 15)));
  return {
    primera: { desde: at(1), hasta: new Date(Date.UTC(y, m - 1, 16, 4, 59, 59)).toISOString(), label: `1–15 ${mesLabel}` },
    segunda: { desde: at(16), hasta: finMes, label: `16–fin ${mesLabel}` },
    mes: { desde: at(1), hasta: finMes, label: `Mes completo · ${mesLabel}` },
  };
}

export function QuincenalScreen() {
  const voc = useVocabulario();
  const { consolidado, sucursalActiva, sucursalActivaId } = useSucursal();
  const toast = useToast();
  const [seg, setSeg] = useState<Quincena>('primera');
  const [cerrarOpen, setCerrarOpen] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  const rangos = useMemo(rangosQuincena, []);
  const r = rangos[seg];
  const a = useAnalisis(r.desde, r.hasta, sucursalActivaId);
  const cierres = useCierres();

  const scope = consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal');
  const d = a.data;

  function exportarCsv() {
    if (!d) return;
    const filas = [['concepto', 'valor'], ['Ingresos', d.ingresosTotales], [`Ingresos ${voc.negocio}`, d.ingresosSalon], ['Servicios', d.servicios], ['Ganancia neta', d.gananciaNeta]].map((x) => x.join(',')).join('\n');
    const blob = new Blob(['﻿' + filas + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `quincena-${seg}.csv`; link.click();
    URL.revokeObjectURL(url);
    toast(`${r.label} exportado (CSV)`, 'success');
  }

  async function cerrar() {
    if (cerrando) return;
    setCerrando(true);
    try {
      await crearCierre({ tipo: 'mensual', desde: rangos.mes.desde, hasta: rangos.mes.hasta, sucursalId: sucursalActivaId ?? undefined });
      setCerrarOpen(false);
      toast('Período cerrado y archivado', 'success');
      await cierres.recargar();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setCerrando(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{scope}</div>
          <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>Control quincenal</h1>
        </div>
        <Button variant="secondary" iconLeft="download" disabled={!d} onClick={exportarCsv}>Exportar CSV</Button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <GSegmented value={seg} onChange={(v) => setSeg(v as Quincena)} options={[{ value: 'primera', label: '1–15' }, { value: 'segunda', label: '16–fin' }, { value: 'mes', label: 'Mes completo' }]} />
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{r.label}</span>
      </div>

      {a.error ? (
        <ErrorState onRetry={a.recargar} />
      ) : (
        <div className="ork-kpis" style={{ marginBottom: 24 }}>
          <FinTile loading={a.cargando} label="Ingresos del período" icon="trending-up" value={money(d?.ingresosTotales ?? 0)} />
          <FinTile loading={a.cargando} label="Servicios realizados" icon="scissors" value={d?.servicios ?? 0} />
          <FinTile loading={a.cargando} label={`Ganancia ${voc.delNegocio}`} icon="wallet" value={money(d?.ingresosSalon ?? 0)} />
        </div>
      )}

      {/* Cierre mensual */}
      <Card padding={0} style={{ overflow: 'hidden', borderColor: 'rgba(245,158,11,0.35)', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', background: 'var(--warning-tint)', borderBottom: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="archive" size={18} color="#B45309" />
          <span style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: '#92400E' }}>Cierre mensual</span>
          <span style={{ fontSize: 'var(--text-sm)', color: '#B45309' }}>· zona de cuidado</span>
        </div>
        <div style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: '21px', maxWidth: 520 }}>
            Archiva un snapshot de los totales del mes en el histórico. No borra datos operativos; los movimientos siguen consultables.
          </p>
          <Button variant="danger" iconLeft="archive" onClick={() => setCerrarOpen(true)}>Cerrar mes completo</Button>
        </div>
      </Card>

      {/* Cierres archivados */}
      <h2 style={{ fontSize: 'var(--text-lg)', letterSpacing: '-0.01em', marginBottom: 14 }}>Períodos cerrados</h2>
      {cierres.cargando ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Spinner /></div>
      ) : cierres.error ? (
        <ErrorState onRetry={cierres.recargar} />
      ) : (cierres.data ?? []).length === 0 ? (
        <Card padding={0}><EmptyState compact icon="archive" title="Sin cierres" desc="Cuando cierres un período aparecerá archivado aquí." /></Card>
      ) : (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Período', 'Tipo', 'Ingresos', 'Ganancia neta', 'Cerrado'].map((h, i) => (
                <th key={h} style={{ textAlign: i >= 2 && i <= 3 ? 'right' : 'left', padding: '12px 16px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(cierres.data ?? []).map((c) => (
                <tr key={c.id}>
                  <td style={tdC}>{fechaCorta(c.desde)} – {fechaCorta(c.hasta)}</td>
                  <td style={{ ...tdC, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{c.tipo}</td>
                  <td style={{ ...tdC, textAlign: 'right' }}><span className="data">{money(c.datosArchivados.ingresos)}</span></td>
                  <td style={{ ...tdC, textAlign: 'right' }}><span className="data" style={{ fontWeight: 700 }}>{money(c.datosArchivados.gananciaNeta)}</span></td>
                  <td style={{ ...tdC, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{fechaCorta(c.creadoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <GConfirm open={cerrarOpen} danger title="Cerrar mes completo" confirmLabel="Sí, cerrar y archivar" confirmIcon="archive"
        desc={<span>Se archivará un snapshot de los totales de <strong style={{ color: 'var(--text-primary)' }}>{rangos.mes.label}</strong> en el histórico. No se borran datos operativos. Esta acción queda registrada.</span>}
        onClose={() => setCerrarOpen(false)} onConfirm={cerrar} />
    </div>
  );
}

const tdC: React.CSSProperties = { padding: '13px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)' };
