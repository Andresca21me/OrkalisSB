import { useMemo, useState } from 'react';
import type { CitaAgenda } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useAuth } from '../../lib/auth';
import { fechaLarga, hora, hoyISO, money } from '../../lib/format';
import { accionCita, rangoDiaBogota, useCitas } from '../../lib/useCitas';
import { setDisponibilidad } from '../../lib/useEspecialista';
import { Avatar, Button, Card, EmptyState, ErrorState, Icon, Skeleton, useToast } from '../../ui/ui';
import { ScrollArea, SpecShell } from '../../ui';
import { DayStat, EstadoBadgeSpec, SectionLabel, TurnoRow, ghostDarkBtn, turnoCliente, turnoDur, turnoTotal } from './spec-ui';
import { AgendaSpec, DetalleTurno } from './spec-agenda';
import { CobroSpec } from './spec-cobro';
import { WalkinSpec } from './spec-walkin';
import { GananciasSpec, PerfilSpec } from './spec-extra';

interface Sucursal { id: string; nombre: string; activa: boolean }
type Overlay = { type: 'detalle' | 'cobro'; id: string } | null;

export function SpecApp() {
  const { usuario, logout } = useAuth();
  const toast = useToast();
  const especialistaId = usuario?.especialistaId ?? null;

  const sucs = useApi<Sucursal[]>(() => api.get('/sucursales'));
  const [sucursalId, setSucursalId] = useState<string | null>(null);
  const sucActiva = sucursalId ?? usuario?.sucursalIds?.[0] ?? null;

  const [tab, setTab] = useState('miDia');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [disponible, setDisp] = useState(true);

  const hoy = hoyISO();
  const { desde, hasta } = rangoDiaBogota(hoy);
  const turnos = useCitas({ desde, hasta, sucursalId: sucActiva, especialistaId: especialistaId ?? undefined });

  const lista = useMemo(() => [...(turnos.data ?? [])].sort((a, b) => a.inicio.localeCompare(b.inicio)), [turnos.data]);
  const turnoById = (id: string) => lista.find((t) => t.id === id) ?? null;

  async function refrescar() { await turnos.recargar(); }

  async function accion(c: CitaAgenda, ev: 'aprobar' | 'iniciar' | 'cancelar' | 'no-asistio' | 'revertir') {
    try {
      await accionCita(c.id, ev);
      toast(ev === 'iniciar' ? 'Turno iniciado' : ev === 'revertir' ? 'Cobro revertido' : 'Turno actualizado', ev === 'cancelar' || ev === 'no-asistio' ? 'info' : 'success');
      await refrescar();
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  async function toggleDisp() {
    if (!especialistaId) return;
    const next = !disponible;
    setDisp(next);
    try {
      await setDisponibilidad(especialistaId, next);
      toast(next ? 'Estás disponible' : 'Marcado como ocupado', next ? 'success' : 'info');
    } catch (e) { setDisp(!next); toast((e as Error).message, 'error'); }
  }

  // Cambiar de pestaña siempre cierra cualquier overlay a pantalla completa.
  const irTab = (id: string) => { setOverlay(null); setTab(id); };
  const shellNav = { tab, onTab: irTab, nombre: usuario?.nombre ?? '', disponible, onToggleDisp: toggleDisp, onLogout: () => void logout() };

  if (!especialistaId) {
    return (
      <SpecShell {...shellNav} desktopNav={false} mobileTabBar={false}>
        <ScrollArea style={{ padding: 24, display: 'grid', placeItems: 'center' }}>
          <div style={{ display: 'grid', gap: 18, justifyItems: 'center', textAlign: 'center' }}>
            <EmptyState icon="user-x" title="Sin perfil de especialista" desc="Tu cuenta no está enlazada a un recurso de agenda. Pide a tu administrador que te vincule como especialista (Gestión › Equipo)." />
            <Button variant="secondary" iconLeft="log-out" onClick={() => void logout()}>
              Cerrar sesión
            </Button>
          </div>
        </ScrollArea>
      </SpecShell>
    );
  }

  // Overlays a pantalla completa: en móvil ocultan la tab bar; en escritorio
  // conservan la barra lateral (se sale con «atrás» o navegando).
  if (overlay) {
    const turno = turnoById(overlay.id);
    if (turno && overlay.type === 'detalle') {
      return (
        <SpecShell {...shellNav} mobileTabBar={false}>
          <DetalleTurno turno={turno} onBack={() => setOverlay(null)}
            onIniciar={() => accion(turno, 'iniciar')} onCompletar={() => setOverlay({ type: 'cobro', id: turno.id })}
            onCancelar={() => { void accion(turno, 'cancelar'); setOverlay(null); }} onNoAsistio={() => { void accion(turno, 'no-asistio'); setOverlay(null); }}
            onRevertir={() => { void accion(turno, 'revertir'); }} />
        </SpecShell>
      );
    }
    if (turno && overlay.type === 'cobro') {
      return (
        <SpecShell {...shellNav} mobileTabBar={false}>
          <CobroSpec turno={turno} onBack={() => setOverlay(null)} onDone={async () => { setOverlay(null); toast('Turno completado, ganancias calculadas', 'success'); await refrescar(); }} />
        </SpecShell>
      );
    }
  }

  // Turno actual (en curso ahora)
  const NOW = Date.now();
  const current = lista.find((t) => t.estado === 'en_progreso')
    ?? lista.find((t) => new Date(t.inicio).getTime() <= NOW && NOW < new Date(t.fin).getTime() && (t.estado === 'confirmada' || t.estado === 'solicitada'))
    ?? null;

  const sucNombre = (id: string | null) => (id ? sucs.data?.find((s) => s.id === id)?.nombre ?? 'Sede' : 'Sede');
  const sucursalesScope = (sucs.data ?? []).filter((s) => !usuario?.sucursalIds || usuario.sucursalIds.includes(s.id));

  let body: React.ReactNode;
  if (tab === 'agenda') {
    body = <AgendaSpec turnos={lista} cargando={turnos.cargando} error={!!turnos.error} onRetry={turnos.recargar} sucursalId={sucActiva} especialistaId={especialistaId} onOpen={(t) => setOverlay({ type: 'detalle', id: t.id })} />;
  } else if (tab === 'walkin') {
    body = <WalkinSpec sucursalId={sucActiva} especialistaId={especialistaId} onDone={async (modo) => { await refrescar(); setTab(modo === 'vivo' ? 'miDia' : 'agenda'); }} />;
  } else if (tab === 'ganancias') {
    body = <GananciasSpec especialistaId={especialistaId} sucursalId={sucActiva} />;
  } else if (tab === 'perfil') {
    body = <PerfilSpec disponible={disponible} onToggleDisp={toggleDisp} sucursales={sucursalesScope} sucActivaId={sucActiva} sucActivaNombre={sucNombre(sucActiva)} onPickSucursal={setSucursalId} />;
  } else {
    body = (
      <MiDia me={usuario?.nombre ?? ''} turnos={lista} current={current} cargando={turnos.cargando} error={!!turnos.error} onRetry={turnos.recargar}
        disponible={disponible} onToggleDisp={toggleDisp}
        multiSede={sucursalesScope.length > 1} sucNombre={sucNombre(sucActiva)} onSede={() => setTab('perfil')}
        onOpen={(t) => setOverlay({ type: 'detalle', id: t.id })}
        onIniciar={(t) => accion(t, 'iniciar')} onCompletar={(t) => setOverlay({ type: 'cobro', id: t.id })}
        onCancelar={(t) => accion(t, 'cancelar')} onNoAsistio={(t) => accion(t, 'no-asistio')} onWalkin={() => setTab('walkin')} />
    );
  }

  return <SpecShell {...shellNav}>{body}</SpecShell>;
}

// ── Mi día ───────────────────────────────────────────────────────────────────
function MiDia({ me, turnos, current, cargando, error, onRetry, disponible, onToggleDisp, multiSede, sucNombre, onSede, onOpen, onIniciar, onCompletar, onCancelar, onNoAsistio, onWalkin }: {
  me: string; turnos: CitaAgenda[]; current: CitaAgenda | null; cargando: boolean; error: boolean; onRetry: () => void;
  disponible: boolean; onToggleDisp: () => void; multiSede: boolean; sucNombre: string; onSede: () => void;
  onOpen: (t: CitaAgenda) => void; onIniciar: (t: CitaAgenda) => void; onCompletar: (t: CitaAgenda) => void; onCancelar: (t: CitaAgenda) => void; onNoAsistio: (t: CitaAgenda) => void; onWalkin: () => void;
}) {
  const completados = turnos.filter((t) => t.estado === 'completada').length;
  const gananciasHoy = turnos.filter((t) => t.estado === 'completada').reduce((a, t) => a + turnoTotal(t), 0);
  const upcoming = turnos.filter((t) => t !== current && t.estado !== 'completada' && t.estado !== 'cancelada' && t.estado !== 'no_asistio');
  const nextTurno = upcoming.find((t) => t !== current);
  const primerNombre = me.split(' ')[0];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{ flex: 'none', padding: 'calc(env(safe-area-inset-top) + 12px) 20px 16px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 'var(--text-xl)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>Hola, {primerNombre}</h1>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 4, textTransform: 'capitalize' }}>{fechaLarga(new Date())}</div>
          </div>
          <Avatar name={me} size={44} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {multiSede && (
            <button type="button" onClick={onSede} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', borderRadius: 999, border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', maxWidth: 200 }}>
              <Icon name="building" size={15} color="var(--text-tertiary)" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sucNombre}</span>
              <Icon name="chevron-down" size={15} color="var(--text-tertiary)" />
            </button>
          )}
          <button type="button" onClick={onToggleDisp} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer', background: disponible ? 'var(--success-tint)' : 'var(--surface-sunken)', color: disponible ? '#0A8F5B' : 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: disponible ? 'var(--success)' : 'var(--gray-400)' }} />
            {disponible ? 'Disponible' : 'Ocupado'}
          </button>
        </div>
      </header>

      <ScrollArea>
        {error ? (
          <div style={{ padding: 20 }}><ErrorState onRetry={onRetry} /></div>
        ) : cargando ? (
          <div style={{ padding: 20 }}>
            <Skeleton h={188} r={16} style={{ marginBottom: 20 }} />
            <Skeleton w={120} h={12} style={{ marginBottom: 14 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={70} r={8} />)}</div>
          </div>
        ) : turnos.length === 0 ? (
          <div style={{ padding: 20 }}>
            <EmptyState icon="calendar" title="No tienes turnos hoy" desc="Tu agenda está libre. Si llega un cliente sin reserva, regístralo como walk-in." action={<Button iconLeft="plus" onClick={onWalkin}>Registrar walk-in</Button>} />
          </div>
        ) : (
          <div style={{ padding: 20 }}>
            {current ? (
              <CurrentTurnoHero turno={current} onOpen={() => onOpen(current)} onIniciar={() => onIniciar(current)} onCompletar={() => onCompletar(current)} onCancelar={() => onCancelar(current)} onNoAsistio={() => onNoAsistio(current)} />
            ) : (
              <Card padding={18} style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 46, height: 46, borderRadius: 12, flex: 'none', background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="clock" size={22} color="var(--text-tertiary)" /></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Sin turno en curso</div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>{nextTurno ? `Próximo turno a las ${hora(nextTurno.inicio)}` : 'Nada más por hoy'}</div>
                  </div>
                </div>
              </Card>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
              <DayStat value={turnos.length} label="Turnos" />
              <DayStat value={completados} label="Completados" />
              <DayStat value={money(gananciasHoy)} label="Hoy" accent mono />
            </div>

            <SectionLabel>Próximos hoy · {upcoming.length}</SectionLabel>
            {upcoming.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upcoming.map((t) => <TurnoRow key={t.id} turno={t} onClick={() => onOpen(t)} />)}
              </div>
            ) : (
              <Card padding={20}><div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No quedan más turnos por hoy.</div></Card>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function CurrentTurnoHero({ turno, onOpen, onIniciar, onCompletar, onCancelar, onNoAsistio }: { turno: CitaAgenda; onOpen: () => void; onIniciar: () => void; onCompletar: () => void; onCancelar: () => void; onNoAsistio: () => void }) {
  const enProgreso = turno.estado === 'en_progreso';
  return (
    <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--navy)', marginBottom: 22, boxShadow: 'var(--shadow-lg)', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '16px 16px', opacity: 0.6 }} />
      <div style={{ position: 'relative', padding: '18px 18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{enProgreso ? 'En progreso ahora' : 'Turno actual'}</span>
          <EstadoBadgeSpec estado={turno.estado} size="lg" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <span className="data" style={{ color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-3xl)', letterSpacing: '-0.03em' }}>{hora(turno.inicio)}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-sm)' }}>– {hora(turno.fin)} · {turnoDur(turno)} min</span>
        </div>
        <div style={{ color: '#fff', fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', marginBottom: 2 }}>{turnoCliente(turno)}</div>
        <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 'var(--text-sm)', marginBottom: 18 }}>{turno.servicios.map((s) => s.nombre).join(' · ')} · {money(turnoTotal(turno))}</div>

        {enProgreso ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Button size="lg" fullWidth iconLeft="check" onClick={onCompletar}>Completar turno</Button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onCancelar} style={ghostDarkBtn}>Cancelar (incidente)</button>
              <button type="button" onClick={onOpen} style={ghostDarkBtn}>Ver detalle</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Button size="lg" fullWidth iconLeft="play" onClick={onIniciar}>Iniciar turno</Button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onNoAsistio} style={ghostDarkBtn}>No asistió</button>
              <button type="button" onClick={onCancelar} style={ghostDarkBtn}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
