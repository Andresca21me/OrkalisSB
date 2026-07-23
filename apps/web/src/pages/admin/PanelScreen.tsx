import { useState } from 'react';
import type { CitaAgenda, PanelResumen } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useAuth } from '../../lib/auth';
import { useSucursal } from '../../lib/sucursal';
import { accionCita, rangoDiaBogota, useCitas, type EventoCita } from '../../lib/useCitas';
import { fechaLarga, hoyISO, money } from '../../lib/format';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, KpiCard, Spinner, useToast } from '../../ui';
import { AppointmentRow, CobroModal, NuevaCitaModal, horaCorta } from './agenda-ui';

interface AlertaStock { id: string; nombre: string; cantidad: number; stockMin: number }

function saludo(): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false }).format(new Date()));
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function PanelScreen({ onNav }: { onNav: (id: string) => void }) {
  const { usuario } = useAuth();
  const { consolidado, sucursalActivaId, sucursalActiva } = useSucursal();
  const toast = useToast();
  const hoy = hoyISO();
  const { desde, hasta } = rangoDiaBogota(hoy);

  const qs = sucursalActivaId ? `&sucursalId=${sucursalActivaId}` : '';
  const panel = useApi<PanelResumen>(() => api.get(`/reportes/panel?fecha=${hoy}${qs}`), [hoy, sucursalActivaId]);
  const citas = useCitas({ desde, hasta, sucursalId: sucursalActivaId });
  const alertas = useApi<AlertaStock[]>(() => api.get(`/inventario/alertas${sucursalActivaId ? `?sucursalId=${sucursalActivaId}` : ''}`), [sucursalActivaId]);

  const [cobro, setCobro] = useState<CitaAgenda | null>(null);
  const [nueva, setNueva] = useState(false);

  function refrescar() {
    void citas.recargar();
    void panel.recargar();
    void alertas.recargar();
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

  const scope = consolidado ? 'Todo el negocio' : (sucursalActiva?.nombre ?? 'Sucursal');
  const p = panel.data;
  const lista = citas.data ?? [];
  const deltaCitas = p ? p.citasHoy - p.citasAyer : 0;

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8, textTransform: 'capitalize' }}>{fechaLarga(new Date())}</div>
          <h1 style={{ fontSize: 'var(--text-3xl)', letterSpacing: '-0.02em', lineHeight: 1.08 }}>{saludo()}, {usuario?.nombre.split(' ')[0]}</h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', margin: '6px 0 0', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Icon name={consolidado ? 'layout-grid' : 'store'} size={16} color="var(--text-tertiary)" />
            Mostrando <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{scope}</strong>
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="ork-kpis" style={{ marginBottom: 22 }}>
        {panel.cargando || !p ? (
          [0, 1, 2, 3].map((i) => <KpiCard key={i} label="" loading />)
        ) : (
          <>
            <KpiCard label="Citas hoy" value={p.citasHoy} icon="calendar" trend={p.citasAyer ? { dir: deltaCitas >= 0 ? 'up' : 'down', value: `${Math.abs(deltaCitas)}` } : undefined} sub="vs. ayer" />
            <KpiCard label="Ingresos estimados de hoy" value={money(p.ingresosEstimadosHoy)} icon="dollar-sign" sub={`ticket prom. ${money(p.ticketPromedioHoy)}`} />
            <KpiCard label="Especialistas activos" value={`${p.especialistasDisponibles}/${p.especialistasTotal}`} icon="users" sub="disponibles" />
            <KpiCard label="Próxima cita" value={p.proximaCita ? horaCorta(p.proximaCita.inicio) : '—'} icon="clock" sub={p.proximaCita ? (p.proximaCita.clienteNombre?.split(' ')[0] ?? 'cliente') : 'nada pendiente'} />
          </>
        )}
      </div>

      {/* Principal + sidebar */}
      <div className="ork-main-aside">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Resumen financiero del mes */}
          {p && (
            <Card padding={18}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <span className="eyebrow" style={{ textTransform: 'capitalize' }}>Resumen del mes · {p.mes.etiqueta}</span>
                <Badge tone="accent" dot>En curso</Badge>
              </div>
              <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: '8px 0 16px' }}>{money(p.mes.ingresos)}</div>
              {[
                ['users', 'Ganancias de profesionales', p.mes.ganProfesionales],
                ['store', 'Ganancias del negocio', p.mes.ganSalon],
                ['package', 'Valor de productos', p.mes.valorProductos],
              ].map(([ic, label, val]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    <Icon name={ic} size={16} color="var(--text-tertiary)" />{label}
                  </span>
                  <span className="data" style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{money(val)}</span>
                </div>
              ))}
            </Card>
          )}

          {/* Citas de hoy */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <h2 style={{ fontSize: 'var(--text-lg)', letterSpacing: '-0.02em' }}>Citas de hoy</h2>
              {lista.length > 0 && <Button variant="ghost" size="sm" iconRight="arrow-right" onClick={() => onNav('agenda')}>Ver agenda</Button>}
            </div>
            {citas.cargando ? (
              <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>
            ) : citas.error ? (
              <ErrorState onRetry={citas.recargar} />
            ) : lista.length === 0 ? (
              <Card padding={0}>
                <EmptyState icon="calendar-x" title="No hay citas para hoy" desc={`Aún no hay citas en ${scope.toLowerCase()}. Crea la primera para empezar el día.`} action={<Button iconLeft="plus" onClick={() => setNueva(true)}>Nueva cita</Button>} />
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lista.map((c) => (
                  <AppointmentRow key={c.id} appt={c} onAccion={(ev) => void accion(c, ev)} onCobrar={() => setCobro(c)} onRevertido={() => { toast("Cobro revertido", "info"); refrescar(); }} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="ork-aside" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {(alertas.data?.length ?? 0) > 0 && (
            <Card padding={18}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <span className="eyebrow">Stock bajo</span>
                <Icon name="alert-triangle" size={16} color="var(--warning)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(alertas.data ?? []).map((pr, i) => (
                  <div key={pr.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.nombre}</span>
                    <Badge tone={pr.cantidad === 0 ? 'error' : 'warning'} dot>{pr.cantidad === 0 ? 'Agotado' : `${pr.cantidad} rest.`}</Badge>
                  </div>
                ))}
                <button type="button" onClick={() => onNav('inventario')} style={{ marginTop: 12, border: 'none', background: 'transparent', color: 'var(--brand)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: 0 }}>Ir a inventario →</button>
              </div>
            </Card>
          )}

          <Card padding={18}>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 14 }}>Acciones rápidas</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button fullWidth iconLeft="plus" onClick={() => setNueva(true)}>Nueva cita</Button>
              <Button variant="secondary" fullWidth iconLeft="users" onClick={() => onNav('clientes')}>Clientes</Button>
              <Button variant="secondary" fullWidth iconLeft="bar-chart-2" onClick={() => onNav('gastos')}>Finanzas</Button>
            </div>
          </Card>
        </aside>
      </div>

      {cobro && <CobroModal cita={cobro} onClose={() => setCobro(null)} onDone={() => { setCobro(null); toast('Turno completado · ganancias calculadas', 'success'); refrescar(); }} />}
      {nueva && <NuevaCitaModal sucursalId={sucursalActivaId} fechaIso={hoy} onClose={() => setNueva(false)} onDone={() => { setNueva(false); toast('Cita creada', 'success'); refrescar(); }} />}
    </div>
  );
}
