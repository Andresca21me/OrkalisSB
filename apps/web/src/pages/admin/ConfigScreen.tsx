import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useAuth } from '../../lib/auth';
import { money } from '../../lib/format';
import {
  efectivoDe,
  resetConfig,
  setConfig,
  setReparticion,
  useConfig,
  type ConfigEfectivo,
  type Procedencia,
} from '../../lib/useConfig';
import { Button, Card, ErrorState, Icon, Spinner, Switch, useToast } from '../../ui/ui';
import { GNumber } from './gestion-ui';
import { ConfigBanner, ConfigCard, ProvControl, ProvField, SettingRow, type Scope } from './config-ui';
import { ConfigSucursales, ConfigUsuarios } from './config-org';
import { ConfigReservas } from './config-reservas';
import { ConfigNotif, ConfigDeveloper } from './config-cuenta';
import { SuscripcionScreen } from './SuscripcionScreen';

interface Sucursal { id: string; nombre: string; activa: boolean }

const SECCIONES = [
  { id: 'modulos', label: 'Módulos', icon: 'layout-grid', scoped: true },
  { id: 'financieros', label: 'Financieros', icon: 'percent', scoped: true },
  { id: 'agenda', label: 'Agenda', icon: 'calendar', scoped: true },
  { id: 'notif', label: 'Notificaciones', icon: 'bell', scoped: false },
  { id: 'sucursales', label: 'Sucursales', icon: 'store', scoped: false },
  { id: 'reservas', label: 'Reservas', icon: 'link', scoped: false },
  { id: 'usuarios', label: 'Usuarios', icon: 'users', scoped: false },
  { id: 'suscripcion', label: 'Suscripción', icon: 'zap', scoped: false },
  { id: 'developer', label: 'Developer', icon: 'terminal', scoped: false },
] as const;

const META: Record<string, { title: string; desc: string }> = {
  modulos: { title: 'Módulos', desc: 'Enciende o apaga funcionalidades por negocio o por sucursal.' },
  financieros: { title: 'Parámetros financieros', desc: 'Reparto, comisiones y deducciones. El reparto profesional y del negocio debe sumar 100%.' },
  agenda: { title: 'Reglas de agendamiento', desc: 'Cómo se confirman, recuerdan y cancelan las citas.' },
  reservas: { title: 'Enlaces y QR de reserva', desc: 'Comparte el enlace o imprime el código QR de cada sucursal para que tus clientes reserven.' },
};

export function ConfigScreen() {
  const { usuario } = useAuth();
  const [section, setSection] = useState('modulos');
  const [scope, setScope] = useState<Scope>('negocio');
  const sucs = useApi<Sucursal[]>(() => api.get('/sucursales'));
  const [branchId, setBranchId] = useState<string>('');

  useEffect(() => {
    if (!branchId && sucs.data && sucs.data.length) setBranchId(sucs.data[0].id);
  }, [sucs.data, branchId]);

  const sec = SECCIONES.find((s) => s.id === section)!;
  const ambitoId = scope === 'negocio' ? usuario!.negocioId : branchId;
  const sucursalIdParam = scope === 'sucursal' ? branchId : null;

  return (
    <div className="ork-config-body">
      <Card padding={8} style={{ position: 'sticky', top: 88 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SECCIONES.map((s) => {
            const on = s.id === section;
            return (
              <button key={s.id} type="button" onClick={() => setSection(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', textAlign: 'left', background: on ? 'var(--brand-tint)' : 'transparent', color: on ? 'var(--brand)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                <Icon name={s.icon} size={17} color={on ? 'var(--brand)' : 'var(--text-tertiary)'} />{s.label}
              </button>
            );
          })}
        </div>
      </Card>

      <div>
        {META[section] && (
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>{META[section].title}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: 4 }}>{META[section].desc}</p>
          </div>
        )}

        {sec.scoped && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', padding: 3, gap: 2, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              {(['negocio', 'sucursal'] as Scope[]).map((sc) => {
                const on = scope === sc;
                return (
                  <button key={sc} type="button" onClick={() => setScope(sc)} style={{ height: 34, padding: '0 14px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-xs)', background: on ? 'var(--surface-card)' : 'transparent', boxShadow: on ? 'var(--shadow-xs)' : 'none', color: on ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, textTransform: 'capitalize' }}>{sc}</button>
                );
              })}
            </div>
            {scope === 'sucursal' && (
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ height: 40, padding: '0 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                {(sucs.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            )}
          </div>
        )}

        {section === 'modulos' && <ConfigClaves seccion="modulos" scope={scope} nivel={scope} ambitoId={ambitoId} sucursalIdParam={sucursalIdParam} />}
        {section === 'agenda' && <ConfigClaves seccion="agenda" scope={scope} nivel={scope} ambitoId={ambitoId} sucursalIdParam={sucursalIdParam} />}
        {section === 'financieros' && <ConfigFinancieros scope={scope} nivel={scope} ambitoId={ambitoId} sucursalIdParam={sucursalIdParam} />}
        {section === 'notif' && <ConfigNotif />}
        {section === 'sucursales' && <ConfigSucursales sucursales={sucs.data ?? []} onChanged={() => void sucs.recargar()} />}
        {section === 'reservas' && <ConfigReservas sucursales={sucs.data ?? []} />}
        {section === 'usuarios' && <ConfigUsuarios sucursales={sucs.data ?? []} />}
        {section === 'suscripcion' && <SuscripcionScreen />}
        {section === 'developer' && <ConfigDeveloper />}
      </div>
    </div>
  );
}

const MODULOS = [
  { clave: 'modulo.inventario', icon: 'package', title: 'Inventario y productos', desc: 'Stock, movimientos, alertas y ventas de producto.' },
  { clave: 'modulo.particion_por_especialista', icon: 'users', title: 'Partición por especialista', desc: 'Reparte ganancias profesional/salón y habilita liquidaciones.' },
  { clave: 'modulo.cierre_periodo', icon: 'archive', title: 'Cierre de período', desc: 'Control quincenal y cierre mensual con archivo.' },
  { clave: 'agendamiento.aprobacion_manual', icon: 'shield-check', title: 'Aprobación manual de reservas', desc: 'Las reservas públicas entran como Solicitada y el equipo las aprueba.' },
];

/**
 * Módulos AVANZADOS que el plan gatea (espejo de `MODULOS_AVANZADOS` del backend).
 * El resto (p. ej. `agendamiento.aprobacion_manual`) es OPERATIVO: disponible en
 * todos los planes y nunca lleva candado.
 */
const MODULOS_AVANZADOS = ['modulo.inventario', 'modulo.particion_por_especialista', 'modulo.cierre_periodo'];

const AGENDA_NUM = [
  { clave: 'agendamiento.antelacion_cancelacion_horas', title: 'Antelación para cancelar', hint: 'Horas mínimas antes de la cita para cancelar/reagendar.', suffix: 'horas', step: 1 },
  { clave: 'agendamiento.ventana_recordatorio_horas', title: 'Ventana de recordatorio', hint: 'Horas antes de la cita para enviar el recordatorio.', suffix: 'h antes', step: 1 },
  { clave: 'agendamiento.duracion_retencion_min', title: 'Retención de franja', hint: 'Minutos que se reserva la franja mientras el cliente confirma.', suffix: 'min', step: 5 },
];

function ConfigClaves({ seccion, scope, nivel, ambitoId, sucursalIdParam }: { seccion: 'modulos' | 'agenda'; scope: Scope; nivel: Procedencia; ambitoId: string; sucursalIdParam: string | null }) {
  const toast = useToast();
  const { data, cargando, error, recargar } = useConfig(sucursalIdParam);
  // Módulos que el PLAN habilita (Plan-Pagos FASE-08); los demás van con candado.
  const susc = useApi<{ limites: { modulos: string[] } }>(() => api.get('/suscripcion'));
  const modulosPlan = susc.data?.limites.modulos ?? null;

  async function guardarValor(clave: string, valor: boolean | number) {
    try { await setConfig(nivel, ambitoId, clave, valor); await recargar(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  async function override(clave: string, valorActual: boolean | number) {
    try { await setConfig('sucursal', ambitoId, clave, valorActual); toast('Ahora se define en esta sucursal', 'info'); await recargar(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  async function inherit(clave: string) {
    try { await resetConfig('sucursal', ambitoId, clave); toast('Vuelve a heredar del negocio', 'info'); await recargar(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  if (error) return <ErrorState onRetry={recargar} />;
  if (cargando || !data) return <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>;

  if (seccion === 'modulos') {
    return (
      <>
        {scope === 'sucursal' && <div style={{ marginBottom: 18 }}><ConfigBanner tone="info" title="Estás configurando una sucursal">Cada módulo hereda del negocio salvo que lo sobrescribas aquí. Solo afecta a esta sucursal.</ConfigBanner></div>}
        <ConfigCard pad={22}>
          {MODULOS.map((m, i) => {
            const ef = efectivoDe(data, m.clave);
            const on = ef?.valor === true;
            const dim = scope === 'sucursal' && ef?.procedencia !== 'sucursal';
            // Solo los módulos AVANZADOS se gatean por plan; los operativos siempre
            // están disponibles. Si el plan no incluye un avanzado → candado.
            const esAvanzado = MODULOS_AVANZADOS.includes(m.clave);
            const permitidoPlan = !esAvanzado || modulosPlan == null || modulosPlan.includes(m.clave);
            return (
              <SettingRow key={m.clave} first={i === 0} icon={m.icon} title={m.title} desc={m.desc}
                prov={permitidoPlan && ef && <ProvControl scope={scope} procedencia={ef.procedencia} onOverride={() => override(m.clave, on)} onInherit={() => inherit(m.clave)} />}>
                {permitidoPlan ? (
                  <div style={{ opacity: dim ? 0.5 : 1, pointerEvents: dim ? 'none' : 'auto' }}>
                    <Switch testId={`modulo-${m.clave}-toggle`} checked={on} onChange={(v) => guardarValor(m.clave, v)} />
                  </div>
                ) : (
                  <span data-testid={`modulo-${m.clave}-bloqueado`} title="Disponible desde el plan Pro" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    <Icon name="lock" size={14} color="var(--text-tertiary)" />Plan Pro
                  </span>
                )}
              </SettingRow>
            );
          })}
        </ConfigCard>
      </>
    );
  }

  // Agenda
  const aprob = efectivoDe(data, 'agendamiento.aprobacion_manual');
  return (
    <>
      <ConfigCard title="Confirmación de reservas" desc="Define si las reservas del enlace público se confirman solas." pad={22}>
        <SettingRow first icon="shield-check" title="Aprobación manual" desc="Activa: las reservas entran como Solicitada y el equipo las aprueba. Inactiva: se confirman de inmediato."
          prov={aprob && <ProvControl scope={scope} procedencia={aprob.procedencia} onOverride={() => override('agendamiento.aprobacion_manual', aprob.valor === true)} onInherit={() => inherit('agendamiento.aprobacion_manual')} />}>
          <Switch checked={aprob?.valor === true} onChange={(v) => guardarValor('agendamiento.aprobacion_manual', v)} />
        </SettingRow>
      </ConfigCard>
      <AgendaNumeros data={data} scope={scope} onSave={guardarValor} onOverride={override} onInherit={inherit} />
    </>
  );
}

function AgendaNumeros({ data, scope, onSave, onOverride, onInherit }: { data: ConfigEfectivo[]; scope: Scope; onSave: (c: string, v: number) => void; onOverride: (c: string, v: number) => void; onInherit: (c: string) => void }) {
  const [draft, setDraft] = useState<Record<string, number>>({});
  useEffect(() => {
    const d: Record<string, number> = {};
    for (const f of AGENDA_NUM) d[f.clave] = Number(efectivoDe(data, f.clave)?.valor ?? 0);
    setDraft(d);
  }, [data]);

  return (
    <ConfigCard title="Tiempos y ventanas" desc="Valores que rigen recordatorios, retención y antelación." pad={22}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 28px' }}>
        {AGENDA_NUM.map((f) => {
          const ef = efectivoDe(data, f.clave);
          const dim = scope === 'sucursal' && ef?.procedencia !== 'sucursal';
          return (
            <ProvField key={f.clave} label={f.title} hint={f.hint}
              prov={ef && <ProvControl scope={scope} procedencia={ef.procedencia} onOverride={() => onOverride(f.clave, Number(ef.valor))} onInherit={() => onInherit(f.clave)} />}>
              <div style={{ display: 'flex', gap: 8, opacity: dim ? 0.5 : 1, pointerEvents: dim ? 'none' : 'auto' }}>
                <GNumber value={draft[f.clave] ?? 0} onChange={(v) => setDraft((d) => ({ ...d, [f.clave]: v }))} suffix={f.suffix} step={f.step} min={0} />
                <Button variant="secondary" size="sm" onClick={() => onSave(f.clave, draft[f.clave] ?? 0)}>Guardar</Button>
              </div>
            </ProvField>
          );
        })}
      </div>
    </ConfigCard>
  );
}

const FIN_PCT = [
  { clave: 'finanzas.deduccion_administrativa', label: 'Deducción administrativa', hint: '% que retiene el negocio antes de repartir.' },
  { clave: 'finanzas.comision_bancaria', label: 'Comisión bancaria', hint: '% por pago electrónico (transferencia/tarjeta).' },
  { clave: 'finanzas.tarifa_cliente_profesional', label: 'Tarifa cliente→profesional', hint: '% adicional que el cliente paga al profesional.' },
];

function ConfigFinancieros({ scope, nivel, ambitoId, sucursalIdParam }: { scope: Scope; nivel: Procedencia; ambitoId: string; sucursalIdParam: string | null }) {
  const toast = useToast();
  const { data, cargando, error, recargar } = useConfig(sucursalIdParam);
  const [prof, setProf] = useState(50);
  const [pcts, setPcts] = useState<Record<string, number>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!data) return;
    setProf(Number(efectivoDe(data, 'finanzas.reparticion_profesional')?.valor ?? 50));
    const p: Record<string, number> = {};
    for (const f of FIN_PCT) p[f.clave] = Number(efectivoDe(data, f.clave)?.valor ?? 0);
    setPcts(p);
  }, [data]);

  const salon = 100 - prof;
  const PREVIEW = 40000;
  const proAmt = Math.round((PREVIEW * prof) / 100);

  async function guardar() {
    setGuardando(true);
    try {
      await setReparticion(nivel, ambitoId, prof, salon);
      for (const f of FIN_PCT) await setConfig(nivel, ambitoId, f.clave, pcts[f.clave] ?? 0);
      toast('Parámetros financieros guardados', 'success');
      await recargar();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  if (error) return <ErrorState onRetry={recargar} />;
  if (cargando || !data) return <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>;

  return (
    <>
      <ConfigCard title="Reparto del servicio" desc="El reparto profesional y del negocio debe sumar 100%." pad={22}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
          <ProvField label="% Profesional"><span data-testid="repart-profesional"><GNumber value={prof} onChange={(v) => setProf(Math.min(100, v))} suffix="%" min={0} /></span></ProvField>
          <ProvField label="% Negocio (salón)"><span data-testid="repart-salon"><GNumber value={salon} onChange={(v) => setProf(Math.max(0, 100 - v))} suffix="%" min={0} /></span></ProvField>
        </div>
        <div style={{ marginTop: 14, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--border-subtle)' }}>
            <div style={{ width: `${prof}%`, background: 'var(--brand)' }} />
            <div style={{ width: `${salon}%`, background: 'var(--navy)' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--brand)' }} />Profesional {prof}% · {money(proAmt)}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--navy)' }} />Negocio {salon}% · {money(PREVIEW - proAmt)}</span>
          </div>
        </div>
      </ConfigCard>

      <ConfigCard title="Deducciones y comisiones" desc="Se aplican según la operación de cada cobro." pad={22}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 28px' }}>
          {FIN_PCT.map((f) => (
            <ProvField key={f.clave} label={f.label} hint={f.hint}>
              <GNumber value={pcts[f.clave] ?? 0} onChange={(v) => setPcts((p) => ({ ...p, [f.clave]: Math.min(100, v) }))} suffix="%" min={0} />
            </ProvField>
          ))}
        </div>
      </ConfigCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button variant="primary" iconLeft="check" loading={guardando} onClick={guardar}>Guardar cambios</Button>
      </div>
      {scope === 'sucursal' && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 8 }}>Se guarda como override de esta sucursal.</p>}
    </>
  );
}
