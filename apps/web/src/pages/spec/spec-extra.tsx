import { useMemo, useState } from 'react';
import { hora, hoyISO, money, sumarDiasISO } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import { rangoDiaBogota, useCitas } from '../../lib/useCitas';
import { useGanancias } from '../../lib/useEspecialista';
import { AppHeader, ScrollArea } from '../../ui';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Icon, Skeleton, Segmented, Switch, useToast } from '../../ui/ui';
import { DayStat, SectionLabel, Sheet, turnoCliente, turnoTotal } from './spec-ui';

interface Sucursal { id: string; nombre: string; activa: boolean }
type Periodo = 'hoy' | 'semana' | 'mes';

function rango(p: Periodo): { desde: string; hasta: string } {
  const hoy = hoyISO();
  if (p === 'hoy') return rangoDiaBogota(hoy);
  const [y, m] = hoy.split('-').map(Number);
  const desdeIso = p === 'semana' ? sumarDiasISO(hoy, -6) : `${y}-${String(m).padStart(2, '0')}-01`;
  return { desde: `${desdeIso}T05:00:00.000Z`, hasta: rangoDiaBogota(hoy).hasta };
}

// ── Ganancias ────────────────────────────────────────────────────────────────
export function GananciasSpec({ especialistaId, sucursalId }: { especialistaId: string; sucursalId: string | null }) {
  const [periodo, setPeriodo] = useState<Periodo>('hoy');
  const { desde, hasta } = useMemo(() => rango(periodo), [periodo]);
  const g = useGanancias(especialistaId, desde, hasta);
  const citas = useCitas({ desde, hasta, sucursalId, especialistaId });

  const completados = useMemo(() => (citas.data ?? []).filter((c) => c.estado === 'completada').sort((a, b) => b.inicio.localeCompare(a.inicio)), [citas.data]);
  const d = g.data;
  const avg = d && d.servicios ? Math.round(d.ganServicios / d.servicios) : 0;
  const periodoLabel = periodo === 'hoy' ? 'hoy' : periodo === 'semana' ? 'esta semana' : 'este mes';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Mis ganancias" />
      <div style={{ flex: 'none', padding: '14px 20px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <Segmented options={[{ value: 'hoy', label: 'Hoy' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }]} value={periodo} onChange={(v) => setPeriodo(v as Periodo)} />
      </div>

      <ScrollArea>
        {g.error ? (
          <div style={{ padding: 20 }}><ErrorState onRetry={g.recargar} /></div>
        ) : g.cargando || !d ? (
          <div style={{ padding: 20 }}><Skeleton h={130} r={16} style={{ marginBottom: 18 }} /><div style={{ display: 'flex', gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={72} r={8} style={{ flex: 1 }} />)}</div></div>
        ) : periodo === 'hoy' && d.servicios === 0 ? (
          <div style={{ padding: 20 }}><EmptyState icon="dollar-sign" title="Aún sin ganancias hoy" desc="Cuando completes tu primer turno del día verás aquí tu total y el desglose." /></div>
        ) : (
          <div style={{ padding: 20 }}>
            <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--navy)', padding: '22px 20px', marginBottom: 18, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '16px 16px', opacity: 0.6 }} />
              <div style={{ position: 'relative' }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tus ganancias · {periodoLabel}</div>
                <div className="data" style={{ color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-4xl)', letterSpacing: '-0.03em', marginTop: 6 }}>{money(d.total)}</div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-xs)', marginTop: 6 }}>Servicios + comisiones por venta de productos</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 22 }}>
              <DayStat value={d.servicios} label="Servicios" />
              <DayStat value={money(avg)} label="Prom./serv." mono />
              <DayStat value={money(d.comisiones)} label="Comisiones" mono accent />
            </div>

            <SectionLabel>Turnos completados {periodo === 'hoy' ? 'hoy' : `· ${completados.length}`}</SectionLabel>
            {completados.length === 0 ? (
              <Card padding={18}><div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>El detalle por turno del período aparece aquí.</div></Card>
            ) : (
              <Card padding={0}>
                {completados.map((t, i) => (
                  <div key={t.id}>
                    {i > 0 && <div style={{ height: 1, background: 'var(--border-subtle)' }} />}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                      <span className="data" style={{ flex: 'none', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', minWidth: 42 }}>{hora(t.inicio)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{turnoCliente(t)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.servicios.map((s) => s.nombre).join(' · ')}</div>
                      </div>
                      <span className="data" style={{ flex: 'none', fontWeight: 700, fontSize: 'var(--text-sm)', color: '#0A8F5B' }}>{money(turnoTotal(t))}</span>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Perfil ───────────────────────────────────────────────────────────────────
export function PerfilSpec({ disponible, onToggleDisp, sucursales, sucActivaId, sucActivaNombre, onPickSucursal }: {
  disponible: boolean; onToggleDisp: () => void; sucursales: Sucursal[]; sucActivaId: string | null; sucActivaNombre: string; onPickSucursal: (id: string) => void;
}) {
  const { usuario, logout } = useAuth();
  const toast = useToast();
  const [confirm, setConfirm] = useState<Sucursal | null>(null);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Perfil" />
      <ScrollArea>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
            <Avatar name={usuario?.nombre ?? ''} size={64} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{usuario?.nombre}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Especialista · {usuario?.negocio.nombre}</div>
            </div>
          </div>

          <SectionLabel>Disponibilidad</SectionLabel>
          <Card padding={16} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{disponible ? 'Disponible' : 'Ocupado'}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: '17px', marginTop: 2 }}>{disponible ? 'Tus franjas libres se ofrecen en el enlace de reservas.' : 'Tus franjas dejan de ofrecerse en el enlace público.'}</div>
              </div>
              <Switch checked={disponible} onChange={onToggleDisp} tone="success" />
            </div>
          </Card>

          {sucursales.length > 1 && (
            <>
              <SectionLabel>Sucursal activa</SectionLabel>
              <Card padding={0} style={{ marginBottom: 18 }}>
                {sucursales.map((b, i) => {
                  const on = b.id === sucActivaId;
                  return (
                    <div key={b.id}>
                      {i > 0 && <div style={{ height: 1, background: 'var(--border-subtle)' }} />}
                      <button type="button" onClick={() => !on && setConfirm(b)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', border: 'none', background: 'transparent', cursor: on ? 'default' : 'pointer', textAlign: 'left' }}>
                        <Icon name="building" size={18} color={on ? 'var(--brand)' : 'var(--text-tertiary)'} />
                        <span style={{ flex: 1, fontWeight: on ? 600 : 500, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{b.nombre}</span>
                        {on ? <Badge tone="brand" dot>Activa</Badge> : <Icon name="chevron-right" size={18} color="var(--text-tertiary)" />}
                      </button>
                    </div>
                  );
                })}
              </Card>
            </>
          )}

          <Button variant="secondary" size="lg" fullWidth iconLeft="log-out" onClick={() => void logout()}>Cerrar sesión</Button>
          <div style={{ height: 8 }} />
          <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Sede actual: {sucActivaNombre}</div>
        </div>
      </ScrollArea>

      {confirm && (
        <Sheet open onClose={() => setConfirm(null)} title="¿Cambiar de sucursal?"
          footer={<div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={() => setConfirm(null)}>Volver</Button>
            <Button size="lg" style={{ flex: 1 }} onClick={() => { onPickSucursal(confirm.id); toast(`Operando en ${confirm.nombre}`, 'success'); setConfirm(null); }}>Cambiar</Button>
          </div>}>
          <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: '22px' }}>Vas a operar en <strong style={{ color: 'var(--text-primary)' }}>{confirm.nombre}</strong>. Tu agenda y disponibilidad cambiarán a esta sede.</p>
        </Sheet>
      )}
    </div>
  );
}
