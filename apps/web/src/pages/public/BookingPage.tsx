import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  CitaPublica,
  ConfirmarResp,
  FranjaPublica,
  OtpResp,
  PublicEspecialista,
  PublicInfo,
  PublicServicio,
  RetencionResp,
} from '@orkalis/shared';
import { api, ApiError, urlFotoEspecialista } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { applyVertical, normalizeVertical } from '../../lib/theme';
import { hoyISO, money, sumarDiasISO } from '../../lib/format';
import {
  AppHeader,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  EstadoBadge,
  FooterBar,
  Icon,
  MobileFrame,
  ProgressBar,
  ScrollArea,
  Spinner,
  useToast,
} from '../../ui';

type Step = 'inicio' | 'servicios' | 'especialista' | 'horario' | 'identificacion' | 'confirmacion' | 'gestion';
const PASOS = ['servicios', 'especialista', 'horario', 'identificacion'];

const DOW = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function diaParts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return { key: iso, dow: DOW[dt.getUTCDay()], day: d, month: MON[m - 1], isToday: iso === hoyISO() };
}
function etiquetaDia(iso: string) {
  const p = diaParts(iso);
  const DOWL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return `${p.isToday ? 'Hoy · ' : ''}${DOWL[dt.getUTCDay()]} ${d} de ${MON[m - 1]}`;
}
const fmtHora = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false });
function horaCorta(iso: string) {
  return fmtHora.format(new Date(iso));
}
function horaBogota(iso: string) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false }).format(new Date(iso)));
}

export function BookingPage() {
  const { sucursalId = '' } = useParams();
  const toast = useToast();

  const [step, setStep] = useState<Step>('inicio');
  const [servicios, setServicios] = useState<string[]>([]);
  const [especialistaId, setEspecialistaId] = useState<string | null>(null); // uuid | 'any'
  const [fecha, setFecha] = useState<string | null>(null);
  const [slot, setSlot] = useState<FranjaPublica | null>(null);
  const [contacto, setContacto] = useState({ nombre: '', telefono: '' });
  const [retencionId, setRetencionId] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [appointment, setAppointment] = useState<CitaPublica | null>(null);
  const [reagendando, setReagendando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const info = useApi<PublicInfo>(() => api.get(`/public/${sucursalId}/info`, false), [sucursalId]);
  // La reserva pública adopta el tema del negocio que se reserva (un salón se
  // ve en rosa aunque el visitante no tenga sesión).
  useEffect(() => {
    if (info.data) applyVertical(normalizeVertical(info.data.perfil));
  }, [info.data]);
  const catalogo = useApi<PublicServicio[]>(() => api.get(`/public/${sucursalId}/servicios`, false), [sucursalId]);
  const equipo = useApi<PublicEspecialista[]>(() => api.get(`/public/${sucursalId}/especialistas`, false), [sucursalId]);

  const resumen = useMemo(() => {
    const elegidos = (catalogo.data ?? []).filter((s) => servicios.includes(s.id));
    const total = elegidos.reduce((a, s) => a + Number(s.precio), 0);
    const totalMin = elegidos.reduce((a, s) => a + s.duracionMin, 0);
    const espNombre =
      especialistaId === 'any'
        ? 'Cualquiera disponible'
        : (equipo.data ?? []).find((e) => e.id === especialistaId)?.nombre ?? '—';
    return { elegidos, total, totalMin, espNombre };
  }, [catalogo.data, equipo.data, servicios, especialistaId]);

  function toggleServicio(id: string) {
    setServicios((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  }

  function resetFlow() {
    setStep('inicio');
    setServicios([]);
    setEspecialistaId(null);
    setFecha(null);
    setSlot(null);
    setContacto({ nombre: '', telefono: '' });
    setRetencionId(null);
    setAppointment(null);
    setReagendando(false);
  }

  // Retiene la franja y envía el OTP justo antes de identificar. Recibe el
  // teléfono por parámetro: el estado `contacto` puede no estar actualizado aún
  // en el mismo tick del envío (setContacto es asíncrono).
  async function retenerYEnviar(telefono: string): Promise<boolean> {
    if (!slot) return false;
    try {
      const r = await api.post<RetencionResp>(`/public/${sucursalId}/retener`, { especialistaId: slot.especialistaId, inicio: slot.inicio, fin: slot.fin }, false);
      setRetencionId(r.retencionId);
      const otp = await api.post<OtpResp>(`/public/${sucursalId}/otp/enviar`, { telefono }, false);
      setDevCode(otp.devCode);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast('Esa hora la acaban de reservar. Elige otra.', 'error');
        setSlot(null);
        setStep('horario');
      } else {
        toast((e as Error).message, 'error');
      }
      return false;
    }
  }

  async function confirmar(codigoOtp: string) {
    if (!retencionId) return;
    setEnviando(true);
    try {
      // Reagendar = cancelar la anterior antes de crear la nueva.
      if (reagendando && appointment) {
        await api.post(`/public/${sucursalId}/cita/${appointment.id}/cancelar`, undefined, false);
      }
      const r = await api.post<ConfirmarResp>(
        `/public/${sucursalId}/confirmar`,
        { retencionId, telefono: contacto.telefono, nombre: contacto.nombre, codigoOtp, servicioIds: servicios },
        false,
      );
      const detalle = await api.get<CitaPublica>(`/public/${sucursalId}/cita/${r.citaId}`, false);
      setAppointment(detalle);
      setReagendando(false);
      setStep('confirmacion');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast('Esa hora la acaban de reservar. Elige otra.', 'error');
        setSlot(null);
        setStep('horario');
      } else if (e instanceof ApiError && (e.status === 400 || e.status === 401)) {
        toast('Código incorrecto. Inténtalo de nuevo.', 'error');
      } else {
        toast((e as Error).message, 'error');
      }
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar() {
    if (!appointment) return;
    try {
      await api.post(`/public/${sucursalId}/cita/${appointment.id}/cancelar`, undefined, false);
      const detalle = await api.get<CitaPublica>(`/public/${sucursalId}/cita/${appointment.id}`, false);
      setAppointment(detalle);
      toast('Tu cita fue cancelada', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  function reagendar() {
    setReagendando(true);
    setSlot(null);
    setStep('horario');
    toast('Elige tu nuevo horario', 'info');
  }

  // ── Estados globales de carga/error de la sucursal ──
  if (info.cargando) {
    return (
      <MobileFrame>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <Spinner size={28} />
        </div>
      </MobileFrame>
    );
  }
  if (info.error || !info.data) {
    return (
      <MobileFrame>
        <ScrollArea>
          <ErrorState onRetry={info.recargar} title="No pudimos abrir la reserva" desc="Revisa el enlace o tu conexión e inténtalo de nuevo." />
        </ScrollArea>
      </MobileFrame>
    );
  }

  const negocio = info.data.negocioNombre;

  return (
    <MobileFrame>
      {step === 'inicio' && (
        <Inicio
          info={info.data}
          servicios={catalogo}
          onReservar={() => setStep('servicios')}
          onGestionar={() => { setAppointment(null); setStep('gestion'); }}
        />
      )}

      {step === 'servicios' && (
        <Servicios
          negocio={negocio}
          catalogo={catalogo}
          seleccion={servicios}
          onToggle={toggleServicio}
          resumen={resumen}
          onBack={() => setStep('inicio')}
          onContinue={() => setStep('especialista')}
        />
      )}

      {step === 'especialista' && (
        <Especialistas
          negocio={negocio}
          equipo={equipo}
          value={especialistaId}
          onPick={setEspecialistaId}
          onBack={() => setStep('servicios')}
          onContinue={() => setStep('horario')}
        />
      )}

      {step === 'horario' && (
        <Horario
          sucursalId={sucursalId}
          negocio={negocio}
          servicios={servicios}
          especialistaId={especialistaId!}
          fecha={fecha}
          slot={slot}
          diasLaborables={info.data.diasLaborables}
          serviciosDia={info.data.serviciosDia}
          onPickFecha={(f) => { setFecha(f); setSlot(null); }}
          onPickSlot={setSlot}
          onBack={() => setStep(reagendando ? 'gestion' : 'especialista')}
          onContinue={() => setStep('identificacion')}
        />
      )}

      {step === 'identificacion' && (
        <Identificacion
          negocio={negocio}
          contacto={contacto}
          onChange={setContacto}
          devCode={devCode}
          onEnviar={retenerYEnviar}
          onVerificar={(code) => confirmar(code)}
          enviando={enviando}
          onBack={() => setStep('horario')}
        />
      )}

      {step === 'confirmacion' && appointment && (
        <Resultado info={info.data} appointment={appointment} onGestionar={() => setStep('gestion')} />
      )}

      {step === 'gestion' && (
        <Gestion
          sucursalId={sucursalId}
          info={info.data}
          appointment={appointment}
          setAppointment={setAppointment}
          onBack={() => setStep('inicio')}
          onReagendar={reagendar}
          onCancelar={cancelar}
          onNueva={resetFlow}
        />
      )}
    </MobileFrame>
  );
}

// ════════════════════ Inicio ════════════════════
function Inicio({ info, servicios, onReservar, onGestionar }: { info: PublicInfo; servicios: ReturnType<typeof useApi<PublicServicio[]>>; onReservar: () => void; onGestionar: () => void }) {
  const populares = (servicios.data ?? []).slice(0, 3);
  return (
    <>
      <ScrollArea style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <div style={{ position: 'relative', margin: 16, borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--navy)', padding: '26px 22px 24px' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)', backgroundSize: '16px 16px', opacity: 0.5 }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              <Icon name="calendar" size={16} color="var(--accent)" />
              <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Reserva en línea</span>
            </div>
            <h1 style={{ color: '#fff', fontSize: 'var(--text-2xl)', lineHeight: '34px', marginBottom: 8 }}>{info.negocioNombre}</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'var(--text-sm)', margin: 0 }}>{info.sucursalNombre} · {info.perfil === 'barberia' ? 'Barbería' : 'Salón'}</p>
          </div>
        </div>

        <div style={{ padding: '0 16px 24px' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Lo más reservado</div>
          {servicios.cargando ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map((i) => <Card key={i} padding={14}><div style={{ height: 28 }} /></Card>)}
            </div>
          ) : servicios.error ? (
            <ErrorState onRetry={servicios.recargar} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {populares.map((s) => (
                <Card key={s.id} padding={14} interactive onClick={onReservar}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--brand-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <Icon name="scissors" size={18} color="var(--brand)" />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{s.nombre}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{s.duracionMin} min</div>
                    </div>
                    <div className="data" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{money(s.precio)}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <FooterBar>
        <Button fullWidth size="lg" iconRight="arrow-right" onClick={onReservar}>Reservar una cita</Button>
        <button type="button" onClick={onGestionar} style={{ width: '100%', marginTop: 10, border: 'none', background: 'transparent', color: 'var(--text-link)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', padding: 6 }}>
          Ya tengo una cita
        </button>
      </FooterBar>
    </>
  );
}

// ════════════════════ Servicios ════════════════════
function Servicios({ negocio, catalogo, seleccion, onToggle, resumen, onBack, onContinue }: { negocio: string; catalogo: ReturnType<typeof useApi<PublicServicio[]>>; seleccion: string[]; onToggle: (id: string) => void; resumen: { total: number; totalMin: number; elegidos: PublicServicio[] }; onBack: () => void; onContinue: () => void }) {
  const lista = catalogo.data ?? [];
  const categorias = useMemo(() => ['Todos', ...Array.from(new Set(lista.map((s) => s.categoria).filter(Boolean) as string[]))], [lista]);
  const [cat, setCat] = useState('Todos');
  const visibles = cat === 'Todos' ? lista : lista.filter((s) => s.categoria === cat);

  return (
    <>
      <AppHeader title="Elige tus servicios" sub={negocio} onBack={onBack} />
      <ProgressBar steps={PASOS} current="servicios" />
      {lista.length > 0 && (
        <div style={{ flex: 'none', padding: '12px 0', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px' }}>
            {categorias.map((c) => {
              const on = c === cat;
              return (
                <button key={c} type="button" onClick={() => setCat(c)} style={{ flex: 'none', height: 36, padding: '0 14px', borderRadius: 9999, cursor: 'pointer', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-subtle)'}`, background: on ? 'var(--brand)' : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ScrollArea>
        {catalogo.cargando ? (
          <ListaSkeleton />
        ) : catalogo.error ? (
          <ErrorState onRetry={catalogo.recargar} />
        ) : visibles.length === 0 ? (
          <EmptyState icon="scissors" title="Sin servicios en esta categoría" desc="Prueba con otra categoría o vuelve más tarde." />
        ) : (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibles.map((s) => {
              const on = seleccion.includes(s.id);
              return (
                <Card key={s.id} interactive selected={on} padding={14} onClick={() => onToggle(s.id)} testId="booking-servicio">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)', marginBottom: 6 }}>{s.nombre}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="data" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{money(s.precio)}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                          <Icon name="clock" size={13} color="var(--text-tertiary)" />{s.duracionMin} min
                        </span>
                      </div>
                    </div>
                    <span style={{ width: 26, height: 26, borderRadius: 8, flex: 'none', marginTop: 2, border: `2px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, background: on ? 'var(--brand)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {on && <Icon name="check" size={16} color="#fff" />}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <FooterBar>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {resumen.elegidos.length > 0 && (
            <div style={{ flex: 'none' }}>
              <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>{money(resumen.total)}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: -2 }}>{resumen.elegidos.length} serv. · {resumen.totalMin} min</div>
            </div>
          )}
          <Button fullWidth iconRight="arrow-right" disabled={!resumen.elegidos.length} onClick={onContinue} style={{ flex: 1 }}>
            {resumen.elegidos.length ? 'Continuar' : 'Selecciona un servicio'}
          </Button>
        </div>
      </FooterBar>
    </>
  );
}

// ════════════════════ Especialista ════════════════════
function Especialistas({ negocio, equipo, value, onPick, onBack, onContinue }: { negocio: string; equipo: ReturnType<typeof useApi<PublicEspecialista[]>>; value: string | null; onPick: (v: string) => void; onBack: () => void; onContinue: () => void }) {
  return (
    <>
      <AppHeader title="Elige tu especialista" sub={negocio} onBack={onBack} />
      <ProgressBar steps={PASOS} current="especialista" />
      <ScrollArea>
        {equipo.cargando ? (
          <ListaSkeleton avatar />
        ) : equipo.error ? (
          <ErrorState onRetry={equipo.recargar} />
        ) : (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Card interactive selected={value === 'any'} padding={14} onClick={() => onPick('any')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 44, height: 44, borderRadius: 9999, flex: 'none', background: 'var(--brand-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="sparkles" size={20} color="var(--brand)" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Cualquiera disponible</span>
                    <Badge tone="brand">Más rápido</Badge>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>Te asignamos el primero que se libere</div>
                </div>
                <RadioDot on={value === 'any'} />
              </div>
            </Card>

            {(equipo.data ?? []).map((e) => (
              <Card key={e.id} interactive selected={value === e.id} padding={14} onClick={() => onPick(e.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={e.nombre} size={44} src={urlFotoEspecialista(e.id, e.fotoVersion)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.nombre}</div>
                    {e.especialidad && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 1 }}>{e.especialidad}</div>}
                  </div>
                  <RadioDot on={value === e.id} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      <FooterBar>
        <Button fullWidth iconRight="arrow-right" disabled={!value} onClick={onContinue}>
          {value ? 'Ver disponibilidad' : 'Elige un especialista'}
        </Button>
      </FooterBar>
    </>
  );
}

function RadioDot({ on }: { on: boolean }) {
  return (
    <span style={{ width: 24, height: 24, borderRadius: 9999, flex: 'none', border: `2px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, background: on ? 'var(--brand)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {on && <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#fff' }} />}
    </span>
  );
}

// ════════════════════ Horario ════════════════════
function Horario({ sucursalId, negocio, servicios, especialistaId, fecha, slot, diasLaborables, serviciosDia, onPickFecha, onPickSlot, onBack, onContinue }: { sucursalId: string; negocio: string; servicios: string[]; especialistaId: string; fecha: string | null; slot: FranjaPublica | null; diasLaborables: boolean[]; serviciosDia: Record<string, boolean[]>; onPickFecha: (f: string) => void; onPickSlot: (s: FranjaPublica) => void; onBack: () => void; onContinue: () => void }) {
  const dias = useMemo(() => Array.from({ length: 14 }, (_, i) => diaParts(sumarDiasISO(hoyISO(), i))), []);
  // Un día es reservable si la sucursal abre ese día de la semana Y ningún
  // servicio elegido está desactivado ese día (0=domingo … 6=sábado).
  const bookableDia = (key: string): boolean => {
    const wd = new Date(`${key}T00:00:00Z`).getUTCDay();
    if (diasLaborables && diasLaborables[wd] === false) return false;
    return servicios.every((sid) => serviciosDia?.[sid]?.[wd] !== false);
  };
  const primerDisponible = dias.find((d) => bookableDia(d.key))?.key ?? dias[0].key;
  const activo = fecha ?? primerDisponible;
  useEffect(() => {
    if (!fecha) onPickFecha(primerDisponible);
  }, [fecha, primerDisponible, onPickFecha]);

  const disp = useApi<FranjaPublica[]>(
    () => api.get(`/public/${sucursalId}/disponibilidad?especialista=${especialistaId}&servicios=${servicios.join(',')}&fecha=${activo}`, false),
    [sucursalId, especialistaId, servicios.join(','), activo],
  );
  const franjas = disp.data ?? [];
  const am = franjas.filter((f) => horaBogota(f.inicio) < 13);
  const pm = franjas.filter((f) => horaBogota(f.inicio) >= 13);

  return (
    <>
      <AppHeader title="Elige fecha y hora" sub={negocio} onBack={onBack} />
      <ProgressBar steps={PASOS} current="horario" />

      <div style={{ flex: 'none', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)', padding: '10px 0 12px' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px' }}>
          {dias.map((d) => {
            const on = d.key === activo;
            const cerrado = !bookableDia(d.key);
            return (
              <button key={d.key} type="button" data-testid={`booking-dia-${d.key}`} disabled={cerrado} onClick={() => { if (!cerrado) onPickFecha(d.key); }} title={cerrado ? 'El negocio no atiende este día' : undefined} style={{ flex: 'none', width: 50, height: 60, borderRadius: 'var(--radius-md)', cursor: cerrado ? 'not-allowed' : 'pointer', opacity: cerrado ? 0.4 : 1, border: `1px solid ${on ? 'var(--brand)' : 'var(--border-subtle)'}`, background: on ? 'var(--brand)' : 'var(--surface-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: on ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>{d.isToday ? 'HOY' : d.dow}</span>
                <span className="data" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: on ? '#fff' : 'var(--text-primary)', lineHeight: 1, textDecoration: cerrado ? 'line-through' : 'none' }}>{d.day}</span>
                <span style={{ fontSize: 10, color: on ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>{cerrado ? 'Cerr.' : d.month}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ScrollArea>
        {disp.cargando ? (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
              {Array.from({ length: 9 }).map((_, i) => <Card key={i} padding={0} style={{ height: 44 }}><div /></Card>)}
            </div>
          </div>
        ) : disp.error ? (
          <ErrorState onRetry={disp.recargar} title="No pudimos cargar la agenda" />
        ) : franjas.length === 0 ? (
          !bookableDia(activo) ? (
            <EmptyState icon="calendar-x" title="El negocio no atiende este día" desc="Elige otro día disponible en la tira de arriba." />
          ) : (
            <EmptyState icon="calendar-x" title="No quedan horas libres este día" desc="Esta fecha está completa. Elige otro día en la tira de arriba." />
          )
        ) : (
          <div style={{ padding: 16 }}>
            <SlotGroup label="Mañana" slots={am} slot={slot} onPick={onPickSlot} />
            <SlotGroup label="Tarde" slots={pm} slot={slot} onPick={onPickSlot} />
          </div>
        )}
      </ScrollArea>

      <FooterBar>
        <Button fullWidth iconRight="arrow-right" disabled={!slot} onClick={onContinue}>
          {slot ? `Continuar · ${horaCorta(slot.inicio)}` : 'Elige una hora'}
        </Button>
      </FooterBar>
    </>
  );
}

function SlotGroup({ label, slots, slot, onPick }: { label: string; slots: FranjaPublica[]; slot: FranjaPublica | null; onPick: (s: FranjaPublica) => void }) {
  if (!slots.length) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
        {slots.map((s) => {
          const on = slot?.inicio === s.inicio;
          return (
            <button key={s.inicio} type="button" data-testid="booking-slot" onClick={() => onPick(s)} className="data" style={{ height: 44, borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-subtle)'}`, background: on ? 'var(--brand)' : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-primary)', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {horaCorta(s.inicio)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════ Identificación + OTP ════════════════════
function Identificacion({ negocio, contacto, onChange, devCode, onEnviar, onVerificar, enviando, onBack }: { negocio: string; contacto: { nombre: string; telefono: string }; onChange: (c: { nombre: string; telefono: string }) => void; devCode?: string; onEnviar: (telefono: string) => Promise<boolean>; onVerificar: (code: string) => void; enviando: boolean; onBack: () => void }) {
  const [fase, setFase] = useState<'datos' | 'otp'>('datos');
  const [nombre, setNombre] = useState(contacto.nombre);
  const [telefono, setTelefono] = useState(contacto.telefono);
  const [tocado, setTocado] = useState(false);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [secs, setSecs] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = telefono.replace(/\D/g, '');
  const telOk = digits.length === 10;
  const nombreOk = nombre.trim().length >= 3;

  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  async function enviar() {
    setTocado(true);
    if (!nombreOk || !telOk) return;
    setSending(true);
    onChange({ nombre: nombre.trim(), telefono: digits });
    const ok = await onEnviar(digits);
    setSending(false);
    if (ok) {
      setFase('otp');
      setSecs(30);
      setTimeout(() => refs.current[0]?.focus(), 60);
    }
  }

  function setDigit(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[i] = d;
    setCode(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  }
  function onKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus();
  }

  const full = code.join('');

  return (
    <>
      <AppHeader title={fase === 'datos' ? 'Tus datos' : 'Verifica tu número'} sub={negocio} onBack={fase === 'otp' ? () => setFase('datos') : onBack} />
      <ProgressBar steps={PASOS} current="identificacion" />

      <ScrollArea>
        {fase === 'datos' ? (
          <div style={{ padding: 20 }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 0, marginBottom: 22, lineHeight: '20px' }}>
              Necesitamos tu nombre y celular para confirmar la cita y avisarte de cualquier cambio.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Campo label="Nombre completo" error={tocado && !nombreOk ? 'Escribe tu nombre (mín. 3 letras)' : undefined}>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Daniel Ríos" style={inputCss(tocado && !nombreOk)} />
              </Campo>
              <Campo label="Celular" hint="Te enviaremos un código por SMS." error={tocado && !telOk ? 'Debe tener 10 dígitos' : undefined}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ ...inputCss(false), width: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontWeight: 600, flex: 'none' }}>+57</div>
                  <input value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/[^\d ]/g, '').slice(0, 12))} inputMode="numeric" placeholder="311 845 2210" className="data" style={{ ...inputCss(tocado && !telOk), flex: 1 }} />
                </div>
              </Campo>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 22, padding: 12, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
              <Icon name="shield" size={16} color="var(--text-tertiary)" style={{ marginTop: 1 }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: '17px' }}>Usamos tu número solo para esta reserva.</span>
            </div>
          </div>
        ) : (
          <div style={{ padding: 20 }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 0, marginBottom: 24, lineHeight: '20px' }}>
              Escribe el código de 6 dígitos que enviamos al <strong className="data" style={{ color: 'var(--text-primary)' }}>+57 {digits}</strong>.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
              {code.map((d, i) => (
                <input key={i} ref={(el) => (refs.current[i] = el)} value={d} onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => onKey(i, e)} inputMode="numeric" maxLength={1} className="data" style={{ width: 46, height: 58, textAlign: 'center', fontSize: 'var(--text-xl)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', border: `1.5px solid ${d ? 'var(--brand)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-md)', outline: 'none', background: 'var(--surface-card)' }} />
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              {secs > 0 ? (
                <span className="data" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Reenviar código en {secs}s</span>
              ) : (
                <button type="button" onClick={() => { void enviar(); }} style={{ border: 'none', background: 'transparent', color: 'var(--text-link)', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Reenviar código</button>
              )}
            </div>
            {devCode && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
                <Icon name="info" size={13} color="var(--text-tertiary)" /> Demo: el código es {devCode}
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <FooterBar>
        {fase === 'datos' ? (
          <Button fullWidth iconRight="arrow-right" disabled={sending} onClick={() => void enviar()}>
            {sending ? 'Enviando código…' : 'Enviar código'}
          </Button>
        ) : (
          <Button fullWidth disabled={full.length !== 6 || enviando} onClick={() => onVerificar(full)}>
            {enviando ? 'Confirmando…' : 'Verificar y confirmar'}
          </Button>
        )}
      </FooterBar>
    </>
  );
}

function Campo({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>
      {children}
      {(error || hint) && <span style={{ fontSize: 'var(--text-xs)', color: error ? 'var(--error)' : 'var(--text-tertiary)' }}>{error || hint}</span>}
    </div>
  );
}
function inputCss(err: boolean): React.CSSProperties {
  return { height: 48, padding: '0 14px', width: '100%', boxSizing: 'border-box', border: `1px solid ${err ? 'var(--error)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-md)', color: 'var(--text-primary)', outline: 'none', boxShadow: 'var(--shadow-xs)' };
}

// ════════════════════ Resultado (confirmación) ════════════════════
function Resultado({ info, appointment, onGestionar }: { info: PublicInfo; appointment: CitaPublica; onGestionar: () => void }) {
  const ok = appointment.estado === 'confirmada';
  return (
    <>
      <ScrollArea style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
        <div style={{ padding: '28px 20px 16px', textAlign: 'center' }}>
          <div style={{ width: 84, height: 84, borderRadius: 9999, margin: '0 auto 20px', background: ok ? 'var(--success-tint)' : 'var(--warning-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'ork-pop var(--dur-slow) var(--ease-out)' }}>
            <Icon name={ok ? 'check-circle' : 'clock'} size={42} color={ok ? 'var(--success)' : 'var(--warning)'} />
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 8 }}>{ok ? '¡Cita confirmada!' : 'Solicitud enviada'}</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: 300, margin: '0 auto', lineHeight: '20px' }}>
            {ok ? `Te esperamos en ${info.negocioNombre}. Recibirás un recordatorio.` : `${info.negocioNombre} revisará tu solicitud y te confirmará. Aún no es definitiva.`}
          </p>
          <div style={{ marginTop: 16 }}><EstadoBadge estado={appointment.estado} /></div>
        </div>
        <div style={{ padding: '8px 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Código de reserva</span>
            <span className="data" style={{ fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>{appointment.codigo}</span>
          </div>
          <CitaCard appointment={appointment} />
        </div>
      </ScrollArea>
      <FooterBar>
        <Button fullWidth iconRight="arrow-right" onClick={onGestionar}>Ver mi cita</Button>
      </FooterBar>
    </>
  );
}

function CitaCard({ appointment }: { appointment: CitaPublica }) {
  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {appointment.servicios.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{s.nombre}</span>
            <span className="data" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{money(s.precio)}</span>
          </div>
        ))}
      </div>
      <div style={{ height: 1, background: 'var(--border-subtle)' }} />
      <DetalleRow icon="user" label="Especialista" value={appointment.especialistaNombre} />
      <div style={{ height: 1, background: 'var(--border-subtle)', marginLeft: 48 }} />
      <DetalleRow icon="calendar" label="Fecha" value={etiquetaDia(appointment.inicio.slice(0, 10))} />
      <div style={{ height: 1, background: 'var(--border-subtle)', marginLeft: 48 }} />
      <DetalleRow icon="clock" label="Hora" value={horaCorta(appointment.inicio)} />
      <div style={{ height: 1, background: 'var(--border-subtle)' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface-sunken)' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Total</span>
        <span className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>{money(appointment.total)}</span>
      </div>
    </Card>
  );
}

function DetalleRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px' }}>
      <span style={{ width: 24, flex: 'none', display: 'flex', justifyContent: 'center' }}><Icon name={icon} size={17} color="var(--text-tertiary)" /></span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', flex: 'none' }}>{label}</span>
      <span style={{ flex: 1, textAlign: 'right', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

// ════════════════════ Gestión ════════════════════
function Gestion({ sucursalId, info, appointment, setAppointment, onBack, onReagendar, onCancelar, onNueva }: { sucursalId: string; info: PublicInfo; appointment: CitaPublica | null; setAppointment: (c: CitaPublica) => void; onBack: () => void; onReagendar: () => void; onCancelar: () => void; onNueva: () => void }) {
  const toast = useToast();
  const [telefono, setTelefono] = useState('');
  const [codigo, setCodigo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function buscar() {
    setBuscando(true);
    try {
      const c = await api.post<CitaPublica>(`/public/${sucursalId}/cita/buscar`, { telefono: telefono.replace(/\D/g, ''), codigo }, false);
      setAppointment(c);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBuscando(false);
    }
  }

  if (!appointment) {
    return (
      <>
        <AppHeader title="Mi cita" sub={info.negocioNombre} onBack={onBack} />
        <ScrollArea>
          <div style={{ padding: 20 }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 0, marginBottom: 20 }}>
              Ingresa el código de tu reserva y tu celular para verla.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Campo label="Código de reserva">
                <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 8))} placeholder="Ej. EB440454" className="data" style={inputCss(false)} />
              </Campo>
              <Campo label="Celular">
                <input value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/[^\d ]/g, '').slice(0, 12))} inputMode="numeric" placeholder="311 845 2210" className="data" style={inputCss(false)} />
              </Campo>
            </div>
          </div>
        </ScrollArea>
        <FooterBar>
          <Button fullWidth disabled={buscando || codigo.length < 6 || telefono.replace(/\D/g, '').length < 7} onClick={() => void buscar()}>
            {buscando ? 'Buscando…' : 'Ver mi cita'}
          </Button>
        </FooterBar>
      </>
    );
  }

  const cancelada = appointment.estado === 'cancelada';

  return (
    <>
      <AppHeader title="Mi cita" sub={info.negocioNombre} onBack={onBack} />
      <ScrollArea>
        <div style={{ padding: 16 }}>
          <Card padding={0} style={{ overflow: 'hidden', opacity: cancelada ? 0.85 : 1 }}>
            <div style={{ background: 'var(--navy)', padding: '18px 18px 16px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '14px 14px', opacity: 0.6 }} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{info.negocioNombre}</div>
                  <div className="data" style={{ color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-xl)' }}>{horaCorta(appointment.inicio)}</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'var(--text-sm)', marginTop: 2 }}>{etiquetaDia(appointment.inicio.slice(0, 10))}</div>
                </div>
                <EstadoBadge estado={appointment.estado} />
              </div>
            </div>
            <DetalleRow icon="user" label="Especialista" value={appointment.especialistaNombre} />
            <div style={{ height: 1, background: 'var(--border-subtle)', marginLeft: 48 }} />
            <DetalleRow icon="store" label="Lugar" value={appointment.sucursalNombre} />
            <div style={{ height: 1, background: 'var(--border-subtle)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Código {appointment.codigo}</span>
              <span className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>{money(appointment.total)}</span>
            </div>
          </Card>

          {cancelada && (
            <div style={{ marginTop: 16, display: 'flex', gap: 10, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--error-tint)' }}>
              <Icon name="info" size={18} color="var(--error)" style={{ marginTop: 1 }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: '18px' }}>Esta cita fue cancelada. Puedes reservar una nueva cuando quieras.</span>
            </div>
          )}
        </div>
      </ScrollArea>

      <FooterBar>
        {cancelada ? (
          <Button fullWidth iconRight="arrow-right" onClick={onNueva}>Reservar de nuevo</Button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" size="lg" iconLeft="refresh-cw" onClick={onReagendar} style={{ flex: 1 }}>Reagendar</Button>
            <Button variant="danger" size="lg" onClick={() => setConfirmCancel(true)} style={{ flex: 1 }}>Cancelar</Button>
          </div>
        )}
      </FooterBar>

      {confirmCancel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={() => setConfirmCancel(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(10,15,20,0.5)' }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: 'var(--surface-card)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', padding: '22px 20px calc(env(safe-area-inset-bottom) + 22px)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 8 }}>¿Cancelar esta cita?</h3>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: '21px', marginBottom: 18 }}>
              Se liberará tu horario de las <strong className="data" style={{ color: 'var(--text-primary)' }}>{horaCorta(appointment.inicio)}</strong>. Podrás reservar de nuevo.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={() => setConfirmCancel(false)}>Volver</Button>
              <Button variant="danger" size="lg" style={{ flex: 1 }} onClick={() => { setConfirmCancel(false); onCancelar(); }}>Sí, cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ListaSkeleton({ avatar }: { avatar?: boolean }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} padding={16}>
          <div style={{ display: 'flex', gap: 12 }}>
            {avatar && <div className="ork-shimmer" style={{ width: 44, height: 44, borderRadius: 9999 }} />}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="ork-shimmer" style={{ width: '60%', height: 14, borderRadius: 6 }} />
              <div className="ork-shimmer" style={{ width: '35%', height: 11, borderRadius: 6 }} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
