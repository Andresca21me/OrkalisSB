import { useEffect, useRef, useState } from 'react';
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
import { Button, Card, ErrorState, Icon, Segmented, Spinner, Switch, useToast } from '../../ui/ui';
import { GNumber } from './gestion-ui';
import { ConfigBanner, ConfigCard, ProvControl, ProvField, SettingRow, type Scope } from './config-ui';
import { ConfigSucursales, ConfigUsuarios } from './config-org';
import { ConfigReservas } from './config-reservas';
import { ConfigNotif, ConfigDeveloper, ConfigMarca, RegistroMensajes } from './config-cuenta';
import { SuscripcionScreen } from './SuscripcionScreen';
import { useVocabulario, type Vocabulario } from '../../lib/vocabulario';

interface Sucursal { id: string; nombre: string; activa: boolean }

const SECCIONES = [
  { id: 'modulos', label: 'Módulos', icon: 'layout-grid', scoped: true },
  { id: 'financieros', label: 'Financieros', icon: 'percent', scoped: true },
  { id: 'agenda', label: 'Agenda', icon: 'calendar', scoped: true },
  { id: 'horario', label: 'Días laborables', icon: 'calendar', scoped: false },
  { id: 'marca', label: 'Marca', icon: 'sparkles', scoped: false },
  { id: 'notif', label: 'Notificaciones', icon: 'bell', scoped: false },
  { id: 'mensajes', label: 'Registro de mensajes', icon: 'message-circle', scoped: false },
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
  horario: { title: 'Días laborables y servicios', desc: 'Marca los días que abre cada sucursal y activa o desactiva servicios por día. En los días cerrados el cliente no puede reservar.' },
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
      <ConfigNav section={section} onSelect={setSection} />

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
        {section === 'horario' && <ConfigHorario />}
        {section === 'financieros' && <ConfigFinancieros scope={scope} nivel={scope} ambitoId={ambitoId} sucursalIdParam={sucursalIdParam} />}
        {section === 'marca' && <ConfigMarca />}
        {section === 'notif' && <ConfigNotif />}
        {section === 'mensajes' && <RegistroMensajes />}
        {section === 'sucursales' && <ConfigSucursales sucursales={sucs.data ?? []} onChanged={() => void sucs.recargar()} />}
        {section === 'reservas' && <ConfigReservas sucursales={sucs.data ?? []} />}
        {section === 'usuarios' && <ConfigUsuarios sucursales={sucs.data ?? []} />}
        {section === 'suscripcion' && <SuscripcionScreen />}
        {section === 'developer' && <ConfigDeveloper />}
      </div>
    </div>
  );
}

/**
 * Nav interno de Configuración. En escritorio es una columna sticky; en móvil
 * (≤720px, vía CSS) es una tira horizontal deslizable. Como el scroll lateral
 * no es obvio, mostramos degradados con chevron en los bordes cuando quedan
 * secciones fuera de vista, y desplazamos la activa a la vista al cambiar.
 */
function ConfigNav({ section, onSelect }: { section: string; onSelect: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setHint({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  // Al cambiar de sección, trae la activa a la vista (útil en la tira horizontal).
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [section]);

  return (
    <Card padding={8} className="ork-confignav" style={{ position: 'sticky', top: 88 }}>
      <div className="ork-confignav-scroll">
        <div ref={ref} className="ork-confignav-list" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SECCIONES.map((s) => {
            const on = s.id === section;
            return (
              <button key={s.id} type="button" data-active={on} onClick={() => onSelect(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', textAlign: 'left', background: on ? 'var(--brand-tint)' : 'transparent', color: on ? 'var(--brand)' : 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                <Icon name={s.icon} size={17} color={on ? 'var(--brand)' : 'var(--text-tertiary)'} />{s.label}
              </button>
            );
          })}
        </div>
        <div className={`ork-confignav-fade left${hint.left ? ' show' : ''}`} aria-hidden="true"><Icon name="chevron-left" size={16} color="var(--brand)" /></div>
        <div className={`ork-confignav-fade right${hint.right ? ' show' : ''}`} aria-hidden="true"><Icon name="chevron-right" size={16} color="var(--brand)" /></div>
      </div>
    </Card>
  );
}

const MODULOS = [
  { clave: 'modulo.inventario', icon: 'package', title: 'Inventario y productos', desc: 'Stock, movimientos, alertas y ventas de producto.' },
  { clave: 'modulo.particion_por_especialista', icon: 'users', title: 'Partición por especialista', desc: (v: Vocabulario) => `Reparte ganancias profesional/${v.negocio} y habilita liquidaciones.` },
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
  const voc = useVocabulario();
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
              <SettingRow key={m.clave} first={i === 0} icon={m.icon} title={m.title} desc={typeof m.desc === 'function' ? m.desc(voc) : m.desc}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px 28px' }}>
        {AGENDA_NUM.map((f) => {
          const ef = efectivoDe(data, f.clave);
          const dim = scope === 'sucursal' && ef?.procedencia !== 'sucursal';
          return (
            <ProvField key={f.clave} label={f.title} hint={f.hint}
              prov={ef && <ProvControl scope={scope} procedencia={ef.procedencia} onOverride={() => onOverride(f.clave, Number(ef.valor))} onInherit={() => onInherit(f.clave)} />}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, opacity: dim ? 0.5 : 1, pointerEvents: dim ? 'none' : 'auto' }}>
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
  const voc = useVocabulario();
  const toast = useToast();
  const { data, cargando, error, recargar } = useConfig(sucursalIdParam);
  const [prof, setProf] = useState(50);
  const [pcts, setPcts] = useState<Record<string, number>>({});
  const [comTipo, setComTipo] = useState<'porcentaje' | 'valor_fijo'>('porcentaje');
  const [comValor, setComValor] = useState(0);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!data) return;
    setProf(Number(efectivoDe(data, 'finanzas.reparticion_profesional')?.valor ?? 50));
    const p: Record<string, number> = {};
    for (const f of FIN_PCT) p[f.clave] = Number(efectivoDe(data, f.clave)?.valor ?? 0);
    setPcts(p);
    setComTipo((efectivoDe(data, 'finanzas.comision_producto_tipo')?.valor as 'porcentaje' | 'valor_fijo') ?? 'porcentaje');
    setComValor(Number(efectivoDe(data, 'finanzas.comision_producto_valor')?.valor ?? 0));
  }, [data]);

  const salon = 100 - prof;
  const PREVIEW = 40000;
  const proAmt = Math.round((PREVIEW * prof) / 100);

  async function guardar() {
    setGuardando(true);
    try {
      await setReparticion(nivel, ambitoId, prof, salon);
      for (const f of FIN_PCT) await setConfig(nivel, ambitoId, f.clave, pcts[f.clave] ?? 0);
      if (inventarioOn) {
        await setConfig(nivel, ambitoId, 'finanzas.comision_producto_tipo', comTipo);
        await setConfig(nivel, ambitoId, 'finanzas.comision_producto_valor', comValor);
      }
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

  // La comisión por producto solo tiene sentido con el módulo de inventario
  // activo; sin él, la tarjeta no se muestra (las claves quedan inertes en BD).
  const inventarioOn = efectivoDe(data, 'modulo.inventario')?.valor === true;

  return (
    <>
      <ConfigCard title="Reparto del servicio" desc="El reparto profesional y del negocio debe sumar 100%." pad={22}>
        <div className="ork-cols-2" style={{ gap: '0 28px' }}>
          <ProvField label="% Profesional"><span data-testid="repart-profesional"><GNumber value={prof} onChange={(v) => setProf(Math.min(100, v))} suffix="%" min={0} /></span></ProvField>
          <ProvField label={`% Negocio (${voc.negocio})`}><span data-testid="repart-salon"><GNumber value={salon} onChange={(v) => setProf(Math.max(0, 100 - v))} suffix="%" min={0} /></span></ProvField>
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
        <div className="ork-cols-3" style={{ gap: '8px 28px' }}>
          {FIN_PCT.map((f) => (
            <ProvField key={f.clave} label={f.label} hint={f.hint}>
              <GNumber value={pcts[f.clave] ?? 0} onChange={(v) => setPcts((p) => ({ ...p, [f.clave]: Math.min(100, v) }))} suffix="%" min={0} />
            </ProvField>
          ))}
        </div>
      </ConfigCard>

      {inventarioOn && (
        <ConfigCard title="Comisión por venta de productos" desc="Lo que gana el especialista cuando vende un producto. En 0, todo el ingreso del producto queda para el negocio." pad={22}>
          <div className="ork-cols-2" style={{ gap: '8px 28px', alignItems: 'end' }}>
            <ProvField label="Tipo de comisión">
              <Segmented
                options={[{ value: 'porcentaje', label: 'Porcentaje' }, { value: 'valor_fijo', label: 'Monto por unidad' }]}
                value={comTipo}
                onChange={(v) => setComTipo(v as 'porcentaje' | 'valor_fijo')}
              />
            </ProvField>
            <ProvField label={comTipo === 'porcentaje' ? '% sobre la venta' : 'COP por unidad vendida'} hint={comTipo === 'porcentaje' ? 'Entre 0 y 100.' : 'Nunca cobra más que el valor de la línea.'}>
              <GNumber
                value={comValor}
                onChange={(v) => setComValor(comTipo === 'porcentaje' ? Math.min(100, Math.max(0, v)) : Math.max(0, v))}
                suffix={comTipo === 'porcentaje' ? '%' : '$'}
                min={0}
                step={comTipo === 'porcentaje' ? 1 : 500}
              />
            </ProvField>
          </div>
        </ConfigCard>
      )}

      {inventarioOn && (
        <ConfigCard title="Regla de stock" desc="Qué pasa cuando se intenta vender sin unidades registradas." pad={22}>
          <SettingRow first icon="package" title="Permitir stock negativo" desc="Activa: se puede vender aunque no quede stock en el sistema (queda en negativo hasta que lo regularices). Inactiva: la venta se bloquea sin stock.">
            <Switch
              checked={efectivoDe(data, 'inventario.permitir_stock_negativo')?.valor === true}
              onChange={async (v) => {
                try { await setConfig(nivel, ambitoId, 'inventario.permitir_stock_negativo', v); await recargar(); }
                catch (e) { toast((e as Error).message, 'error'); }
              }}
            />
          </SettingRow>
        </ConfigCard>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button variant="primary" iconLeft="check" loading={guardando} onClick={guardar}>Guardar cambios</Button>
      </div>
      {scope === 'sucursal' && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 8 }}>Se guarda como override de esta sucursal.</p>}
    </>
  );
}

// ── Días laborables y servicios por día ──────────────────────────────────────

interface HorarioRow { id: string; nombre: string; dias: boolean[] }
interface HorarioCfg { sucursales: HorarioRow[]; servicios: HorarioRow[] }

/** Etiquetas de día, índice 0=domingo … 6=sábado (convención del backend). */
const DIAS_LBL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Fila de 7 píldoras (un día cada una); on = trabaja/activo. */
function DiasRow({ dias, onToggle }: { dias: boolean[]; onToggle: (dia: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {DIAS_LBL.map((lbl, i) => {
        const on = dias[i];
        return (
          <button
            key={i}
            type="button"
            onClick={() => onToggle(i)}
            aria-pressed={on}
            title={on ? 'Abierto — clic para cerrar' : 'Cerrado — clic para abrir'}
            style={{
              minWidth: 46, height: 34, padding: '0 10px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`,
              background: on ? 'var(--brand-tint)' : 'var(--surface-card)',
              color: on ? 'var(--brand)' : 'var(--text-tertiary)',
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-xs)',
              textDecoration: on ? 'none' : 'line-through',
            }}
          >
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

function ConfigHorario() {
  const toast = useToast();
  const { data, cargando, error, recargar } = useApi<HorarioCfg>(() => api.get('/agenda/horario'));
  const [sucs, setSucs] = useState<HorarioRow[]>([]);
  const [servs, setServs] = useState<HorarioRow[]>([]);

  useEffect(() => {
    if (data) { setSucs(data.sucursales); setServs(data.servicios); }
  }, [data]);

  async function guardar(tipo: 'sucursal' | 'servicio', id: string, dias: boolean[]) {
    try {
      await api.put(`/agenda/horario/${tipo}/${id}`, { dias });
    } catch (e) {
      toast((e as Error).message, 'error');
      void recargar();
    }
  }

  function toggle(tipo: 'sucursal' | 'servicio', idx: number, dia: number) {
    const setter = tipo === 'sucursal' ? setSucs : setServs;
    setter((rows) => {
      const next = rows.map((r, i) =>
        i === idx ? { ...r, dias: r.dias.map((d, j) => (j === dia ? !d : d)) } : r,
      );
      void guardar(tipo, next[idx].id, next[idx].dias);
      return next;
    });
  }

  if (error) return <ErrorState onRetry={recargar} />;
  if (cargando || !data) return <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>;

  const Lista = ({ rows, tipo, vacio }: { rows: HorarioRow[]; tipo: 'sucursal' | 'servicio'; vacio: string }) =>
    rows.length === 0 ? (
      <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>{vacio}</p>
    ) : (
      <>
        {rows.map((r, i) => (
          <div key={r.id} style={{ padding: '14px 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{r.nombre}</div>
            <DiasRow dias={r.dias} onToggle={(dia) => toggle(tipo, i, dia)} />
          </div>
        ))}
      </>
    );

  return (
    <>
      <ConfigCard title="Días laborables por sucursal" desc="Marca los días que abre cada sede. Los cambios se guardan al instante; en los días cerrados el cliente no puede reservar." pad={22}>
        <Lista rows={sucs} tipo="sucursal" vacio="No hay sucursales activas." />
      </ConfigCard>
      <ConfigCard title="Servicios por día" desc="Desactiva un servicio los días que no lo ofreces. Aplica a todas las sedes." pad={22}>
        <Lista rows={servs} tipo="servicio" vacio="No hay servicios activos." />
      </ConfigCard>
    </>
  );
}
