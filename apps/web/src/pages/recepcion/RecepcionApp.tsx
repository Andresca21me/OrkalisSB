import { useEffect, useMemo, useState } from 'react';
import type { CitaAgenda } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useAuth } from '../../lib/auth';
import { accionCita, rangoDiaBogota, reasignarCita, useCitas, walkInVivo, type EventoCita } from '../../lib/useCitas';
import { fechaDesdeISO, hoyISO, money } from '../../lib/format';
import { Shell, PageHead, type NavItem } from '../../ui/Shell';
import { Button, Card, Dialog, EmptyState, ErrorState, Icon, Select, Spinner, useToast } from '../../ui/ui';
import {
  AppointmentRow,
  CobroModal,
  DayCounters,
  MiniCalendar,
  NuevaCitaModal,
  colorDe,
} from '../admin/agenda-ui';

const NAV: NavItem[] = [{ id: 'agenda', label: 'Agenda del día', icon: 'calendar' }];

interface Sucursal { id: string; nombre: string; activa: boolean }
interface Especialista {
  id: string;
  nombre: string;
  especialidad: string | null;
  activo: boolean;
  sucursalIds: string[];
  /** Vacío = realiza todos los servicios. */
  servicioIds: string[];
}

/** ¿Puede atender TODOS estos servicios? (sin lista declarada, los realiza todos). */
function realizaTodos(e: Especialista, servicioIds: string[]): boolean {
  return e.servicioIds.length === 0 || servicioIds.every((id) => e.servicioIds.includes(id));
}
interface ServicioOpt { id: string; nombre: string; precio: string; activo: boolean }

export function RecepcionApp() {
  return (
    <Shell nav={NAV} activo="agenda" onNav={() => {}}>
      <Tablero />
    </Shell>
  );
}

function Tablero() {
  const { usuario } = useAuth();
  const toast = useToast();
  const sucs = useApi<Sucursal[]>(() => api.get('/sucursales'));
  const equipo = useApi<Especialista[]>(() => api.get('/especialistas'));

  // Recepción opera por sucursal (no consolidado): acota a las del usuario.
  const sucursalesScope = useMemo(
    () => (sucs.data ?? []).filter((s) => !usuario?.sucursalIds || usuario.sucursalIds.includes(s.id)),
    [sucs.data, usuario?.sucursalIds],
  );
  const [sucursalId, setSucursalId] = useState<string | null>(null);
  useEffect(() => { if (!sucursalId && sucursalesScope.length) setSucursalId(sucursalesScope[0].id); }, [sucursalesScope, sucursalId]);

  const [dia, setDia] = useState(hoyISO());
  const { desde, hasta } = rangoDiaBogota(dia);
  const citas = useCitas({ desde, hasta, sucursalId });

  const [cobro, setCobro] = useState<CitaAgenda | null>(null);
  const [nueva, setNueva] = useState(false);
  const [walkin, setWalkin] = useState(false);
  const [reasignar, setReasignar] = useState<CitaAgenda | null>(null);

  const lista = useMemo(() => [...(citas.data ?? [])].sort((a, b) => a.inicio.localeCompare(b.inicio)), [citas.data]);
  const sucNombre = sucursalesScope.find((s) => s.id === sucursalId)?.nombre ?? 'Sucursal';

  function refrescar() { void citas.recargar(); }
  async function accion(c: CitaAgenda, ev: EventoCita) {
    try { await accionCita(c.id, ev); toast('Cita actualizada', 'success'); refrescar(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <div>
      <PageHead
        title="Recepción"
        desc={`Mostrador · ${sucNombre}`}
        action={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {sucursalesScope.length > 1 && (
              <Select value={sucursalId ?? ''} onChange={(e) => setSucursalId(e.target.value)} style={{ width: 200 }}>
                {sucursalesScope.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Select>
            )}
            <Button variant="secondary" iconLeft="plus" onClick={() => setWalkin(true)}>Walk-in</Button>
            <Button iconLeft="plus" onClick={() => setNueva(true)}>Nueva cita</Button>
          </div>
        }
      />

      <div className="ork-agenda-body">
        <div className="ork-aside" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <MiniCalendar selectedIso={dia} onPick={setDia} />
          <Card padding={16}>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 12 }}>Especialistas</span>
            {equipo.cargando ? <Spinner size={18} /> : (
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
                  <EmptyState icon="calendar-x" title="No hay citas para este día" desc="Cuando se reserve una cita o registres un walk-in aparecerá aquí." action={<Button iconLeft="plus" onClick={() => setWalkin(true)}>Registrar walk-in</Button>} />
                </Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {lista.map((c) => (
                    <AppointmentRow key={c.id} appt={c} showPrice onAccion={(ev) => void accion(c, ev)} onCobrar={() => setCobro(c)} onReasignar={() => setReasignar(c)} onRevertido={() => { toast("Cobro revertido", "info"); refrescar(); }} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {cobro && <CobroModal cita={cobro} onClose={() => setCobro(null)} onDone={() => { setCobro(null); toast('Turno completado · ganancias calculadas', 'success'); refrescar(); }} />}
      {nueva && <NuevaCitaModal sucursalId={sucursalId} fechaIso={dia} onClose={() => setNueva(false)} onDone={() => { setNueva(false); toast('Cita creada', 'success'); refrescar(); }} />}
      {walkin && <WalkinModal sucursalId={sucursalId} especialistas={equipo.data ?? []} onClose={() => setWalkin(false)} onDone={() => { setWalkin(false); toast('Walk-in iniciado', 'success'); refrescar(); }} />}
      {reasignar && <ReasignarDialog cita={reasignar} especialistas={equipo.data ?? []} onClose={() => setReasignar(null)} onDone={() => { setReasignar(null); toast('Cita reasignada', 'success'); refrescar(); }} />}
    </div>
  );
}

function ReasignarDialog({ cita, especialistas, onClose, onDone }: { cita: CitaAgenda; especialistas: Especialista[]; onClose: () => void; onDone: () => void }) {
  const [esp, setEsp] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Solo quien puede REALMENTE hacerse cargo: activo, de la misma sede y capaz de
  // realizar los servicios de la cita. Antes se ofrecía a todo el equipo y el
  // backend rechazaba (o peor, aceptaba a alguien de otra sede).
  const opciones = especialistas.filter(
    (e) =>
      e.id !== cita.especialistaId &&
      e.activo &&
      e.sucursalIds.includes(cita.sucursalId) &&
      realizaTodos(e, cita.servicioIds),
  );

  async function guardar() {
    if (!esp) return;
    setGuardando(true);
    setError(null);
    try {
      await reasignarCita(cita.id, esp);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} width={460} title="Reasignar especialista" subtitle={`${cita.clienteNombre ?? 'Cliente'} · actualmente con ${cita.especialistaNombre}`}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button iconLeft="repeat" disabled={!esp} loading={guardando} onClick={() => void guardar()}>Reasignar</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Nuevo especialista</label>
        <Select value={esp} onChange={(e) => setEsp(e.target.value)}>
          <option value="">Selecciona…</option>
          {opciones.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </Select>
        {opciones.length === 0 && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--error)', margin: 0 }}>
            Ningún otro especialista de esta sede puede atender los servicios de la cita.
          </p>
        )}
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="info" size={13} color="var(--text-tertiary)" />
          Si el destino ya tiene un turno en esa franja, no se permitirá (anti-solape).
        </p>
        {error && <p style={{ color: 'var(--error)', fontSize: 'var(--text-sm)', margin: '6px 0 0' }}>{error}</p>}
      </div>
    </Dialog>
  );
}

function WalkinModal({ sucursalId, especialistas, onClose, onDone }: { sucursalId: string | null; especialistas: Especialista[]; onClose: () => void; onDone: () => void }) {
  const servicios = useApi<ServicioOpt[]>(() => api.get('/servicios'), []);
  const [esp, setEsp] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activos = (servicios.data ?? []).filter((s) => s.activo);
  const total = activos.filter((s) => sel.includes(s.id)).reduce((a, s) => a + Number(s.precio), 0);
  const valido = !!sucursalId && !!esp && sel.length > 0;
  const toggle = (id: string) => setSel((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  // Este selector no filtraba por nada: mostraba a todo el equipo, incluso de
  // otras sedes. Ahora solo los de ESTA sede que realicen lo seleccionado.
  const espOpciones = especialistas.filter(
    (e) => e.activo && (!sucursalId || e.sucursalIds.includes(sucursalId)) && realizaTodos(e, sel),
  );
  const servicioPosible = (id: string): boolean =>
    sel.includes(id) ||
    especialistas.some(
      (e) => e.activo && (!sucursalId || e.sucursalIds.includes(sucursalId)) && realizaTodos(e, [...sel, id]),
    );

  async function guardar() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      await walkInVivo({ sucursalId: sucursalId!, especialistaId: esp, servicioIds: sel });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} width={520} title="Walk-in" subtitle="Atención sin reserva. Entra al tablero en progreso."
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button iconLeft="play" disabled={!valido} loading={guardando} onClick={() => void guardar()}>Iniciar atención{total ? ` · ${money(total)}` : ''}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>Especialista</span>
          <Select value={esp} onChange={(e) => setEsp(e.target.value)}>
            <option value="">Selecciona…</option>
            {espOpciones.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </Select>
        </label>
        <div>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Servicios</span>
          {servicios.cargando ? <Spinner size={18} /> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {activos.map((s) => {
                const on = sel.includes(s.id);
                const posible = servicioPosible(s.id);
                return (
                  <button key={s.id} type="button" disabled={!posible} title={posible ? undefined : 'Nadie de esta sede atiende esta combinación'} onClick={() => toggle(s.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 12px', cursor: posible ? 'pointer' : 'not-allowed', opacity: posible ? 1 : 0.45, borderRadius: 'var(--radius-sm)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, background: on ? 'var(--brand-tint)' : 'var(--surface-card)', color: on ? 'var(--brand)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {on && <Icon name="check" size={15} />}{s.nombre} · {money(s.precio)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {error && <p style={{ color: 'var(--error)', fontSize: 'var(--text-sm)', margin: 0 }}>{error}</p>}
      </div>
    </Dialog>
  );
}
