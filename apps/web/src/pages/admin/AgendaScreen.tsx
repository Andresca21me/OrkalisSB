import { useState } from 'react';
import type { CitaAgenda } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useSucursal } from '../../lib/sucursal';
import { accionCita, rangoDiaBogota, useCitas, type EventoCita } from '../../lib/useCitas';
import { fechaDesdeISO, hoyISO, money, sumarDiasISO } from '../../lib/format';
import { Button, Card, EmptyState, ErrorState, EstadoBadge, Icon, PageHead, Spinner, Tabs } from '../../ui';
import { AppointmentRow, CobroModal, DayCounters, MiniCalendar, NuevaCitaModal, colorDe, horaCorta } from './agenda-ui';
import { useToast } from '../../ui';

interface Especialista { id: string; nombre: string; especialidad: string | null }

export function AgendaScreen() {
  const { consolidado, sucursalActivaId, sucursalActiva } = useSucursal();
  const toast = useToast();
  const [tab, setTab] = useState('agenda');
  const [dia, setDia] = useState(hoyISO());
  const [cobro, setCobro] = useState<CitaAgenda | null>(null);
  const [nueva, setNueva] = useState(false);

  const { desde, hasta } = rangoDiaBogota(dia);
  const citas = useCitas({ desde, hasta, sucursalId: sucursalActivaId });
  const equipo = useApi<Especialista[]>(() => api.get('/especialistas'), []);

  // Historial: últimos 60 días hasta ayer.
  const histRango = { desde: rangoDiaBogota(sumarDiasISO(hoyISO(), -60)).desde, hasta: rangoDiaBogota(hoyISO()).desde };
  const historial = useCitas({ desde: histRango.desde, hasta: histRango.hasta, sucursalId: sucursalActivaId });

  const scope = consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal');
  const lista = citas.data ?? [];

  function refrescar() {
    void citas.recargar();
  }
  async function accion(c: CitaAgenda, ev: EventoCita) {
    try {
      await accionCita(c.id, ev);
      toast('Cita actualizada', 'success');
      refrescar();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <div>
      <PageHead
        title="Agenda"
        desc="Gestiona las citas de la sucursal y consulta el historial."
        action={<Button iconLeft="plus" onClick={() => setNueva(true)}>Nueva cita</Button>}
      />

      <div style={{ marginBottom: 22 }}>
        <Tabs tabs={[{ value: 'agenda', label: 'Agenda' }, { value: 'historial', label: 'Historial' }]} value={tab} onChange={setTab} />
      </div>

      {tab === 'agenda' ? (
        <div className="ork-agenda-body">
          <div className="ork-aside" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <MiniCalendar selectedIso={dia} onPick={setDia} />
            <Card padding={16}>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 12 }}>Especialistas</span>
              {equipo.cargando ? (
                <Spinner size={18} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(equipo.data ?? []).map((s) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: colorDe(s.id), flex: 'none' }} />
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nombre}</span>
                      {s.especialidad && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{s.especialidad}</span>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h2 style={{ fontSize: 'var(--text-lg)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>{fechaDesdeISO(dia)}</h2>

            {citas.error ? (
              <ErrorState onRetry={citas.recargar} />
            ) : (
              <>
                <DayCounters citas={lista} />
                {citas.cargando ? (
                  <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>
                ) : lista.length === 0 ? (
                  <Card padding={0}>
                    <EmptyState icon="calendar-x" title="No hay citas para este día" desc="Cuando agendes una cita aparecerá aquí, ordenada por hora." action={<Button iconLeft="plus" onClick={() => setNueva(true)}>Nueva cita</Button>} />
                  </Card>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {lista.map((c) => (
                      <AppointmentRow key={c.id} appt={c} showPrice onAccion={(ev) => void accion(c, ev)} onCobrar={() => setCobro(c)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 980 }}>
          <Card padding={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
              <Icon name="file-text" size={18} color="var(--text-tertiary)" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-base)' }}>Historial</span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>Últimos 60 días · {scope}</span>
            </div>
            <div style={{ padding: '4px 18px 14px' }}>
              {historial.cargando ? (
                <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>
              ) : historial.error ? (
                <ErrorState onRetry={historial.recargar} />
              ) : (historial.data ?? []).length === 0 ? (
                <EmptyState icon="file-text" title="Sin historial" desc="Las citas pasadas aparecerán aquí." compact />
              ) : (
                <ArchiveTable rows={historial.data ?? []} />
              )}
            </div>
          </Card>
        </div>
      )}

      {cobro && <CobroModal cita={cobro} onClose={() => setCobro(null)} onDone={() => { setCobro(null); toast('Turno completado · ganancias calculadas', 'success'); refrescar(); }} />}
      {nueva && <NuevaCitaModal sucursalId={sucursalActivaId} fechaIso={dia} onClose={() => setNueva(false)} onDone={() => { setNueva(false); toast('Cita creada', 'success'); refrescar(); }} />}
    </div>
  );
}

function ArchiveTable({ rows }: { rows: CitaAgenda[] }) {
  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '12px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)' };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
        <thead>
          <tr>
            <th style={th}>Fecha</th><th style={th}>Hora</th><th style={th}>Cliente</th><th style={th}>Servicios</th><th style={th}>Especialista</th><th style={{ ...th, textAlign: 'right' }}>Total</th><th style={{ ...th, textAlign: 'right' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => (
            <tr key={a.id} style={{ background: i % 2 ? 'var(--gray-50)' : 'transparent' }}>
              <td style={td}>{fechaDesdeISO(a.inicio.slice(0, 10))}</td>
              <td style={td}><span className="data" style={{ fontWeight: 600 }}>{horaCorta(a.inicio)}</span></td>
              <td style={td}>{a.clienteNombre ?? '—'}</td>
              <td style={{ ...td, color: 'var(--text-secondary)' }}>{a.servicios.map((s) => s.nombre).join(' · ') || '—'}</td>
              <td style={td}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: colorDe(a.especialistaId) }} />{a.especialistaNombre}</span></td>
              <td style={{ ...td, textAlign: 'right' }}><span className="data" style={{ fontWeight: 600 }}>{money(a.servicios.reduce((x, s) => x + Number(s.precio), 0) || Number(a.precioEst ?? 0))}</span></td>
              <td style={{ ...td, textAlign: 'right' }}><EstadoBadge estado={a.estado} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
