import { useMemo, useState } from 'react';
import type { CitaAgenda } from '@orkalis/shared';
import { hora, hoyISO, money, sumarDiasISO } from '../../lib/format';
import { rangoDiaBogota, useCitas } from '../../lib/useCitas';
import { AppHeader, FooterBar, ScrollArea } from '../../ui';
import { Avatar, Button, Card, EmptyState, ErrorState, Icon, Skeleton, Segmented } from '../../ui/ui';
import { ESTADO_COLOR, ESTADO_TINT, EstadoBadgeSpec, SectionLabel, Sheet, minutosDelDia, turnoCliente, turnoTotal } from './spec-ui';

// ── Agenda ───────────────────────────────────────────────────────────────────
export function AgendaSpec({ turnos, cargando, error, onRetry, sucursalId, especialistaId, onOpen }: {
  turnos: CitaAgenda[]; cargando: boolean; error: boolean; onRetry: () => void;
  sucursalId: string | null; especialistaId: string; onOpen: (t: CitaAgenda) => void;
}) {
  const [view, setView] = useState('dia');

  // Semana actual (lunes a domingo) en zona Bogotá.
  const semana = useMemo(() => {
    const hoy = new Date(`${hoyISO()}T12:00:00Z`);
    const dow = (hoy.getUTCDay() + 6) % 7; // 0 = lunes
    const lunes = sumarDiasISO(hoyISO(), -dow);
    return { lunesIso: lunes, desde: rangoDiaBogota(lunes).desde, hasta: rangoDiaBogota(sumarDiasISO(lunes, 6)).hasta };
  }, []);
  const semanaCitas = useCitas({ desde: semana.desde, hasta: semana.hasta, sucursalId, especialistaId, });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Agenda" />
      <div style={{ flex: 'none', padding: '14px 20px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <Segmented options={[{ value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }]} value={view} onChange={setView} />
      </div>

      <ScrollArea>
        {view === 'dia' ? (
          error ? <div style={{ padding: 20 }}><ErrorState onRetry={onRetry} /></div>
            : cargando ? <TimelineSkeleton />
            : turnos.length === 0 ? <EmptyState icon="calendar" title="Día sin turnos" desc="Cuando se reserven citas o registres walk-ins aparecerán aquí." />
            : <DayTimeline turnos={turnos} onOpen={onOpen} />
        ) : (
          semanaCitas.error ? <div style={{ padding: 20 }}><ErrorState onRetry={semanaCitas.recargar} /></div>
            : semanaCitas.cargando ? <TimelineSkeleton />
            : <WeekView lunesIso={semana.lunesIso} citas={semanaCitas.data ?? []} onOpen={onOpen} />
        )}
      </ScrollArea>
    </div>
  );
}

const T_START = 8 * 60, T_END = 20 * 60, PXM = 1.2, GUTTER = 52;
function DayTimeline({ turnos, onOpen }: { turnos: CitaAgenda[]; onOpen: (t: CitaAgenda) => void }) {
  const height = (T_END - T_START) * PXM;
  const hours: number[] = [];
  for (let h = 8; h <= 20; h++) hours.push(h);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMin - T_START) * PXM;

  return (
    <div style={{ padding: '10px 16px 24px' }}>
      <div style={{ position: 'relative', height }}>
        {hours.map((h) => {
          const top = (h * 60 - T_START) * PXM;
          return (
            <div key={h} style={{ position: 'absolute', left: 0, right: 0, top }}>
              <span className="data" style={{ position: 'absolute', left: 0, top: -7, width: GUTTER - 12, textAlign: 'right', fontSize: 11, color: 'var(--text-tertiary)' }}>{h}:00</span>
              <div style={{ position: 'absolute', left: GUTTER, right: 0, top: 0, height: 1, background: 'var(--border-subtle)' }} />
            </div>
          );
        })}
        {nowTop > 0 && nowTop < height && (
          <div style={{ position: 'absolute', left: GUTTER - 4, right: 0, top: nowTop, height: 2, background: 'var(--brand)', zIndex: 4 }}>
            <span style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: 99, background: 'var(--brand)' }} />
          </div>
        )}
        {turnos.map((t) => {
          const startMin = minutosDelDia(t.inicio);
          const endMin = minutosDelDia(t.fin);
          const top = (startMin - T_START) * PXM;
          const h = Math.max((endMin - startMin) * PXM, 34);
          const done = t.estado === 'completada' || t.estado === 'cancelada';
          const color = ESTADO_COLOR[t.estado] ?? 'var(--gray-400)';
          return (
            <button key={t.id} type="button" data-testid={`turno-${t.id}`} onClick={() => onOpen(t)} style={{ position: 'absolute', left: GUTTER, right: 0, top, height: h - 4, textAlign: 'left', cursor: 'pointer', border: `1px solid ${color}`, borderLeft: `3px solid ${color}`, background: ESTADO_TINT[t.estado] ?? 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', overflow: 'hidden', opacity: done ? 0.72 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="data" style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>{hora(t.inicio)}</span>
                <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{turnoCliente(t)}</span>
              </div>
              {h > 46 && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.servicios.map((s) => s.nombre).join(' · ')}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
function WeekView({ lunesIso, citas, onOpen }: { lunesIso: string; citas: CitaAgenda[]; onOpen: (t: CitaAgenda) => void }) {
  const dias = useMemo(() => {
    const out: { iso: string; dow: string; day: number; today: boolean; turnos: CitaAgenda[] }[] = [];
    const hoy = hoyISO();
    for (let i = 0; i < 7; i++) {
      const iso = sumarDiasISO(lunesIso, i);
      const turnos = citas.filter((c) => new Date(new Date(c.inicio).getTime() - 5 * 3600_000).toISOString().slice(0, 10) === iso).sort((a, b) => a.inicio.localeCompare(b.inicio));
      out.push({ iso, dow: DOW[i], day: Number(iso.slice(8, 10)), today: iso === hoy, turnos });
    }
    return out;
  }, [lunesIso, citas]);

  return (
    <div style={{ display: 'flex', gap: 4, padding: '12px 12px 24px', overflowX: 'auto' }}>
      {dias.map((d) => (
        <div key={d.iso} style={{ flex: 1, minWidth: 92 }}>
          <div style={{ textAlign: 'center', padding: '6px 0 8px', borderRadius: 'var(--radius-sm)', background: d.today ? 'var(--brand-tint)' : 'transparent', marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: d.today ? 'var(--brand)' : 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>{d.dow}</div>
            <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-lg)', color: d.today ? 'var(--brand)' : 'var(--text-primary)' }}>{d.day}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {d.turnos.length === 0 ? <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-disabled)', padding: '8px 0' }}>—</div>
              : d.turnos.map((t) => (
                <button key={t.id} type="button" onClick={() => onOpen(t)} style={{ textAlign: 'left', cursor: 'pointer', border: 'none', borderLeft: `3px solid ${ESTADO_COLOR[t.estado] ?? 'var(--gray-400)'}`, background: 'var(--surface-sunken)', borderRadius: 4, padding: '5px 6px', overflow: 'hidden' }}>
                  <div className="data" style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{hora(t.inicio)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{turnoCliente(t).split(' ')[0]}</div>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div style={{ padding: '16px 16px 16px 60px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[64, 110, 48, 90, 70, 56].map((h, i) => <Skeleton key={i} h={h} r={8} />)}
    </div>
  );
}

// ── Detalle del turno ────────────────────────────────────────────────────────
type SheetKind = 'noasistio' | 'cancelar' | 'revertir' | null;
export function DetalleTurno({ turno, onBack, onIniciar, onCompletar, onCancelar, onNoAsistio, onRevertir }: {
  turno: CitaAgenda; onBack: () => void; onIniciar: () => void; onCompletar: () => void; onCancelar: () => void; onNoAsistio: () => void; onRevertir: (reponerStock: boolean) => void;
}) {
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [reponer, setReponer] = useState(true);
  const st = turno.estado;
  const total = turnoTotal(turno);

  const cfg: Record<Exclude<SheetKind, null>, { title: string; body: string; cta: string; run: () => void }> = {
    noasistio: { title: '¿Marcar como no asistió?', body: 'El cliente no se presentó. El turno quedará registrado como “No asistió” y se liberará tu agenda.', cta: 'Marcar no asistió', run: onNoAsistio },
    cancelar: { title: '¿Cancelar este turno?', body: 'Se cancelará el turno y se liberará el horario. Avísale al cliente si es posible.', cta: 'Cancelar turno', run: onCancelar },
    revertir: { title: '¿Revertir el cobro?', body: 'Esto deshace las ganancias calculadas. El turno volverá a quedar pendiente de cobro.', cta: 'Sí, revertir', run: () => onRevertir(reponer) },
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Turno" sub={`${hora(turno.inicio)} – ${hora(turno.fin)}`} onBack={onBack} right={<EstadoBadgeSpec estado={st} />} />
      <ScrollArea>
        <div style={{ padding: 16 }}>
          <Card padding={14} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={turnoCliente(turno)} size={46} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{turnoCliente(turno)}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{turno.origen?.replace(/_/g, ' ') ?? 'Agendado'}</div>
              </div>
            </div>
          </Card>

          <SectionLabel>Servicios</SectionLabel>
          <Card padding={0} style={{ marginBottom: 14 }}>
            {turno.servicios.map((s, i) => (
              <div key={i}>
                {i > 0 && <div style={{ height: 1, background: 'var(--border-subtle)' }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px' }}>
                  <div style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{s.nombre}</div>
                  <span className="data" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{money(Number(s.precio))}</span>
                </div>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--border-subtle)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 14px', background: 'var(--surface-sunken)' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{st === 'completada' ? 'Total cobrado' : 'Total estimado'}</span>
              <span className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>{money(total)}</span>
            </div>
          </Card>

          {(st === 'cancelada' || st === 'no_asistio') && (
            <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 'var(--radius-md)', background: st === 'cancelada' ? 'var(--error-tint)' : 'var(--warning-tint)', border: `1px solid ${st === 'cancelada' ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.28)'}` }}>
              <Icon name={st === 'cancelada' ? 'alert-octagon' : 'alert-triangle'} size={18} color={st === 'cancelada' ? 'var(--error)' : '#B45309'} style={{ flex: 'none', marginTop: 1 }} />
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Este turno está cerrado. El horario quedó libre en tu agenda.</div>
            </div>
          )}
        </div>
      </ScrollArea>

      {(st === 'confirmada' || st === 'solicitada') && (
        <FooterBar>
          <Button size="lg" fullWidth iconLeft="play" onClick={onIniciar}>Iniciar turno</Button>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <Button variant="secondary" size="md" style={{ flex: 1 }} onClick={() => setSheet('noasistio')}>No asistió</Button>
            <Button variant="secondary" size="md" style={{ flex: 1, color: 'var(--error)' }} onClick={() => setSheet('cancelar')}>Cancelar</Button>
          </div>
        </FooterBar>
      )}
      {st === 'en_progreso' && (
        <FooterBar>
          <Button size="lg" fullWidth iconLeft="check" onClick={onCompletar}>Completar turno</Button>
          <Button variant="secondary" size="md" fullWidth style={{ marginTop: 10, color: 'var(--error)' }} onClick={() => setSheet('cancelar')}>Cancelar (incidente)</Button>
        </FooterBar>
      )}
      {st === 'completada' && (
        <FooterBar>
          <Button variant="secondary" size="md" fullWidth iconLeft="rotate-ccw" onClick={() => setSheet('revertir')}>Revertir cobro</Button>
        </FooterBar>
      )}

      {sheet && (
        <Sheet open onClose={() => setSheet(null)} title={cfg[sheet].title}
          footer={<div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={() => setSheet(null)}>Volver</Button>
            <Button variant="danger" size="lg" style={{ flex: 1 }} onClick={() => { const r = cfg[sheet].run; setSheet(null); r(); }}>{cfg[sheet].cta}</Button>
          </div>}>
          <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: '22px' }}>{cfg[sheet].body}</p>
          {sheet === 'revertir' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
              <input type="checkbox" checked={reponer} onChange={(e) => setReponer(e.target.checked)} style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Reingresar al inventario los productos vendidos, si los hubo.</span>
            </label>
          )}
        </Sheet>
      )}
    </div>
  );
}
