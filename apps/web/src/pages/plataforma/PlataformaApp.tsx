import { useEffect, useMemo, useState } from 'react';
import { money, num, fechaCorta } from '../../lib/format';
import { Shell, PageHead, type NavItem } from '../../ui/Shell';
import { useMensajeriaPlataforma, type EstadoMensajeria } from './usePlataforma';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  EstadoBadge,
  Field,
  Icon,
  Input,
  KpiCard,
  SearchInput,
  Segmented,
  Select,
  Spinner,
  Tag,
  useToast,
} from '../../ui/ui';
import { GConfirm, RowMenu } from '../admin/gestion-ui';
import {
  usePlataforma,
  type CortesiaBody,
  type CuposMensajeria,
  type DetalleTenant,
  type ResumenTenant,
} from './usePlataforma';

const NAV: NavItem[] = [{ id: 'negocios', label: 'Negocios', icon: 'building' }];

const PLAN_LABEL: Record<string, string> = {
  basico: 'Básico',
  pro: 'Pro',
  premium: 'Premium',
  empresarial: 'Empresarial',
};
const PERFIL_LABEL: Record<string, string> = { barberia: 'Barbería', salon: 'Salón' };
const PERFIL_ICON: Record<string, string> = { barberia: 'scissors', salon: 'sparkles' };

const COBRO_TONE = { pagado: 'success', pendiente: 'warning', fallido: 'error' } as const;
const COBRO_LABEL: Record<string, string> = { pagado: 'Pagado', pendiente: 'Pendiente', fallido: 'Fallido' };

const PLANES: { value: string; label: string }[] = [
  { value: 'basico', label: 'Básico' },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
  { value: 'empresarial', label: 'Empresarial' },
];

type FiltroEstado = 'todos' | 'activa' | 'suspendida';

export function PlataformaApp() {
  const toast = useToast();
  const { negocios, cargando, error, recargar, detalle, suspender, reactivar, generarCobro, darCortesia, quitarCortesia } =
    usePlataforma();

  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');
  const [abierto, setAbierto] = useState<ResumenTenant | null>(null);
  const [confirmar, setConfirmar] = useState<{ t: ResumenTenant; accion: 'suspender' | 'reactivar' | 'quitarCortesia' } | null>(null);
  const [cortesia, setCortesia] = useState<ResumenTenant | null>(null);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (negocios ?? []).filter((n) => {
      if (filtro !== 'todos' && n.estadoSuscripcion !== filtro) return false;
      if (term && !n.nombre.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [negocios, q, filtro]);

  const kpis = useMemo(() => {
    const lista = negocios ?? [];
    return {
      total: lista.length,
      activos: lista.filter((n) => n.estadoSuscripcion === 'activa').length,
      suspendidos: lista.filter((n) => n.estadoSuscripcion === 'suspendida').length,
      // MRR: solo cuentas activas generan ingreso recurrente.
      mrr: lista.filter((n) => n.estadoSuscripcion === 'activa').reduce((s, n) => s + n.cargoMensual, 0),
    };
  }, [negocios]);

  async function ejecutarConfirmacion() {
    if (!confirmar) return;
    const { t, accion } = confirmar;
    setConfirmar(null);
    try {
      if (accion === 'suspender') {
        await suspender(t.negocioId);
        toast(`${t.nombre} suspendida`, 'warning');
      } else if (accion === 'reactivar') {
        await reactivar(t.negocioId);
        toast(`${t.nombre} reactivada`, 'success');
      } else {
        await quitarCortesia(t.negocioId);
        toast(`Cortesía de ${t.nombre} retirada (cuenta suspendida)`, 'warning');
      }
      await recargar();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function aplicarCortesia(t: ResumenTenant, body: CortesiaBody) {
    setCortesia(null);
    setAbierto(null);
    try {
      await darCortesia(t.negocioId, body);
      toast(`Cortesía asignada a ${t.nombre}`, 'success');
      await recargar();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function cobrar(t: ResumenTenant) {
    try {
      const r = await generarCobro(t.negocioId);
      toast(`Cobro de ${t.nombre} generado: ${money(r.monto)} (${r.periodo})`, 'success');
      await recargar();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <Shell nav={NAV} activo="negocios" onNav={() => {}}>
      <PageHead
        title="Negocios"
        desc="Consola de plataforma — administra tenants, suscripciones y estado de cuenta."
        action={
          <Button variant="secondary" iconLeft="refresh-cw" onClick={() => void recargar()}>
            Actualizar
          </Button>
        }
      />

      {/* KPIs de salud de la plataforma */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        <KpiCard label="Negocios" value={num(kpis.total)} icon="building" loading={cargando} sub="tenants en la plataforma" />
        <KpiCard label="Ingreso recurrente (MRR)" value={money(kpis.mrr)} icon="wallet" loading={cargando} sub="suma de cuentas activas" />
        <KpiCard label="Cuentas activas" value={num(kpis.activos)} icon="check-circle" loading={cargando} />
        <KpiCard label="Suspendidas" value={num(kpis.suspendidos)} icon="pause" loading={cargando} />
      </div>

      <MensajeriaCard />

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar negocio…" width={260} />
        <div style={{ flex: 1 }} />
        <Segmented
          value={filtro}
          onChange={(v) => setFiltro(v as FiltroEstado)}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'activa', label: 'Activas' },
            { value: 'suspendida', label: 'Suspendidas' },
          ]}
        />
      </div>

      {error ? (
        <ErrorState onRetry={() => void recargar()} />
      ) : cargando ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}><Spinner size={26} /></div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon="building"
          title={q || filtro !== 'todos' ? 'Sin coincidencias' : 'Aún no hay negocios'}
          desc={q || filtro !== 'todos' ? 'Ajusta la búsqueda o el filtro de estado.' : 'Cuando se den de alta tenants, aparecerán aquí.'}
        />
      ) : (
        <TenantsTable
          filas={filtrados}
          onAbrir={setAbierto}
          onCobrar={cobrar}
          onSuspender={(t) => setConfirmar({ t, accion: 'suspender' })}
          onReactivar={(t) => setConfirmar({ t, accion: 'reactivar' })}
          onDarCortesia={setCortesia}
          onQuitarCortesia={(t) => setConfirmar({ t, accion: 'quitarCortesia' })}
        />
      )}

      {abierto && (
        <TenantDetail
          resumen={abierto}
          cargarDetalle={detalle}
          onClose={() => setAbierto(null)}
          onCobrar={() => cobrar(abierto)}
          onSuspender={() => setConfirmar({ t: abierto, accion: 'suspender' })}
          onReactivar={() => setConfirmar({ t: abierto, accion: 'reactivar' })}
          onDarCortesia={() => setCortesia(abierto)}
          onQuitarCortesia={() => setConfirmar({ t: abierto, accion: 'quitarCortesia' })}
        />
      )}

      {cortesia && (
        <CortesiaDialog
          tenant={cortesia}
          onClose={() => setCortesia(null)}
          onConfirm={(body) => void aplicarCortesia(cortesia, body)}
        />
      )}

      <GConfirm
        open={!!confirmar}
        danger={confirmar?.accion === 'suspender' || confirmar?.accion === 'quitarCortesia'}
        title={
          confirmar?.accion === 'suspender'
            ? 'Suspender cuenta'
            : confirmar?.accion === 'quitarCortesia'
              ? 'Quitar cortesía'
              : 'Reactivar cuenta'
        }
        confirmLabel={
          confirmar?.accion === 'suspender'
            ? 'Sí, suspender'
            : confirmar?.accion === 'quitarCortesia'
              ? 'Sí, quitar'
              : 'Sí, reactivar'
        }
        confirmIcon={
          confirmar?.accion === 'suspender' ? 'pause' : confirmar?.accion === 'quitarCortesia' ? 'gift' : 'power'
        }
        onClose={() => setConfirmar(null)}
        onConfirm={() => void ejecutarConfirmacion()}
        desc={
          confirmar?.accion === 'suspender' ? (
            <>
              <strong style={{ color: 'var(--text-primary)' }}>{confirmar?.t.nombre}</strong> perderá el acceso al
              panel hasta que se reactive. Los datos del negocio se conservan íntegros (borrado lógico).
            </>
          ) : confirmar?.accion === 'quitarCortesia' ? (
            <>
              Se retira la cortesía de <strong style={{ color: 'var(--text-primary)' }}>{confirmar?.t.nombre}</strong> y la
              cuenta queda <strong style={{ color: 'var(--text-primary)' }}>suspendida</strong> hasta que registre un método de pago.
            </>
          ) : (
            <>
              Se restaura el acceso completo de <strong style={{ color: 'var(--text-primary)' }}>{confirmar?.t.nombre}</strong>.
            </>
          )
        }
      />
    </Shell>
  );
}

// ── Tabla densa de tenants ───────────────────────────────────────────────────

/**
 * Interruptor de mensajería de la plataforma.
 *
 * El crédito del proveedor es finito y lo comparten todos los negocios. Cuando
 * se acaba, la plataforma pasa a **modo sin mensajes**: los códigos se muestran
 * en pantalla y los recordatorios se detienen, en lugar de que todo falle en
 * silencio. Aquí se ve cuánto queda y se enciende otra vez tras recargar.
 */
function MensajeriaCard() {
  const toast = useToast();
  const { estado, cargando, recargar, pausar, reanudar } = useMensajeriaPlataforma();
  const [recarga, setRecarga] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function accion(fn: () => Promise<EstadoMensajeria>, ok: string, tono: 'success' | 'warning') {
    setOcupado(true);
    try {
      await fn();
      await recargar();
      toast(ok, tono);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setOcupado(false);
    }
  }

  if (cargando || !estado) return null;

  const pausada = !estado.activa;
  const gastado = estado.presupuesto > 0 ? Math.min(100, Math.round((estado.consumidos / estado.presupuesto) * 100)) : 0;
  const cerca = estado.restantes != null && estado.restantes <= Math.max(10, estado.presupuesto * 0.1);

  return (
    <Card padding={18} style={{ marginBottom: 22, borderColor: pausada ? 'rgba(245,158,11,0.45)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 4 }}>
            <Icon name="message-square" size={17} color={pausada ? 'var(--warning)' : 'var(--brand)'} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-md)' }}>Mensajería</span>
            <Badge tone={pausada ? 'warning' : 'success'} dot>{pausada ? 'Pausada' : 'Activa'}</Badge>
            {!estado.twilioConfigurado && <Badge tone="neutral">Sin proveedor configurado</Badge>}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: '20px' }}>
            {pausada
              ? `${estado.motivo ?? 'Pausada.'} Las confirmaciones quedan en cola y los recordatorios no se programan hasta reanudar.`
              : estado.presupuesto > 0
                ? `${num(estado.consumidos)} de ${num(estado.presupuesto)} segmentos usados · quedan ${num(estado.restantes ?? 0)}.`
                : 'Sin tope declarado: no se cortará sola. Fija los segmentos comprados para que se pause al agotarse.'}
          </div>
          {estado.presupuesto > 0 && !pausada && (
            <div style={{ marginTop: 10, height: 6, borderRadius: 99, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
              <div style={{ width: `${gastado}%`, height: '100%', background: cerca ? 'var(--warning)' : 'var(--brand)' }} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Input
            value={recarga}
            onChange={(e) => setRecarga(e.target.value.replace(/\D/g, ''))}
            placeholder="Segmentos"
            inputMode="numeric"
            aria-label="Segmentos comprados"
            style={{ width: 120 }}
          />
          <Button
            variant={pausada ? 'primary' : 'secondary'}
            disabled={ocupado}
            iconLeft="play"
            onClick={() => void accion(() => reanudar(recarga.trim() ? Number(recarga) : undefined), 'Mensajería reanudada', 'success')}
          >
            {pausada ? 'Reanudar' : 'Recargar'}
          </Button>
          {!pausada && (
            <Button variant="secondary" disabled={ocupado} iconLeft="pause"
              onClick={() => void accion(() => pausar('Pausada manualmente desde la consola.'), 'Mensajería pausada', 'warning')}>
              Pausar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function TenantsTable({
  filas,
  onAbrir,
  onCobrar,
  onSuspender,
  onReactivar,
  onDarCortesia,
  onQuitarCortesia,
}: {
  filas: ResumenTenant[];
  onAbrir: (t: ResumenTenant) => void;
  onCobrar: (t: ResumenTenant) => void;
  onSuspender: (t: ResumenTenant) => void;
  onReactivar: (t: ResumenTenant) => void;
  onDarCortesia: (t: ResumenTenant) => void;
  onQuitarCortesia: (t: ResumenTenant) => void;
}) {
  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '0 16px 10px',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '14px 16px',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    borderTop: '1px solid var(--border-subtle)',
    verticalAlign: 'middle',
  };

  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
          <thead>
            <tr>
              <th style={th}>Negocio</th>
              <th style={th}>Plan</th>
              <th style={{ ...th, textAlign: 'right' }}>Especialistas</th>
              <th style={{ ...th, textAlign: 'right' }}>Sucursales</th>
              <th style={{ ...th, textAlign: 'right' }}>Cargo / mes</th>
              <th style={th}>Estado</th>
              <th style={th}>Último cobro</th>
              <th style={{ ...th, textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((n) => {
              // "Reactivar" solo cuando está sin acceso; en cualquier otro estado
              // con acceso (activa/prueba/gracia/cortesía) se ofrece "Suspender".
              const bloqueada = n.estadoSuscripcion === 'suspendida' || n.estadoSuscripcion === 'cancelada';
              const esCortesia = n.estadoSuscripcion === 'cortesia';
              return (
                <tr
                  key={n.negocioId}
                  data-testid={`tenant-row-${n.negocioId}`}
                  className="ork-row"
                  onClick={() => onAbrir(n)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--surface-sunken)', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)', flex: 'none' }}>
                        <Icon name={PERFIL_ICON[n.perfil] ?? 'building'} size={18} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{n.nombre}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                          {PERFIL_LABEL[n.perfil] ?? n.perfil} · alta {fechaCorta(n.creadoEn)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={td}>
                    <Badge tone="brand">{PLAN_LABEL[n.plan] ?? n.plan}</Badge>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}><span className="data">{num(n.numEspecialistas)}</span></td>
                  <td style={{ ...td, textAlign: 'right' }}><span className="data">{num(n.numSucursales)}</span></td>
                  <td style={{ ...td, textAlign: 'right' }}><span className="data" style={{ fontWeight: 600 }}>{money(n.cargoMensual)}</span></td>
                  <td style={td}><EstadoBadge estado={n.estadoSuscripcion} /></td>
                  <td style={td}>
                    {n.ultimoCobro ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge tone={COBRO_TONE[n.ultimoCobro.estado as keyof typeof COBRO_TONE] ?? 'neutral'} dot>
                          {COBRO_LABEL[n.ultimoCobro.estado] ?? n.ultimoCobro.estado}
                        </Badge>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }} className="data">{n.ultimoCobro.periodo}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Sin cobros</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      items={[
                        { label: 'Ver detalle', icon: 'eye', onClick: () => onAbrir(n) },
                        { label: 'Generar cobro', icon: 'credit-card', onClick: () => onCobrar(n) },
                        esCortesia
                          ? { label: 'Quitar cortesía', icon: 'gift', danger: true, onClick: () => onQuitarCortesia(n) }
                          : { label: 'Dar cortesía', icon: 'gift', onClick: () => onDarCortesia(n) },
                        bloqueada
                          ? { label: 'Reactivar', icon: 'power', onClick: () => onReactivar(n) }
                          : { label: 'Suspender', icon: 'pause', danger: true, onClick: () => onSuspender(n) },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <style>{`.ork-row:hover td { background: var(--surface-sunken); }`}</style>
    </Card>
  );
}

// ── Ficha de detalle del tenant ──────────────────────────────────────────────

const CUPO_CANALES: { key: keyof CuposMensajeria; label: string; icon: string }[] = [
  { key: 'whatsappUtility', label: 'WhatsApp · utilidad', icon: 'message-circle' },
  { key: 'whatsappMarketing', label: 'WhatsApp · marketing', icon: 'message-square' },
  { key: 'sms', label: 'SMS', icon: 'smartphone' },
  { key: 'email', label: 'Email', icon: 'mail' },
];

function TenantDetail({
  resumen,
  cargarDetalle,
  onClose,
  onCobrar,
  onSuspender,
  onReactivar,
  onDarCortesia,
  onQuitarCortesia,
}: {
  resumen: ResumenTenant;
  cargarDetalle: (id: string) => Promise<DetalleTenant>;
  onClose: () => void;
  onCobrar: () => void;
  onSuspender: () => void;
  onReactivar: () => void;
  onDarCortesia: () => void;
  onQuitarCortesia: () => void;
}) {
  const [data, setData] = useState<DetalleTenant | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    setData(null);
    setError(false);
    cargarDetalle(resumen.negocioId)
      .then((d) => vivo && setData(d))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [resumen.negocioId, cargarDetalle]);

  const estadoActual = data?.negocio.estadoSuscripcion ?? resumen.estadoSuscripcion;
  const bloqueada = estadoActual === 'suspendida' || estadoActual === 'cancelada';
  const esCortesia = estadoActual === 'cortesia';

  return (
    <Dialog
      open
      onClose={onClose}
      width={680}
      title={resumen.nombre}
      subtitle={`${PERFIL_LABEL[resumen.perfil] ?? resumen.perfil} · ${PLAN_LABEL[resumen.plan] ?? resumen.plan} · alta ${fechaCorta(resumen.creadoEn)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          {esCortesia ? (
            <Button variant="secondary" iconLeft="gift" onClick={onQuitarCortesia}>Quitar cortesía</Button>
          ) : (
            <Button variant="secondary" iconLeft="gift" onClick={onDarCortesia}>Dar cortesía</Button>
          )}
          <Button variant="secondary" iconLeft="credit-card" onClick={onCobrar}>Generar cobro</Button>
          {bloqueada ? (
            <Button variant="primary" iconLeft="power" onClick={onReactivar}>Reactivar</Button>
          ) : (
            <Button variant="danger" iconLeft="pause" onClick={onSuspender}>Suspender</Button>
          )}
        </>
      }
    >
      {error ? (
        <div style={{ padding: '8px 0 16px' }}>
          <ErrorState onRetry={() => { setError(false); cargarDetalle(resumen.negocioId).then(setData).catch(() => setError(true)); }} />
        </div>
      ) : !data ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}><Spinner /></div>
      ) : (
        <div style={{ display: 'grid', gap: 20, padding: '4px 0 12px' }}>
          {/* Salud del tenant */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
            <KpiCard label="Cargo / mes" value={money(data.suscripcion.cargoMensual)} icon="wallet" />
            <KpiCard label="Especialistas" value={num(data.suscripcion.numEspecialistas)} icon="users" />
            <KpiCard label="Sucursales" value={num(data.numSucursales)} icon="map-pin" />
            <KpiCard label="Estado" value={<EstadoBadge estado={data.negocio.estadoSuscripcion} />} icon="shield-check" />
          </div>

          {/* Método de pago y próximo cobro */}
          <Card padding={16} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <Icon name="credit-card" size={18} color="var(--text-tertiary)" />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Método de pago</span>
              <span className="data" style={{ fontWeight: 600 }}>
                {data.suscripcion.metodoUltimos4 ? `•••• ${data.suscripcion.metodoUltimos4}` : 'Sin tarjeta'}
              </span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <Icon name="calendar-clock" size={18} color="var(--text-tertiary)" />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Próximo cobro</span>
              <span className="data" style={{ fontWeight: 600 }}>
                {data.suscripcion.proximoCobro ? fechaCorta(data.suscripcion.proximoCobro) : '—'}
              </span>
            </div>
          </Card>

          {/* Uso de cupos de mensajería */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Cupos de mensajería</h3>
              <Tag tone="brand" icon="calendar-days">{data.cupos.periodo}</Tag>
            </div>
            <Card padding={16} style={{ display: 'grid', gap: 14 }}>
              {CUPO_CANALES.map((c) => (
                <CupoBar
                  key={c.key}
                  label={c.label}
                  icon={c.icon}
                  usado={data.cupos.consumo[c.key]}
                  limite={data.cupos.limites[c.key]}
                />
              ))}
            </Card>
          </section>

          {/* Historial de cobros */}
          <section>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 10 }}>Historial de cobros</h3>
            {data.cobros.length === 0 ? (
              <EmptyState compact icon="credit-card" title="Sin cobros emitidos" desc="Aún no se ha generado ningún cobro de suscripción." />
            ) : (
              <Card padding={0} style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Período', 'Monto', 'Estado', 'Pagado'].map((h, i) => (
                        <th key={h} style={{ textAlign: i === 1 ? 'right' : 'left', padding: '10px 16px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.cobros.map((c) => (
                      <tr key={c.id}>
                        <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--text-sm)' }}><span className="data">{c.periodo}</span></td>
                        <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', textAlign: 'right', fontSize: 'var(--text-sm)' }}><span className="data" style={{ fontWeight: 600 }}>{money(c.monto)}</span></td>
                        <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                          <Badge tone={COBRO_TONE[c.estado as keyof typeof COBRO_TONE] ?? 'neutral'} dot>{COBRO_LABEL[c.estado] ?? c.estado}</Badge>
                        </td>
                        <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{c.pagadoEn ? fechaCorta(c.pagadoEn) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
}

// ── Modal de cortesía (operador) ─────────────────────────────────────────────

function CortesiaDialog({
  tenant,
  onClose,
  onConfirm,
}: {
  tenant: ResumenTenant;
  onClose: () => void;
  onConfirm: (body: CortesiaBody) => void;
}) {
  const [plan, setPlan] = useState(tenant.plan === 'basico' ? 'pro' : tenant.plan);
  const [numEspecialistas, setNum] = useState(Math.max(1, tenant.numEspecialistas));

  return (
    <Dialog
      open
      onClose={onClose}
      width={440}
      title="Dar cortesía"
      subtitle={`${tenant.nombre} accederá con los beneficios del plan, sin generar cobro.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" iconLeft="gift" onClick={() => onConfirm({ plan, numEspecialistas })}>
            Asignar cortesía
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 16, padding: '4px 0 8px' }}>
        <Field label="Plan">
          <Select data-testid="cortesia-plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
            {PLANES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Nº de especialistas" hint="Cupo que habilita la cortesía (mínimo 1).">
          <Input
            data-testid="cortesia-num"
            type="number"
            min={1}
            value={numEspecialistas}
            onChange={(e) => setNum(Math.max(1, Number(e.target.value) || 1))}
          />
        </Field>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          <Icon name="info" size={14} />
          La cuenta queda en estado <strong style={{ color: 'var(--text-secondary)' }}>Cortesía</strong> y excluida del cobro automático.
        </div>
      </div>
    </Dialog>
  );
}

function CupoBar({ label, icon, usado, limite }: { label: string; icon: string; usado: number; limite: number }) {
  const ratio = limite > 0 ? Math.min(1, usado / limite) : 0;
  const excedido = limite > 0 && usado > limite;
  const cerca = ratio >= 0.85;
  const color = excedido ? 'var(--error)' : cerca ? 'var(--warning)' : 'var(--brand)';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          <Icon name={icon} size={15} color="var(--text-tertiary)" />
          {label}
        </span>
        <span className="data" style={{ fontSize: 'var(--text-xs)', color: excedido ? 'var(--error)' : 'var(--text-tertiary)', fontWeight: 600 }}>
          {num(usado)} / {num(limite)}
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(ratio * 100)}%`, height: '100%', borderRadius: 99, background: color, transition: 'width var(--dur-base) var(--ease-out)' }} />
      </div>
    </div>
  );
}
