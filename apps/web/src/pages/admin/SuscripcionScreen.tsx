import { useEffect, useState } from 'react';
import { PlanSuscripcion } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { money, num, fechaCorta } from '../../lib/format';
import { PageHead } from '../../ui/Shell';
import { Badge, Button, Card, Dialog, EstadoBadge, ErrorState, Icon, Spinner, useToast } from '../../ui/ui';
import { CheckoutMercadoPago, type DatosTarjeta } from '../site/checkout-mp';

interface CobroResumen {
  periodo: string;
  monto: number;
  estado: string;
  creadoEn: string;
  pagadoEn: string | null;
}

interface Resumen {
  plan: PlanSuscripcion;
  estado: string;
  numEspecialistas: number;
  cargoMensual: number;
  maxSucursales: number;
  cupos: { whatsappUtility: number; whatsappMarketing: number; sms: number; email: number };
  funciones: { reportes: string; multiSede?: number; api: boolean; fidelizacion: boolean };
  limites: { especialistas: number; maxSucursales: number | null; modulos: string[] };
  uso: { especialistas: number; sucursales: number };
  metodoUltimos4: string | null;
  proximoCobro: string | null;
  ultimoCobro: CobroResumen | null;
  cobros: CobroResumen[];
  bloqueado: boolean;
  motivoBloqueo: string | null;
}

interface PlanPublico {
  plan: PlanSuscripcion;
  precioBase: number;
  especialistasIncluidos: number;
  costoEspecialistaAdicional: number;
  maxSucursales: number | null;
  modulos: string[];
  funciones: {
    smsRespaldo: boolean;
    marketing: boolean;
    reportes: 'no' | 'basico' | 'avanzado';
    fidelizacion: boolean;
    rolesPorUsuario: boolean;
    api: boolean;
  };
  cupos: { whatsappUtility: number; whatsappMarketing: number; sms: number; email: number };
}

interface PreviewCambio {
  tipo: 'upgrade' | 'downgrade' | 'lateral';
  estado: string;
  plan: PlanSuscripcion;
  numEspecialistas: number;
  montoActual: number;
  montoNuevo: number;
  montoAhora: number;
  requierePago: boolean;
  proximoCobro: string | null;
}

const PLAN_LABEL: Record<string, string> = {
  basico: 'Básico',
  pro: 'Pro',
  premium: 'Premium',
  empresarial: 'Empresarial',
};
const REPORTES_LABEL: Record<string, string> = { no: 'Sin reportes', basico: 'Reportes básicos', avanzado: 'Reportes avanzados' };
const MODULO_LABEL: Record<string, string> = {
  'modulo.inventario': 'Inventario',
  'modulo.particion_por_especialista': 'Partición por especialista',
  'modulo.cierre_periodo': 'Cierre de período',
};
const COBRO_TONE: Record<string, 'success' | 'warning' | 'error'> = { pagado: 'success', pendiente: 'warning', fallido: 'error' };
const COBRO_LABEL: Record<string, string> = { pagado: 'Pagado', pendiente: 'Pendiente', fallido: 'Fallido' };

/** Cargo mensual a partir del catálogo (espejo de `calcularCargo`). */
function cargoDe(planes: PlanPublico[] | null | undefined, plan: string, n: number): number {
  const p = planes?.find((x) => x.plan === plan);
  if (!p) return 0;
  return p.precioBase + Math.max(0, n - p.especialistasIncluidos) * p.costoEspecialistaAdicional;
}

export function SuscripcionScreen() {
  const toast = useToast();
  const { data, cargando, error, recargar } = useApi<Resumen>(() => api.get('/suscripcion'));
  const { data: planes } = useApi<PlanPublico[]>(() => api.get('/suscripcion/planes'));
  const [nEsp, setNEsp] = useState(0);
  const [pagarOpen, setPagarOpen] = useState(false);
  // Cambio pendiente de confirmar (abre el diálogo con preview).
  const [cambio, setCambio] = useState<{ plan?: PlanSuscripcion; numEspecialistas?: number } | null>(null);
  useEffect(() => { if (data) setNEsp(data.numEspecialistas); }, [data?.numEspecialistas]);

  async function trasPago() {
    setPagarOpen(false);
    toast('Pago aprobado. ¡Gracias!', 'success');
    await recargar();
  }

  async function trasCambio() {
    setCambio(null);
    await recargar();
  }

  if (error) {
    return (
      <>
        <PageHead title="Suscripción" desc="Tu plan, cargo mensual y cupos de mensajería." />
        <ErrorState onRetry={() => void recargar()} />
      </>
    );
  }
  if (cargando || !data) return <Spinner />;

  return (
    <>
      <PageHead title="Suscripción" desc="Tu plan, cargo mensual y cupos de mensajería." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Kpi label="Plan actual" valor={PLAN_LABEL[data.plan]} extra={<EstadoBadge estado={data.estado} />} icon="zap" />
        <Kpi label="Cargo mensual" valor={money(data.cargoMensual)} icon="dollar-sign" />
        <Kpi label="Especialistas" valor={num(data.numEspecialistas)} icon="users" />
        <Kpi label="Máx. sucursales" valor={data.maxSucursales === Infinity ? 'Ilimitado' : num(data.maxSucursales)} icon="building" />
      </div>

      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 14 }}>Cupos de mensajería / mes</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          <Cupo label="WhatsApp utility" valor={data.cupos.whatsappUtility} />
          <Cupo label="WhatsApp marketing" valor={data.cupos.whatsappMarketing} />
          <Cupo label="SMS" valor={data.cupos.sms} />
          <Cupo label="Email" valor={data.cupos.email} />
        </div>
      </Card>

      {/* Facturación: método de pago, próximo cobro e historial — FASE-11. */}
      <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 14 }}>Facturación</h3>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <Icon name="credit-card" size={18} color="var(--text-tertiary)" />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Método de pago</span>
            <span className="data" style={{ fontWeight: 600 }}>
              {data.metodoUltimos4 ? `•••• ${data.metodoUltimos4}` : 'Sin tarjeta registrada'}
            </span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <Icon name="calendar-clock" size={18} color="var(--text-tertiary)" />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Próximo cobro</span>
            <span className="data" style={{ fontWeight: 600 }}>{data.proximoCobro ? fechaCorta(data.proximoCobro) : '—'}</span>
          </div>
          <Button
            variant={data.estado === 'en_gracia' ? 'primary' : 'secondary'}
            size="sm"
            iconLeft="credit-card"
            onClick={() => setPagarOpen(true)}
          >
            {data.metodoUltimos4 ? 'Pagar / actualizar método' : 'Agregar método y pagar'}
          </Button>
        </div>
        {data.estado === 'en_gracia' && (
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginTop: 14, padding: '11px 13px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-tint)', border: '1px solid rgba(180,83,9,0.3)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
            <Icon name="alert-circle" size={16} color="#B45309" />
            No pudimos cobrar tu último ciclo. Paga ahora para evitar la suspensión.
          </div>
        )}
      </Card>

      {data.cobros.length > 0 && (
        <Card padding={0} style={{ overflow: 'hidden', marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Período', 'Monto', 'Estado', 'Pagado'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 1 ? 'right' : 'left', padding: '11px 16px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cobros.map((c, i) => (
                <tr key={`${c.periodo}-${i}`}>
                  <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--text-sm)' }}><span className="data">{c.periodo}</span></td>
                  <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', textAlign: 'right', fontSize: 'var(--text-sm)' }}><span className="data" style={{ fontWeight: 600 }}>{money(c.monto)}</span></td>
                  <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <Badge tone={COBRO_TONE[c.estado] ?? 'neutral'} dot>{COBRO_LABEL[c.estado] ?? c.estado}</Badge>
                  </td>
                  <td style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{c.pagadoEn ? fechaCorta(c.pagadoEn) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Comparación de planes — el admin ve qué ofrece cada uno. */}
      <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 4 }}>Planes</h3>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
        Compara lo que incluye cada plan. Al cambiar verás el monto y lo que ocurre antes de confirmar.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        {(planes ?? []).map((p) => (
          <PlanCard key={p.plan} p={p} actual={p.plan === data.plan} onElegir={() => setCambio({ plan: p.plan })} />
        ))}
      </div>

      {/* Nº de especialistas que se pagan (cupo). */}
      <h3 style={{ fontSize: 'var(--text-md)', margin: '0 0 14px' }}>Especialistas que pagas</h3>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <button type="button" aria-label="Quitar" onClick={() => setNEsp((v) => Math.max(data.uso.especialistas, v - 1))} style={{ width: 40, height: 40, border: 'none', background: 'var(--surface-card)', cursor: 'pointer' }}><Icon name="minus" size={16} color="var(--text-secondary)" /></button>
              <span data-testid="cupo-num" className="data" style={{ minWidth: 48, textAlign: 'center', fontWeight: 700, fontSize: 'var(--text-lg)' }}>{nEsp}</span>
              <button type="button" aria-label="Agregar" onClick={() => setNEsp((v) => Math.min(99, v + 1))} style={{ width: 40, height: 40, border: 'none', background: 'var(--surface-card)', cursor: 'pointer', borderLeft: '1px solid var(--border-subtle)' }}><Icon name="plus" size={16} color="var(--text-secondary)" /></button>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 6 }}>
              {data.uso.especialistas} en uso. No puedes bajar por debajo de los activos.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Nuevo cargo mensual</div>
            <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-2xl)' }}>{money(cargoDe(planes, data.plan, nEsp))}</div>
          </div>
          <Button size="md" disabled={nEsp === data.numEspecialistas} onClick={() => setCambio({ numEspecialistas: nEsp })}>
            Revisar cambio
          </Button>
        </div>
      </Card>

      {cambio && (
        <CambioDialog
          cambio={cambio}
          onClose={() => setCambio(null)}
          onDone={() => void trasCambio()}
        />
      )}

      {pagarOpen && (
        <Dialog
          open
          onClose={() => setPagarOpen(false)}
          width={460}
          title="Pagar suscripción"
          subtitle={`Se cobrará ${money(data.cargoMensual)} a la tarjeta. Tu tarjeta queda guardada para los próximos ciclos.`}
        >
          <div style={{ padding: '4px 0 8px' }}>
            <CheckoutMercadoPago amount={data.cargoMensual} onPaid={() => void trasPago()} />
          </div>
        </Dialog>
      )}
    </>
  );
}

// ── Tarjeta de plan en la comparación ────────────────────────────────────────

function PlanCard({ p, actual, onElegir }: { p: PlanPublico; actual: boolean; onElegir: () => void }) {
  const feats: { ok: boolean; label: string }[] = [
    { ok: true, label: `${p.especialistasIncluidos} especialistas incluidos` },
    { ok: true, label: `Luego ${money(p.costoEspecialistaAdicional)} por especialista` },
    { ok: true, label: p.maxSucursales === null ? 'Sucursales ilimitadas' : `${p.maxSucursales} sucursal${p.maxSucursales === 1 ? '' : 'es'}` },
    { ok: p.funciones.reportes !== 'no', label: REPORTES_LABEL[p.funciones.reportes] },
    { ok: p.funciones.fidelizacion, label: 'Fidelización / puntos' },
    { ok: p.funciones.api, label: 'API e integraciones' },
    { ok: p.funciones.smsRespaldo, label: 'SMS de respaldo' },
    { ok: p.funciones.rolesPorUsuario, label: 'Roles y permisos' },
    ...p.modulos.map((m) => ({ ok: true, label: MODULO_LABEL[m] ?? m })),
  ];
  return (
    <Card selected={actual} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 'var(--text-md)' }}>{PLAN_LABEL[p.plan]}</strong>
        {actual && <Badge tone="brand">Actual</Badge>}
      </div>
      <div>
        <span className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-2xl)' }}>{money(p.precioBase)}</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}> /mes</span>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {feats.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: f.ok ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
            <Icon name={f.ok ? 'check' : 'minus'} size={14} color={f.ok ? 'var(--success)' : 'var(--text-tertiary)'} />
            <span style={{ textDecoration: f.ok ? 'none' : 'line-through', opacity: f.ok ? 1 : 0.7 }}>{f.label}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <Button variant={actual ? 'secondary' : 'primary'} size="sm" fullWidth disabled={actual} onClick={onElegir}>
        {actual ? 'En uso' : `Cambiar a ${PLAN_LABEL[p.plan]}`}
      </Button>
    </Card>
  );
}

// ── Diálogo de confirmación del cambio (preview + cobro prorrateado) ──────────

function CambioDialog({
  cambio,
  onClose,
  onDone,
}: {
  cambio: { plan?: PlanSuscripcion; numEspecialistas?: number };
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [prev, setPrev] = useState<PreviewCambio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [pagando, setPagando] = useState(false); // muestra el brick (subida)

  useEffect(() => {
    let vivo = true;
    setError(null);
    api
      .post<PreviewCambio>('/suscripcion/cambiar/preview', cambio)
      .then((p) => vivo && setPrev(p))
      .catch((e) => vivo && setError((e as Error).message));
    return () => { vivo = false; };
  }, []);

  async function aplicarSinCobro() {
    setAplicando(true);
    try {
      await api.post('/suscripcion/cambiar', cambio);
      toast('Suscripción actualizada', 'success');
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setAplicando(false);
    }
  }

  async function pagarYcambiar(datos: DatosTarjeta) {
    await api.post('/suscripcion/cambiar', { ...cambio, ...datos });
  }

  const tituloTipo = prev
    ? prev.tipo === 'upgrade' ? 'Subir de plan' : prev.tipo === 'downgrade' ? 'Bajar de plan' : 'Cambiar de plan'
    : 'Cambiar de plan';

  return (
    <Dialog
      open
      onClose={onClose}
      width={480}
      title={tituloTipo}
      subtitle={prev ? `Plan ${PLAN_LABEL[prev.plan]} · ${prev.numEspecialistas} especialistas` : undefined}
      footer={
        !prev || pagando
          ? <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          : prev.requierePago
            ? (
              <>
                <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button variant="primary" iconLeft="credit-card" onClick={() => setPagando(true)}>Pagar y cambiar</Button>
              </>
            )
            : (
              <>
                <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button variant="primary" disabled={aplicando} onClick={() => void aplicarSinCobro()}>
                  {aplicando ? 'Aplicando…' : 'Confirmar cambio'}
                </Button>
              </>
            )
      }
    >
      {error ? (
        <div role="alert" style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '11px 13px', borderRadius: 'var(--radius-sm)', background: 'var(--error-tint)', border: '1px solid var(--error)', fontSize: 'var(--text-sm)', color: 'var(--error)' }}>
          <Icon name="alert-circle" size={16} color="var(--error)" />{error}
        </div>
      ) : !prev ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', color: 'var(--text-secondary)' }}>
          <Spinner size={18} /> Calculando tu cambio…
        </div>
      ) : pagando ? (
        <div style={{ padding: '4px 0 8px' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
            Se cobrará <strong style={{ color: 'var(--text-primary)' }}>{money(prev.montoAhora)}</strong> ahora (prorrateo por los días que faltan del ciclo).
          </p>
          <CheckoutMercadoPago amount={prev.montoAhora} onSubmit={pagarYcambiar} onPaid={() => { toast('Plan actualizado', 'success'); onDone(); }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14, padding: '4px 0 4px' }}>
          {/* Montos: antes → después */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Cargo mensual</div>
              <div className="data" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>{money(prev.montoActual)}</div>
              <div className="data" style={{ fontWeight: 800, fontSize: 'var(--text-xl)' }}>{money(prev.montoNuevo)}</div>
            </div>
            <Badge tone={prev.tipo === 'upgrade' ? 'brand' : prev.tipo === 'downgrade' ? 'warning' : 'neutral'}>
              {prev.tipo === 'upgrade' ? 'Subida' : prev.tipo === 'downgrade' ? 'Bajada' : 'Mismo cargo'}
            </Badge>
          </div>

          {/* Explicación clara del proceso */}
          {prev.requierePago ? (
            <Aviso icon="credit-card" tono="brand">
              Se cobrará <strong>{money(prev.montoAhora)}</strong> ahora (prorrateo por los días que faltan del ciclo) para activar el cambio de inmediato.
              Tu fecha de cobro no cambia{prev.proximoCobro ? ` (sigue el ${fechaCorta(prev.proximoCobro)})` : ''}; desde entonces pagarás {money(prev.montoNuevo)} al mes.
            </Aviso>
          ) : prev.tipo === 'downgrade' ? (
            <Aviso icon="arrow-down" tono="warning">
              El cambio aplica <strong>de inmediato</strong> (ajustamos tus límites ahora). No se cobra nada hoy; desde tu próximo ciclo
              {prev.proximoCobro ? ` (${fechaCorta(prev.proximoCobro)})` : ''} pagarás <strong>{money(prev.montoNuevo)}</strong> al mes.
            </Aviso>
          ) : prev.estado === 'prueba' ? (
            <Aviso icon="sparkles" tono="brand">
              El cambio aplica de inmediato. Mientras estás en prueba no se cobra; empezarás a pagar <strong>{money(prev.montoNuevo)}</strong> al mes cuando actives tu método de pago.
            </Aviso>
          ) : prev.estado === 'cortesia' ? (
            <Aviso icon="gift" tono="brand">
              El cambio aplica de inmediato. Tu cuenta es de <strong>cortesía</strong>, así que no se genera cobro; el cargo de referencia de este plan es <strong>{money(prev.montoNuevo)}</strong> al mes.
            </Aviso>
          ) : prev.tipo === 'lateral' ? (
            <Aviso icon="check" tono="neutral">
              El cambio aplica de inmediato manteniendo tu cargo de <strong>{money(prev.montoNuevo)}</strong> al mes.
            </Aviso>
          ) : (
            <Aviso icon="arrow-up" tono="brand">
              El cambio aplica de inmediato. Tu nuevo cargo mensual será <strong>{money(prev.montoNuevo)}</strong>
              {prev.proximoCobro ? `, a partir de tu próximo ciclo (${fechaCorta(prev.proximoCobro)})` : ''}.
            </Aviso>
          )}
        </div>
      )}
    </Dialog>
  );
}

function Aviso({ icon, tono, children }: { icon: string; tono: 'brand' | 'warning' | 'neutral'; children: React.ReactNode }) {
  const fondo = tono === 'brand' ? 'var(--brand-tint)' : tono === 'warning' ? 'var(--warning-tint)' : 'var(--surface-sunken)';
  const acento = tono === 'brand' ? 'var(--brand)' : tono === 'warning' ? '#B45309' : 'var(--text-tertiary)';
  return (
    <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: fondo, border: '1px solid var(--border-subtle)' }}>
      <Icon name={icon} size={18} color={acento} style={{ flex: 'none', marginTop: 1 }} />
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: '20px' }}>{children}</span>
    </div>
  );
}

function Kpi({ label, valor, extra, icon }: { label: string; valor: string; extra?: React.ReactNode; icon: string }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', marginBottom: 10 }}>
        <Icon name={icon} size={16} />
        <span className="eyebrow">{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-2xl)' }}>{valor}</span>
        {extra}
      </div>
    </Card>
  );
}

function Cupo({ label, valor }: { label: string; valor: number }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
      <div className="data" style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>{num(valor)}</div>
    </div>
  );
}
