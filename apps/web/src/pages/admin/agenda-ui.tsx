import { useEffect, useMemo, useState } from 'react';
import { MetodoPago, type CitaAgenda } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { completarCita, crearCita, type EventoCita } from '../../lib/useCitas';
import { hoyISO, money } from '../../lib/format';
import { Badge, Button, Card, Dialog, EstadoBadge, Icon, IconButton, MenuItem, Popover, Select, StatTile } from '../../ui';

const PALETA = ['#1A73E8', '#00A88A', '#7C3AED', '#F59E0B', '#EF4444', '#0EA5E9', '#475569', '#DB2777'];
export function colorDe(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return PALETA[Math.abs(h) % PALETA.length];
}

const fmtHora = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false });
export function horaCorta(iso: string): string {
  return fmtHora.format(new Date(iso));
}
function durMin(c: CitaAgenda): number {
  return Math.round((new Date(c.fin).getTime() - new Date(c.inicio).getTime()) / 60000);
}
function totalCita(c: CitaAgenda): number {
  return c.servicios.reduce((a, s) => a + Number(s.precio), 0) || Number(c.precioEst ?? 0);
}

// ── Menú de acciones de una cita (transiciones reales) ───────────────────────
const TRANSICIONES: { estado: string; label: string; evento?: EventoCita; cobro?: boolean }[] = [
  { estado: 'confirmada', label: 'Confirmar', evento: 'aprobar' },
  { estado: 'en_progreso', label: 'Iniciar', evento: 'iniciar' },
  { estado: 'completada', label: 'Completar y cobrar', cobro: true },
  { estado: 'cancelada', label: 'Cancelar', evento: 'cancelar' },
  { estado: 'no_asistio', label: 'No asistió', evento: 'no-asistio' },
];

export function ApptActionsMenu({ appt, onAccion, onCobrar, onReasignar }: { appt: CitaAgenda; onAccion: (ev: EventoCita) => void; onCobrar: () => void; onReasignar?: () => void }) {
  const [open, setOpen] = useState(false);
  const reasignable = appt.estado === 'solicitada' || appt.estado === 'confirmada' || appt.estado === 'en_progreso';
  return (
    <div style={{ position: 'relative' }}>
      <IconButton name="more-vertical" title="Acciones" onClick={() => setOpen((o) => !o)} />
      <Popover open={open} onClose={() => setOpen(false)} align="right" width={220}>
        <div className="eyebrow" style={{ padding: '6px 10px 4px' }}>Cambiar estado</div>
        {TRANSICIONES.filter((t) => t.estado !== appt.estado).map((t) => (
          <MenuItem
            key={t.estado}
            onClick={() => {
              setOpen(false);
              if (t.cobro) onCobrar();
              else if (t.evento) onAccion(t.evento);
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <EstadoBadge estado={t.estado} />
            </span>
          </MenuItem>
        ))}
        {onReasignar && reasignable && (
          <>
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 4px' }} />
            <MenuItem icon="repeat" onClick={() => { setOpen(false); onReasignar(); }}>Reasignar especialista</MenuItem>
          </>
        )}
      </Popover>
    </div>
  );
}

// ── Fila de cita ─────────────────────────────────────────────────────────────
export function AppointmentRow({ appt, showPrice, onAccion, onCobrar, onReasignar }: { appt: CitaAgenda; showPrice?: boolean; onAccion: (ev: EventoCita) => void; onCobrar: () => void; onReasignar?: () => void }) {
  const dim = appt.estado === 'cancelada' || appt.estado === 'no_asistio';
  const color = colorDe(appt.especialistaId);
  return (
    <Card padding={0} testId={`appt-row-${appt.id}`} style={{ overflow: 'hidden', opacity: dim ? 0.72 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: 4, flex: 'none', background: color }} />
        <div style={{ flex: 1, minWidth: 0, padding: '14px 14px 14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 'none', width: 58 }}>
            <div className="data" style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)', lineHeight: 1.1 }}>{horaCorta(appt.inicio)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{durMin(appt)} min</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.clienteNombre ?? 'Sin cliente'}</span>
              {appt.origen === 'agendamiento_publico' && appt.estado === 'solicitada' && <Badge tone="brand">En línea</Badge>}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
              {appt.servicios.map((s) => s.nombre).join(' · ') || '—'}
              <span style={{ color: 'var(--border-strong)' }}>{'  ·  '}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: color, display: 'inline-block' }} />
                {appt.especialistaNombre}
              </span>
            </div>
          </div>
          {showPrice && <span className="data" style={{ flex: 'none', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{money(totalCita(appt))}</span>}
          <div style={{ flex: 'none', width: 116, display: 'flex', justifyContent: 'flex-end' }}><EstadoBadge estado={appt.estado} /></div>
          <div style={{ flex: 'none' }}>
            <ApptActionsMenu appt={appt} onAccion={onAccion} onCobrar={onCobrar} onReasignar={onReasignar} />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Contadores del día ───────────────────────────────────────────────────────
export function DayCounters({ citas }: { citas: CitaAgenda[] }) {
  const total = citas.length;
  const programadas = citas.filter((c) => c.estado === 'confirmada' || c.estado === 'solicitada' || c.estado === 'en_progreso').length;
  const completadas = citas.filter((c) => c.estado === 'completada').length;
  const ingresos = citas.filter((c) => c.estado === 'completada').reduce((a, c) => a + totalCita(c), 0);
  return (
    <div className="ork-kpis">
      <StatTile label="Total citas" value={total} icon="calendar" />
      <StatTile label="Programadas" value={programadas} icon="clock" />
      <StatTile label="Completadas" value={completadas} icon="check-circle" />
      <StatTile label="Ingresos" value={money(ingresos)} icon="dollar-sign" accent />
    </div>
  );
}

// ── Mini-calendario (mes en curso) ───────────────────────────────────────────
const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function MiniCalendar({ selectedIso, onPick }: { selectedIso: string; onPick: (iso: string) => void }) {
  const [y, m] = selectedIso.split('-').map(Number);
  const [mes, setMes] = useState({ y, m }); // m: 1..12
  const primero = new Date(Date.UTC(mes.y, mes.m - 1, 1));
  const firstDow = (primero.getUTCDay() + 6) % 7; // lunes=0
  const dias = new Date(Date.UTC(mes.y, mes.m, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= dias; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const hoy = hoyISO();
  const iso = (d: number) => `${mes.y}-${String(mes.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <Card padding={16} testId="mini-cal">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{MESES[mes.m - 1]} {mes.y}</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <IconButton name="chevron-left" title="Mes anterior" onClick={() => setMes((s) => (s.m === 1 ? { y: s.y - 1, m: 12 } : { y: s.y, m: s.m - 1 }))} />
          <IconButton name="chevron-right" title="Mes siguiente" onClick={() => setMes((s) => (s.m === 12 ? { y: s.y + 1, m: 1 } : { y: s.y, m: s.m + 1 }))} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
        {WD.map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>{w}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const k = iso(d);
          const isToday = k === hoy;
          const isSel = k === selectedIso;
          return (
            <button key={i} type="button" data-testid={`cal-dia-${k}`} onClick={() => onPick(k)} style={{ aspectRatio: '1', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: isSel ? 'var(--brand)' : isToday ? 'var(--brand-tint)' : 'transparent', color: isSel ? '#fff' : isToday ? 'var(--brand)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: isToday || isSel ? 700 : 500 }}>
              {d}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ── Modal de cobro (completar) ───────────────────────────────────────────────
const METODOS: { v: MetodoPago; l: string }[] = [
  { v: MetodoPago.Efectivo, l: 'Efectivo' },
  { v: MetodoPago.Tarjeta, l: 'Tarjeta' },
  { v: MetodoPago.Transferencia, l: 'Transferencia' },
  { v: MetodoPago.Nequi, l: 'Nequi' },
  { v: MetodoPago.Otro, l: 'Otro' },
];

export function CobroModal({ cita, onClose, onDone }: { cita: CitaAgenda; onClose: () => void; onDone: () => void }) {
  const [metodo, setMetodo] = useState<MetodoPago>(MetodoPago.Efectivo);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = totalCita(cita);

  async function completar() {
    setGuardando(true);
    setError(null);
    try {
      await completarCita(cita.id, { metodoPago: metodo });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Completar y cobrar" subtitle={`${cita.clienteNombre ?? 'Cliente'} · ${horaCorta(cita.inicio)}`} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button iconLeft="check" loading={guardando} onClick={() => void completar()}>Cobrar {money(total)}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {cita.servicios.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{s.nombre}</span>
            <span className="data" style={{ fontWeight: 600 }}>{money(s.precio)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 8, marginTop: 4 }}>
          <span style={{ fontWeight: 600 }}>Total</span>
          <span className="data" style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>{money(total)}</span>
        </div>
      </div>
      <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Método de pago</label>
      <Select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
        {METODOS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
      </Select>
      {error && <p style={{ color: 'var(--error)', fontSize: 'var(--text-sm)', marginTop: 12 }}>{error}</p>}
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 12 }}>El pago es obligatorio para cerrar el turno (guard de pago).</p>
    </Dialog>
  );
}

// ── Modal de nueva cita ──────────────────────────────────────────────────────
interface Opcion { id: string; nombre: string }
interface ServicioOpt { id: string; nombre: string; precio: string; duracionMin: number }

export function NuevaCitaModal({ sucursalId, fechaIso, onClose, onDone }: { sucursalId: string | null; fechaIso: string; onClose: () => void; onDone: () => void }) {
  const sucursales = useApi<(Opcion & { activa: boolean })[]>(() => api.get('/sucursales'), []);
  const especialistas = useApi<(Opcion & { sucursalIds?: string[] })[]>(() => api.get('/especialistas'), []);
  const clientes = useApi<Opcion[]>(() => api.get('/clientes'), []);
  const servicios = useApi<ServicioOpt[]>(() => api.get('/servicios'), []);

  const [suc, setSuc] = useState<string>(sucursalId ?? '');
  const [esp, setEsp] = useState('');
  const [cli, setCli] = useState('');
  const [servSel, setServSel] = useState<string[]>([]);
  const [fecha, setFecha] = useState(fechaIso);
  const [hora, setHora] = useState('10:00');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sucEfectiva = suc || sucursales.data?.[0]?.id || '';
  // Solo especialistas asignados a la sede elegida (HU-ADM-012): no ofrecer
  // opciones que el backend rechazaría por no pertenecer a la sucursal.
  const espOpciones = useMemo(
    () => (especialistas.data ?? []).filter((e) => !e.sucursalIds || !sucEfectiva || e.sucursalIds.includes(sucEfectiva)),
    [especialistas.data, sucEfectiva],
  );
  // Si la sede cambia y el especialista elegido ya no es válido, deselecciónalo.
  useEffect(() => {
    if (esp && !espOpciones.some((e) => e.id === esp)) setEsp('');
  }, [espOpciones, esp]);
  const total = useMemo(() => (servicios.data ?? []).filter((s) => servSel.includes(s.id)).reduce((a, s) => a + Number(s.precio), 0), [servicios.data, servSel]);
  const valido = sucEfectiva && esp && servSel.length > 0 && fecha && hora;

  function toggle(id: string) {
    setServSel((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  }

  async function guardar() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      const inicio = new Date(`${fecha}T${hora}:00-05:00`).toISOString();
      await crearCita({ sucursalId: sucEfectiva, especialistaId: esp, clienteId: cli || undefined, servicioIds: servSel, inicio });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Nueva cita" subtitle="Agenda un turno confirmado." width={560} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button iconLeft="check" disabled={!valido} loading={guardando} onClick={() => void guardar()}>Crear cita{total ? ` · ${money(total)}` : ''}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(sucursales.data?.length ?? 0) > 1 && (
          <Field label="Sucursal">
            <Select value={sucEfectiva} onChange={(e) => setSuc(e.target.value)}>
              {(sucursales.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Especialista">
          <Select value={esp} onChange={(e) => setEsp(e.target.value)}>
            <option value="">Selecciona…</option>
            {espOpciones.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </Select>
        </Field>
        <Field label="Cliente (opcional)">
          <Select value={cli} onChange={(e) => setCli(e.target.value)}>
            <option value="">Sin cliente</option>
            {(clientes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
        </Field>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 8 }}>Servicios</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(servicios.data ?? []).map((s) => {
              const on = servSel.includes(s.id);
              return (
                <button key={s.id} type="button" onClick={() => toggle(s.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 12px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, background: on ? 'var(--brand-tint)' : 'var(--surface-card)', color: on ? 'var(--brand)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  {on && <Icon name="check" size={15} />}
                  {s.nombre} · {money(s.precio)}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Field label="Fecha" style={{ flex: 1 }}>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputCss} />
          </Field>
          <Field label="Hora" style={{ flex: 1 }}>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={inputCss} />
          </Field>
        </div>
        {error && <p style={{ color: 'var(--error)', fontSize: 'var(--text-sm)', margin: 0 }}>{error}</p>}
      </div>
    </Dialog>
  );
}

const inputCss: React.CSSProperties = { width: '100%', height: 44, padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', outline: 'none', boxSizing: 'border-box' };

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'block', ...style }}>
      <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</span>
      {children}
    </label>
  );
}
