import { useEffect, useMemo, useState } from 'react';
import type { CitaAgenda } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { completarCita, crearCita, revertirCita, type EventoCita, type PagoLinea } from '../../lib/useCitas';
import { hoyISO, money } from '../../lib/format';
import { PagoSplit, pagoInicial, sumaPagos } from '../../ui/PagoSplit';
import { Badge, Button, Card, Dialog, EstadoBadge, Icon, IconButton, MenuItem, Popover, ProductosVenta, Select, Spinner, StatTile, useToast, type LineaProducto } from '../../ui';

const PALETA = ['#2563EB', '#059669', '#7C3AED', '#EA580C', '#0EA5E9', '#E11D48', '#64748B', '#D97706'];
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
  // Completadas: el TICKET REAL (servicios + productos + tarifa), congelado en
  // la atención. El estimado de catálogo queda solo para citas sin cobrar.
  return c.cobro?.total ?? (c.servicios.reduce((a, s) => a + Number(s.precio), 0) || Number(c.precioEst ?? 0));
}

// ── Menú de acciones de una cita (transiciones reales) ───────────────────────
const TRANSICIONES: { estado: string; label: string; evento?: EventoCita; cobro?: boolean }[] = [
  { estado: 'confirmada', label: 'Confirmar', evento: 'aprobar' },
  { estado: 'en_progreso', label: 'Iniciar', evento: 'iniciar' },
  { estado: 'completada', label: 'Completar y cobrar', cobro: true },
  { estado: 'cancelada', label: 'Cancelar', evento: 'cancelar' },
  { estado: 'no_asistio', label: 'No asistió', evento: 'no-asistio' },
];

export function ApptActionsMenu({ appt, onAccion, onCobrar, onReasignar, onRevertido, onDesglose }: { appt: CitaAgenda; onAccion: (ev: EventoCita) => void; onCobrar: () => void; onReasignar?: () => void; onRevertido?: () => void; onDesglose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmRev, setConfirmRev] = useState(false);
  const [reponer, setReponer] = useState(true);
  const [revirtiendo, setRevirtiendo] = useState(false);
  const [errRev, setErrRev] = useState<string | null>(null);
  const reasignable = appt.estado === 'solicitada' || appt.estado === 'confirmada' || appt.estado === 'en_progreso';
  // Desde 'completada' la máquina de estados solo admite revertir: se ofrece esa
  // acción dedicada en lugar de las transiciones de estado (que fallarían).
  const completada = appt.estado === 'completada';

  const toast = useToast();

  async function revertir() {
    setRevirtiendo(true);
    setErrRev(null);
    try {
      const r = (await revertirCita(appt.id, reponer)) as { advertencia?: string | null } | undefined;
      setConfirmRev(false);
      // D6 (Plan-Finanzas): el cobro era de un período ya cerrado — se permite,
      // pero el admin debe saber que el archivo del cierre quedó desfasado.
      if (r?.advertencia) toast(r.advertencia, 'warning');
      onRevertido?.();
    } catch (e) {
      setErrRev((e as Error).message);
    } finally {
      setRevirtiendo(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <IconButton name="more-vertical" title="Acciones" onClick={() => setOpen((o) => !o)} />
      <Popover open={open} onClose={() => setOpen(false)} align="right" width={220}>
        {completada ? (
          <>
            {onDesglose && <MenuItem icon="bar-chart-2" onClick={() => { setOpen(false); onDesglose(); }}>Ver desglose</MenuItem>}
            <MenuItem icon="rotate-ccw" onClick={() => { setOpen(false); setConfirmRev(true); }}>Revertir cobro</MenuItem>
          </>
        ) : (
          <>
            <div className="eyebrow" style={{ padding: '6px 10px 4px' }}>Cambiar estado</div>
            {TRANSICIONES.filter((t) => t.estado !== appt.estado && t.estado !== 'completada').map((t) => (
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
            {appt.estado === 'en_progreso' && (
              <MenuItem icon="check" onClick={() => { setOpen(false); onCobrar(); }}>Completar y cobrar</MenuItem>
            )}
            {onReasignar && reasignable && (
              <>
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 4px' }} />
                <MenuItem icon="repeat" onClick={() => { setOpen(false); onReasignar(); }}>Reasignar especialista</MenuItem>
              </>
            )}
          </>
        )}
      </Popover>

      {confirmRev && (
        <Dialog open onClose={() => setConfirmRev(false)} width={440} title="Revertir cobro" subtitle={`${appt.clienteNombre ?? 'Cliente'} · ${horaCorta(appt.inicio)}`}
          footer={<><Button variant="secondary" onClick={() => setConfirmRev(false)}>Cancelar</Button><Button variant="danger" loading={revirtiendo} onClick={() => void revertir()}>Sí, revertir</Button></>}>
          <p style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: '20px' }}>Esto deshace las ganancias calculadas. El turno volverá a quedar pendiente de cobro.</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
            <input type="checkbox" checked={reponer} onChange={(e) => setReponer(e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Reingresar al inventario los productos vendidos, si los hubo.</span>
          </label>
          {errRev && <p style={{ color: 'var(--error)', fontSize: 'var(--text-sm)', marginTop: 10 }}>{errRev}</p>}
        </Dialog>
      )}
    </div>
  );
}

// ── Fila de cita ─────────────────────────────────────────────────────────────
export function AppointmentRow({ appt, showPrice, onAccion, onCobrar, onReasignar, onRevertido, onDesglose }: { appt: CitaAgenda; showPrice?: boolean; onAccion: (ev: EventoCita) => void; onCobrar: () => void; onReasignar?: () => void; onRevertido?: () => void; onDesglose?: () => void }) {
  const dim = appt.estado === 'cancelada' || appt.estado === 'no_asistio';
  const color = colorDe(appt.especialistaId);
  return (
    <Card padding={0} testId={`appt-row-${appt.id}`} style={{ overflow: 'hidden', opacity: dim ? 0.72 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: 4, flex: 'none', background: color }} />
        <div className="ork-appt-row" style={{ flex: 1, minWidth: 0, padding: '14px 14px 14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 'none', width: 58 }}>
            <div className="data" style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)', lineHeight: 1.1 }}>{horaCorta(appt.inicio)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{durMin(appt)} min</div>
          </div>
          <div className="ork-appt-main" style={{ flex: 1, minWidth: 0 }}>
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
          {showPrice && (
            <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {(appt.cobro?.numProductos ?? 0) > 0 && (
                <span title={`Incluye ${appt.cobro!.numProductos} producto(s) por ${money(appt.cobro!.totalProductos)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                  <Icon name="package" size={13} color="var(--text-tertiary)" />{appt.cobro!.numProductos}
                </span>
              )}
              <span className="data" style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{money(totalCita(appt))}</span>
            </span>
          )}
          <div className="ork-appt-estado" style={{ flex: 'none', width: 116, display: 'flex', justifyContent: 'flex-end' }}><EstadoBadge estado={appt.estado} /></div>
          <div style={{ flex: 'none' }}>
            <ApptActionsMenu appt={appt} onAccion={onAccion} onCobrar={onCobrar} onReasignar={onReasignar} onRevertido={onRevertido} onDesglose={onDesglose} />
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
export function CobroModal({ cita, onClose, onDone }: { cita: CitaAgenda; onClose: () => void; onDone: () => void }) {
  const totalServicios = totalCita(cita);
  const [productos, setProductos] = useState<LineaProducto[]>([]);
  const [subtotalProd, setSubtotalProd] = useState(0);
  const total = totalServicios + subtotalProd;
  const [lineas, setLineas] = useState<PagoLinea[]>(() => pagoInicial(totalServicios));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cuadra = sumaPagos(lineas) === Math.round(total);

  // Al cambiar el total (por productos) se reinicia el reparto para que sume el nuevo total.
  useEffect(() => { setLineas(pagoInicial(total)); }, [total]);

  async function completar() {
    if (!cuadra) { setError(`Los métodos deben sumar ${money(total)}.`); return; }
    setGuardando(true);
    setError(null);
    try {
      await completarCita(cita.id, { pagos: lineas, productos: productos.length ? productos : undefined });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Completar y cobrar" subtitle={`${cita.clienteNombre ?? 'Cliente'} · ${horaCorta(cita.inicio)}`} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button iconLeft="check" loading={guardando} disabled={!cuadra} onClick={() => void completar()}>Cobrar {money(total)}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {cita.servicios.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{s.nombre}</span>
            <span className="data" style={{ fontWeight: 600 }}>{money(s.precio)}</span>
          </div>
        ))}
        {subtotalProd > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Productos</span>
            <span className="data" style={{ fontWeight: 600 }}>{money(subtotalProd)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 8, marginTop: 4 }}>
          <span style={{ fontWeight: 600 }}>Total</span>
          <span className="data" style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>{money(total)}</span>
        </div>
      </div>
      <ProductosVenta sucursalId={cita.sucursalId} lineas={productos} onChange={setProductos} onSubtotalChange={setSubtotalProd} />
      <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 8 }}>Método de pago <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>· puedes dividirlo</span></label>
      <PagoSplit total={total} lineas={lineas} onChange={setLineas} sucursalId={cita.sucursalId} />
      {error && <p style={{ color: 'var(--error)', fontSize: 'var(--text-sm)', marginTop: 12 }}>{error}</p>}
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 12 }}>El pago es obligatorio para cerrar el turno (guard de pago).</p>
    </Dialog>
  );
}

// ── Modal de nueva cita ──────────────────────────────────────────────────────
interface Opcion { id: string; nombre: string }
interface ClienteOpt { id: string; nombre: string; telefono: string | null }
interface ServicioOpt { id: string; nombre: string; precio: string; duracionMin: number }

const soloDigitos = (s: string) => s.replace(/\D/g, '');

export function NuevaCitaModal({ sucursalId, fechaIso, onClose, onDone }: { sucursalId: string | null; fechaIso: string; onClose: () => void; onDone: () => void }) {
  const sucursales = useApi<(Opcion & { activa: boolean })[]>(() => api.get('/sucursales'), []);
  const especialistas = useApi<(Opcion & { activo?: boolean; sucursalIds?: string[]; servicioIds?: string[] })[]>(() => api.get('/especialistas'), []);
  const clientes = useApi<ClienteOpt[]>(() => api.get('/clientes'), []);
  const servicios = useApi<ServicioOpt[]>(() => api.get('/servicios'), []);

  const [suc, setSuc] = useState<string>(sucursalId ?? '');
  const [esp, setEsp] = useState('');
  const [cli, setCli] = useState(''); // id de cliente existente elegido de las sugerencias
  const [cliNombre, setCliNombre] = useState('');
  const [cliTel, setCliTel] = useState('');
  const [cliFoco, setCliFoco] = useState(false);
  const [servSel, setServSel] = useState<string[]>([]);
  const [fecha, setFecha] = useState(fechaIso);
  const [franja, setFranja] = useState(''); // ISO de inicio de la franja elegida
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sucEfectiva = suc || sucursales.data?.[0]?.id || '';
  // `/especialistas` incluye los dados de baja (historial); aquí solo se agenda
  // con los vigentes.
  const espVigentes = useMemo(() => (especialistas.data ?? []).filter((e) => e.activo !== false), [especialistas.data]);
  // Solo especialistas asignados a la sede elegida (HU-ADM-012): no ofrecer
  // opciones que el backend rechazaría por no pertenecer a la sucursal.
  // Y que además realicen TODOS los servicios elegidos (sin lista declarada, los
  // realiza todos). El backend valida lo mismo; esto evita ofrecer lo imposible.
  const espOpciones = useMemo(
    () =>
      espVigentes
        .filter((e) => !e.sucursalIds || !sucEfectiva || e.sucursalIds.includes(sucEfectiva))
        .filter((e) => servSel.length === 0 || !e.servicioIds?.length || servSel.every((sid) => e.servicioIds!.includes(sid))),
    [espVigentes, sucEfectiva, servSel],
  );

  /** ¿Se puede sumar este servicio sin dejar la selección sin nadie que la atienda? */
  const servicioPosible = (id: string): boolean => {
    if (servSel.includes(id)) return true;
    const combo = [...servSel, id];
    return espVigentes.some(
      (e) =>
        (!e.sucursalIds || !sucEfectiva || e.sucursalIds.includes(sucEfectiva)) &&
        (!e.servicioIds?.length || combo.every((sid) => e.servicioIds!.includes(sid))),
    );
  };
  // Si la sede cambia y el especialista elegido ya no es válido, deselecciónalo.
  useEffect(() => {
    if (esp && !espOpciones.some((e) => e.id === esp)) setEsp('');
  }, [espOpciones, esp]);
  const total = useMemo(() => (servicios.data ?? []).filter((s) => servSel.includes(s.id)).reduce((a, s) => a + Number(s.precio), 0), [servicios.data, servSel]);

  // Franjas libres reales del especialista (mismo cálculo que la reserva pública).
  const listoParaFranjas = Boolean(sucEfectiva && esp && servSel.length > 0 && fecha);
  const servKey = [...servSel].sort().join(',');
  const disp = useApi<{ inicio: string; fin: string }[]>(
    () =>
      listoParaFranjas
        ? api.get(`/citas/disponibilidad?sucursalId=${sucEfectiva}&especialistaId=${esp}&servicios=${servKey}&fecha=${fecha}`)
        : Promise.resolve([]),
    [sucEfectiva, esp, servKey, fecha, listoParaFranjas],
  );
  const franjas = disp.data ?? [];
  // Si cambian los datos y la franja elegida ya no está libre, deselecciónala.
  useEffect(() => {
    if (franja && !franjas.some((f) => f.inicio === franja)) setFranja('');
  }, [franjas, franja]);

  // El mismo campo de nombre sugiere clientes existentes por nombre o celular.
  const sugerencias = useMemo(() => {
    const q = cliNombre.trim().toLowerCase();
    const qTel = soloDigitos(cliNombre);
    if (q.length < 2) return [];
    return (clientes.data ?? [])
      .filter((c) => c.nombre.toLowerCase().includes(q) || (qTel.length >= 3 && soloDigitos(c.telefono ?? '').includes(qTel)))
      .slice(0, 6);
  }, [clientes.data, cliNombre]);

  const nombreCli = cliNombre.trim();
  const telDigitos = soloDigitos(cliTel);
  // Cliente nuevo: nombre escrito sin elegir sugerencia → exige celular para registrarlo.
  const clienteNuevo = !cli && nombreCli.length >= 2;
  const clienteOk = !nombreCli || Boolean(cli) || (nombreCli.length >= 2 && telDigitos.length >= 7);
  const valido = sucEfectiva && esp && servSel.length > 0 && fecha && franja && clienteOk;

  function toggle(id: string) {
    setServSel((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  }

  async function guardar() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      let clienteId = cli || undefined;
      if (!clienteId && clienteNuevo) {
        // Dedupe por celular: si ya existe un cliente con ese número, se enlaza en vez de duplicar.
        const porTel = (clientes.data ?? []).find((c) => soloDigitos(c.telefono ?? '') === telDigitos);
        if (porTel) clienteId = porTel.id;
        else clienteId = (await api.post<ClienteOpt>('/clientes', { nombre: nombreCli, telefono: telDigitos })).id;
      }
      await crearCita({ sucursalId: sucEfectiva, especialistaId: esp, clienteId, servicioIds: servSel, inicio: franja });
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
        <div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Cliente (opcional)" style={{ flex: 1.5, minWidth: 0 }}>
              <div style={{ position: 'relative' }}>
                <input
                  value={cliNombre}
                  onChange={(e) => {
                    // Al editar tras elegir una sugerencia se desenlaza (y se limpia su celular).
                    if (cli) { setCli(''); setCliTel(''); }
                    setCliNombre(e.target.value);
                  }}
                  onFocus={() => setCliFoco(true)}
                  onBlur={() => setTimeout(() => setCliFoco(false), 150)}
                  placeholder="Nombre del cliente"
                  style={inputCss}
                />
                {cli && <Icon name="check" size={16} color="var(--success, #059669)" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />}
                {cliFoco && !cli && sugerencias.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4, maxHeight: 236, overflowY: 'auto', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                    {sugerencias.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setCli(c.id); setCliNombre(c.nombre); setCliTel(c.telefono ?? ''); setCliFoco(false); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}
                      >
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                        <span className="data" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flex: 'none' }}>{c.telefono ?? 'sin celular'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            <Field label="Celular" style={{ flex: 1, minWidth: 0 }}>
              <input
                value={cliTel}
                onChange={(e) => setCliTel(e.target.value)}
                disabled={Boolean(cli)}
                placeholder="311 845 2210"
                inputMode="tel"
                style={{ ...inputCss, ...(cli ? { background: 'var(--gray-50)', color: 'var(--text-tertiary)' } : {}) }}
              />
            </Field>
          </div>
          {cli ? (
            <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Cliente existente · la cita quedará en su historial.</p>
          ) : clienteNuevo ? (
            telDigitos.length >= 7 ? (
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Se registrará automáticamente como cliente nuevo.</p>
            ) : (
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--warning, #D97706)' }}>Escribe su celular (mín. 7 dígitos) para registrarlo como cliente nuevo.</p>
            )
          ) : null}
        </div>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 8 }}>Servicios</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(servicios.data ?? []).map((s) => {
              const on = servSel.includes(s.id);
              const posible = servicioPosible(s.id);
              return (
                <button key={s.id} type="button" disabled={!posible} title={posible ? undefined : 'Nadie de esta sede atiende esta combinación'} onClick={() => toggle(s.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 12px', cursor: posible ? 'pointer' : 'not-allowed', opacity: posible ? 1 : 0.45, borderRadius: 'var(--radius-sm)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, background: on ? 'var(--brand-tint)' : 'var(--surface-card)', color: on ? 'var(--brand)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  {on && <Icon name="check" size={15} />}
                  {s.nombre} · {money(s.precio)}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Fecha">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputCss} />
        </Field>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 8 }}>
            Hora <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>· disponibilidad real del especialista</span>
          </label>
          {!listoParaFranjas ? (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Elige especialista y servicios para ver las horas libres.</p>
          ) : disp.cargando ? (
            <div style={{ display: 'grid', placeItems: 'center', padding: 16 }}><Spinner size={20} /></div>
          ) : disp.error ? (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--error)' }}>No pudimos cargar la disponibilidad. Cambia la fecha o vuelve a intentar.</p>
          ) : franjas.length === 0 ? (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>El especialista no tiene horas libres ese día. Prueba otra fecha u otro especialista.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 8, maxHeight: 176, overflowY: 'auto', paddingRight: 2 }}>
              {franjas.map((f) => {
                const on = franja === f.inicio;
                return (
                  <button key={f.inicio} type="button" data-testid={`franja-${horaCorta(f.inicio)}`} onClick={() => setFranja(f.inicio)} className="data" style={{ height: 42, borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, background: on ? 'var(--brand)' : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-primary)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {horaCorta(f.inicio)}
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

const inputCss: React.CSSProperties = { width: '100%', height: 44, padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', outline: 'none', boxSizing: 'border-box' };

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'block', ...style }}>
      <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</span>
      {children}
    </label>
  );
}
