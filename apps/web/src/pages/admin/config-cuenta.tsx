import { useEffect, useState } from 'react';
import { medirSms, VARIABLES_PLANTILLA, type CanalCupo, type EventoPlantilla, type PlantillaMensaje } from '@orkalis/shared';
import { api, ApiError, tokens } from '../../lib/api';
import { fechaCorta, fechaHora, num } from '../../lib/format';
import { marcarAlertaLeida, useAlertas, useCupos } from '../../lib/useCupos';
import { guardarPlantilla, usePlantillas } from '../../lib/usePlantillas';
import { borrarLogo, guardarMarca, subirLogo, useMarca } from '../../lib/useMarca';
import { urlLogoNegocio } from '../../lib/api';
import { colorDominante, prepararLogo } from '../../lib/imagen';
import { contrasteBajo, textoSobre } from '../../lib/color';
import { useAuth } from '../../lib/auth';
import { useEstadoMensajeria, useMensajes, useResumenMensajes } from '../../lib/useMensajes';
import { Badge, Button, Dialog, ErrorState, Icon, Input, Select, Spinner, useToast } from '../../ui/ui';
import { GField } from './gestion-ui';
import { ConfigBanner, ConfigCard } from './config-ui';

const CANAL_LABEL: Record<CanalCupo, { label: string; icon: string }> = {
  whatsapp_utility: { label: 'WhatsApp · utilidad', icon: 'message-circle' },
  whatsapp_marketing: { label: 'WhatsApp · marketing', icon: 'message-circle' },
  sms: { label: 'SMS', icon: 'smartphone' },
  email: { label: 'Email', icon: 'mail' },
};

const EVENTO_LABEL: Record<EventoPlantilla, { name: string; desc: string }> = {
  confirmacion: { name: 'Confirmación de cita', desc: 'Se envía al cliente en cuanto queda la reserva.' },
  recordatorio: { name: 'Recordatorio', desc: 'Se envía 2 horas antes de la cita.' },
  aviso: { name: 'Cancelación', desc: 'Se envía cuando la cita se cancela.' },
  aviso_especialista: { name: 'Aviso al especialista', desc: 'Novedades de su agenda (se activa en una fase posterior).' },
  marketing: { name: 'Campaña', desc: 'Mensaje promocional. Se detiene si se agota el cupo del plan.' },
};

// ── Notificaciones ───────────────────────────────────────────────────────────
export function ConfigNotif() {
  const cupos = useCupos();
  const alertas = useAlertas();
  const ciclo = cupos.data?.[0];

  async function leer(id: string) {
    await marcarAlertaLeida(id);
    alertas.recargar();
  }

  return (
    <div>
      <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>Notificaciones</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '4px 0 20px' }}>Cupos de mensajería del plan y plantillas de los mensajes.</p>

      {/* Avisos de sobreconsumo (FASE-03) */}
      {alertas.data?.map((a) => (
        <div key={a.id} style={{ marginBottom: 12 }}>
          <ConfigBanner tone={a.severidad === 'critico' ? 'danger' : 'warning'} title={a.titulo}>
            {a.detalle}
            <div style={{ marginTop: 10 }}>
              <Button size="sm" variant="ghost" onClick={() => leer(a.id)}>Entendido</Button>
            </div>
          </ConfigBanner>
        </div>
      ))}

      {/* Cupos de mensajería (REAL · H5) */}
      <ConfigCard
        title="Cupos de mensajería · ciclo actual"
        desc={
          ciclo
            ? `Consumo y cupo de cada canal según tu plan. El ciclo va del ${fechaCorta(ciclo.cicloInicio)} al ${fechaCorta(ciclo.cicloFin)}: los cupos se recargan en tu fecha de cobro, no el día 1.`
            : 'Consumo y cupo de cada canal según tu plan (ADR-009).'
        }
      >
        {cupos.error ? (
          <ErrorState onRetry={cupos.recargar} />
        ) : cupos.cargando || !cupos.data ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Spinner /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {cupos.data.map((c) => {
              const meta = CANAL_LABEL[c.canal];
              const pct = c.cupo > 0 ? Math.min(100, Math.round((c.consumo / c.cupo) * 100)) : 0;
              const restante = c.restante;
              const color = !c.dentroDeCupo ? 'var(--error)' : pct >= 80 ? 'var(--warning)' : 'var(--brand)';
              return (
                <div key={c.canal} style={{ padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Icon name={meta.icon} size={16} color="var(--text-tertiary)" />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{meta.label}</span>
                  </div>
                  <div className="data" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>{num(c.consumo)} <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', fontWeight: 500 }}>/ {num(c.cupo)}</span></div>
                  <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-sunken)', overflow: 'hidden', margin: '8px 0 6px' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: color }} />
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: c.dentroDeCupo ? 'var(--text-tertiary)' : 'var(--error)' }}>{c.dentroDeCupo ? `${num(restante)} restantes` : 'Cupo superado'}</span>
                </div>
              );
            })}
          </div>
        )}
      </ConfigCard>

      <PanelPlantillas />
    </div>
  );
}

// ── Developer / Mantenimiento ────────────────────────────────────────────────
interface Health { status?: string }

export function ConfigDeveloper() {
  const toast = useToast();
  const [health, setHealth] = useState<'ok' | 'down' | null>(null);
  const [danger, setDanger] = useState<{ title: string; desc: string; word: string } | null>(null);

  useEffect(() => {
    api.get<Health>('/health').then((h) => setHealth(h?.status === 'ok' || h?.status === 'up' ? 'ok' : 'ok')).catch(() => setHealth('down'));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>Developer · Mantenimiento</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '4px 0 20px' }}>Estado técnico de la cuenta y operaciones avanzadas.</p>

      <div style={{ marginBottom: 16 }}>
        <ConfigBanner tone="warning" icon="shield" title="Zona de operaciones avanzadas">
          Estas herramientas afectan datos de forma permanente y solo están disponibles para el rol Administrador. Procede con cuidado.
        </ConfigBanner>
      </div>

      <ConfigCard title="Estado del sistema">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', alignItems: 'center', justifyContent: 'center' }}><Icon name="activity" size={18} color={health === 'down' ? 'var(--error)' : 'var(--success)'} /></span>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>API</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{health === null ? 'Comprobando…' : health === 'down' ? 'No responde' : 'Operativa'}</div>
          </div>
          <Badge tone={health === 'down' ? 'error' : 'success'} dot style={{ marginLeft: 'auto' }}>{health === 'down' ? 'Caída' : 'Saludable'}</Badge>
        </div>
      </ConfigCard>

      <ConfigCard title="Limpieza de datos de prueba" desc="Maqueta: las operaciones de limpieza/retención se conectarán a un worker en una versión posterior.">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['el día', 'la semana', 'el mes'].map((s) => (
            <Button key={s} variant="secondary" iconLeft="trash-2" onClick={() => setDanger({ title: `Limpiar datos de ${s}`, desc: `Eliminaría las citas y movimientos de prueba de ${s}. Esta acción no se puede deshacer.`, word: 'LIMPIAR' })}>Limpiar {s}</Button>
          ))}
        </div>
      </ConfigCard>

      <DangerConfirm danger={danger} onClose={() => setDanger(null)} onConfirm={() => { toast('Acción no disponible en v2 (maqueta)', 'info'); setDanger(null); }} />
    </div>
  );
}

function DangerConfirm({ danger, onClose, onConfirm }: { danger: { title: string; desc: string; word: string } | null; onClose: () => void; onConfirm: () => void }) {
  const [text, setText] = useState('');
  useEffect(() => { setText(''); }, [danger]);
  if (!danger) return null;
  const ok = text.trim().toUpperCase() === danger.word;
  return (
    <Dialog open onClose={onClose} width={460} title={danger.title}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" iconLeft="trash-2" disabled={!ok} onClick={onConfirm}>Confirmar</Button>
      </>}>
      <div style={{ padding: '4px 0 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ConfigBanner tone="danger" title="Acción irreversible">{danger.desc}</ConfigBanner>
        <GField label={<>Escribe <span className="data" style={{ fontWeight: 700 }}>{danger.word}</span> para confirmar</>}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={danger.word} style={{ height: 42, padding: '0 12px', borderRadius: 'var(--radius-xs)', border: `1px solid ${text && !ok ? 'var(--error)' : 'var(--border-default)'}`, outline: 'none', width: '100%', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', background: 'var(--surface-card)' }} />
        </GField>
      </div>
    </Dialog>
  );
}

// ── Plantillas de mensaje (FASE-04, D5) ──────────────────────────────────────
const ORDEN: EventoPlantilla[] = ['confirmacion', 'recordatorio', 'aviso', 'aviso_especialista', 'marketing'];

function PanelPlantillas() {
  const { data, cargando, error, recargar } = usePlantillas('sms');

  return (
    <ConfigCard
      title="Plantillas de mensaje · SMS"
      desc={`Texto que verá el cliente. Variables disponibles: ${VARIABLES_PLANTILLA.map((v) => `{{${v}}}`).join(' ')}. Deja el campo vacío para volver al texto por defecto.`}
    >
      {error ? (
        <ErrorState onRetry={recargar} />
      ) : cargando || !data ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Spinner /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {ORDEN.map((ev) => {
            const p = data.find((x) => x.evento === ev);
            return p ? <EditorPlantilla key={ev} plantilla={p} onGuardado={recargar} /> : null;
          })}
        </div>
      )}
    </ConfigCard>
  );
}

function EditorPlantilla({ plantilla, onGuardado }: { plantilla: PlantillaMensaje; onGuardado: () => void }) {
  const toast = useToast();
  const meta = EVENTO_LABEL[plantilla.evento];
  const [texto, setTexto] = useState(plantilla.contenidoSms ?? '');
  const [guardando, setGuardando] = useState(false);

  const personalizado = texto.trim().length > 0;
  // Lo que de verdad se enviará: el texto propio o el default de plataforma.
  const efectivo = personalizado ? texto : plantilla.porDefecto;
  const medida = medirSms(efectivo);
  const sucio = texto !== (plantilla.contenidoSms ?? '');

  async function guardar() {
    setGuardando(true);
    try {
      await guardarPlantilla(plantilla.evento, 'sms', { contenidoSms: texto.trim() || null });
      toast(personalizado ? 'Plantilla guardada' : 'Volviste al texto por defecto', 'success');
      onGuardado();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  function insertar(v: string) {
    setTexto((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}{{${v}}}`);
  }

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{meta.name}</span>
        {!personalizado && <Badge tone="neutral" size="md">Por defecto</Badge>}
      </div>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 10px' }}>{meta.desc}</p>

      <textarea
        rows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={plantilla.porDefecto}
        aria-label={`Plantilla de ${meta.name}`}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', resize: 'vertical' }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
        {VARIABLES_PLANTILLA.map((v) => (
          <button key={v} type="button" onClick={() => insertar(v)}
            style={{ height: 26, padding: '0 9px', borderRadius: 999, border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
            {`{{${v}}}`}
          </button>
        ))}
      </div>

      <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-xs)', background: 'var(--surface-sunken)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: '20px' }}>
        <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Vista previa</span>
        {efectivo}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <span className="data" style={{ fontSize: 'var(--text-xs)', color: medida.segmentos > 1 ? 'var(--warning)' : 'var(--text-tertiary)' }}>
          {medida.caracteres} caracteres · {medida.segmentos} segmento{medida.segmentos === 1 ? '' : 's'} · {medida.codificacion}
        </span>
        <Button size="sm" loading={guardando} disabled={!sucio} onClick={guardar}>
          {personalizado ? 'Guardar' : 'Restablecer'}
        </Button>
      </div>

      {medida.codificacion === 'UCS-2' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--warning)' }}>
          <Icon name="alert-circle" size={13} color="var(--warning)" style={{ flex: 'none', marginTop: 2 }} />
          <span>
            Caracteres fuera del alfabeto GSM ({medida.fueraDeGsm.slice(0, 6).join(' ')}) obligan a codificación Unicode: cada segmento pasa de 160 a 70 caracteres y el envío cuesta más. Quitar esas tildes suele reducir el mensaje a la mitad de segmentos.
          </span>
        </div>
      )}
    </div>
  );
}

// ── Registro de mensajes (FASE-10) ───────────────────────────────────────────
const ESTADO_TONO: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  entregado: 'success',
  enviado: 'neutral',
  pendiente: 'neutral',
  enviando: 'neutral',
  fallido: 'error',
  sin_cupo: 'warning',
};
const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'En cola',
  enviando: 'Enviando',
  enviado: 'Enviado',
  entregado: 'Entregado',
  fallido: 'Falló',
  sin_cupo: 'Sin cupo',
};
const CANAL_MSG: Record<string, { label: string; icon: string }> = {
  sms: { label: 'SMS', icon: 'smartphone' },
  whatsapp: { label: 'WhatsApp', icon: 'message-circle' },
  email: { label: 'Email', icon: 'mail' },
};

export function RegistroMensajes() {
  const [canal, setCanal] = useState('');
  const [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(0);
  const { data, cargando, error, recargar } = useMensajes({ canal, estado, pagina });
  const resumen = useResumenMensajes();
  const estadoMsj = useEstadoMensajeria();

  const paginas = data ? Math.ceil(data.total / data.porPagina) : 0;
  const tasa = resumen.data ? Math.round(resumen.data.tasaFallo * 100) : 0;

  return (
    <div>
      <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>Registro de mensajes</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '4px 0 20px' }}>
        Todo lo que la plataforma envió a tus clientes y a tu equipo, con su estado de entrega real.
      </p>

      {estadoMsj.data?.pausada && (
        <div style={{ marginBottom: 16 }}>
          <ConfigBanner tone="warning" title="Los envíos están pausados">
            No se están enviando recordatorios. Tus clientes pueden seguir reservando con normalidad y las
            confirmaciones quedan en cola: saldrán en cuanto se reanude la mensajería.
            {estadoMsj.data.motivo ? ` Motivo: ${estadoMsj.data.motivo}` : ''}
          </ConfigBanner>
        </div>
      )}

      {resumen.data && resumen.data.total > 0 && (
        <div style={{ marginBottom: 16 }}>
          <ConfigBanner tone={tasa >= 20 ? 'danger' : tasa > 0 ? 'warning' : 'info'} title={`${num(resumen.data.total)} mensajes en los últimos ${resumen.data.dias} días`}>
            {tasa > 0
              ? `Un ${tasa}% no llegó a destino (fallidos o sin cupo). Revisa abajo el detalle del error.`
              : 'Ningún envío fallido en el período.'}
          </ConfigBanner>
        </div>
      )}

      <ConfigCard title="Historial" desc="Se muestran los últimos 30 días.">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <Select value={canal} onChange={(e) => { setCanal(e.target.value); setPagina(0); }} style={{ maxWidth: 180 }}>
            <option value="">Todos los canales</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </Select>
          <Select value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(0); }} style={{ maxWidth: 180 }}>
            <option value="">Todos los estados</option>
            {Object.keys(ESTADO_LABEL).map((e) => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
          </Select>
        </div>

        {error ? (
          <ErrorState onRetry={recargar} />
        ) : cargando || !data ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Spinner /></div>
        ) : data.mensajes.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', padding: '18px 0' }}>
            No hay mensajes con esos filtros.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-tertiary)' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Fecha</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Tipo</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Canal</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Destino</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Mensaje</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.mensajes.map((m) => (
                  <tr key={m.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="data" style={{ padding: '10px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{fechaHora(m.creadoEn)}</td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{m.tipo.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                        <Icon name={CANAL_MSG[m.canal]?.icon ?? 'send'} size={13} />
                        {CANAL_MSG[m.canal]?.label ?? m.canal}
                      </span>
                      {m.canalPreferido && m.canalPreferido !== m.canal && (
                        // Hubo degradación de canal: se quería el preferido y salió por el
                        // actual. El motivo va visible (no solo en tooltip): es el dato que
                        // responde "¿por qué me llegó por SMS?" sin tener que adivinar.
                        <span
                          title={m.motivoFallback ?? undefined}
                          style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', maxWidth: 220, whiteSpace: 'normal' }}
                        >
                          {CANAL_MSG[m.canalPreferido]?.label ?? m.canalPreferido} → {CANAL_MSG[m.canal]?.label ?? m.canal}
                          {m.motivoFallback ? ` · ${m.motivoFallback}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="data" style={{ padding: '10px', whiteSpace: 'nowrap' }}>{m.destino}</td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)', maxWidth: 340 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.cuerpo}</span>
                      {m.error && <span style={{ color: 'var(--error)', fontSize: 'var(--text-xs)' }}>{m.error}</span>}
                    </td>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                      <Badge tone={ESTADO_TONO[m.estado] ?? 'neutral'} size="md">{ESTADO_LABEL[m.estado] ?? m.estado}</Badge>
                      {m.sobreCupo && <span style={{ marginLeft: 6, fontSize: 'var(--text-xs)', color: 'var(--warning)' }}>sobre cupo</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {paginas > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <Button size="md" variant="ghost" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anteriores</Button>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Página {pagina + 1} de {paginas}</span>
            <Button size="md" variant="ghost" disabled={pagina + 1 >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguientes</Button>
          </div>
        )}
      </ConfigCard>
    </div>
  );
}

// ── Marca del negocio (branding dinámico) ────────────────────────────────────
/** Tope de la descripción: por encima, WhatsApp y Google la recortan a mitad. */
const MAX_DESC = 200;

export function ConfigMarca() {
  const toast = useToast();
  const { usuario } = useAuth();
  const { data, cargando, error, recargar } = useMarca();

  const [desc, setDesc] = useState('');
  const [color, setColor] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [logoQuitado, setLogoQuitado] = useState(false);
  const [sugerido, setSugerido] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Al llegar los datos se rellena el formulario una sola vez.
  useEffect(() => {
    if (!data) return;
    setDesc(data.descripcion ?? '');
    setColor(data.colorPrimario ?? '');
  }, [data]);

  const negocioId = usuario?.negocioId ?? '';
  const logoActual = data ? urlLogoNegocio(negocioId, data.logoVersion) : null;
  const logoVisible = logoQuitado ? null : (logo ?? logoActual);
  const colorEfectivo = color || 'var(--brand)';

  async function elegirLogo(archivo: File | undefined) {
    if (!archivo) return;
    try {
      const dataUrl = await prepararLogo(archivo);
      setLogo(dataUrl);
      setLogoQuitado(false);
      // Se SUGIERE el color, no se impone: si el admin ya eligió uno a mano no
      // se le pisa, y en cualquier caso puede cambiarlo después.
      const dominante = await colorDominante(dataUrl);
      if (dominante) {
        setSugerido(dominante);
        if (!color) setColor(dominante);
      }
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function guardar() {
    setGuardando(true);
    try {
      if (logo) await subirLogo(logo);
      else if (logoQuitado) await borrarLogo();
      await guardarMarca({ descripcion: desc.trim() || null, colorPrimario: color || null });
      toast('Marca actualizada', 'success');
      setLogo(null);
      setLogoQuitado(false);
      await recargar();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  if (error) return <ErrorState onRetry={recargar} />;
  if (cargando || !data) return <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}><Spinner /></div>;

  return (
    <div>
      <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>Marca</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '4px 0 20px' }}>
        Tu logo, tu color y tu descripción. Es lo que ven tus clientes al reservar y al recibir tu enlace por WhatsApp.
      </p>

      <ConfigCard title="Logo" desc="Aparece en la cabecera de tu página de reservas y en la tarjeta al compartir el enlace.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ width: 96, height: 96, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', display: 'grid', placeItems: 'center', overflow: 'hidden', flex: 'none' }}>
            {logoVisible
              ? <img src={logoVisible} alt="Logo del negocio" style={{ maxWidth: '82%', maxHeight: '82%', objectFit: 'contain' }} />
              : <Icon name="store" size={30} color="var(--text-tertiary)" />}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--brand)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              <Icon name="image" size={15} color="var(--brand)" />
              {logoVisible ? 'Cambiar logo' : 'Subir logo'}
              <input type="file" accept="image/*" onChange={(e) => elegirLogo(e.target.files?.[0])} style={{ display: 'none' }} />
            </label>
            {logoVisible && <Button size="md" variant="ghost" onClick={() => { setLogo(null); setLogoQuitado(true); }}>Quitar</Button>}
          </div>
        </div>
      </ConfigCard>

      <ConfigCard title="Color principal" desc="Se aplica a los botones y a lo seleccionado en tu página de reservas.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <input
            type="color"
            value={color || '#1E3A8A'}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Color principal"
            style={{ width: 56, height: 40, padding: 2, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)', cursor: 'pointer' }}
          />
          <span className="data" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{color || 'Sin definir (usa el de la plataforma)'}</span>
          {sugerido && sugerido !== color && (
            <Button size="md" variant="ghost" onClick={() => setColor(sugerido)}>Usar el de tu logo ({sugerido})</Button>
          )}
          {color && <Button size="md" variant="ghost" onClick={() => setColor('')}>Restablecer</Button>}
        </div>

        {/* Vista previa con el color real, para juzgarlo antes de guardarlo. */}
        <div style={{ marginTop: 16, padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 40, padding: '0 18px', borderRadius: 'var(--radius-sm)', background: colorEfectivo, color: textoSobre(color), fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
            Confirmar reserva
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 12px', borderRadius: 999, border: `1.5px solid ${colorEfectivo}`, color: colorEfectivo, fontSize: 'var(--text-sm)', fontWeight: 600 }}>
            10:30 a. m.
          </span>
          {color && contrasteBajo(color) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--warning)' }}>
              <Icon name="alert-circle" size={13} color="var(--warning)" />
              Es un color muy claro: el texto del botón se pone oscuro para que siga leyéndose.
            </span>
          )}
        </div>
      </ConfigCard>

      <ConfigCard title="Descripción" desc="La frase que acompaña a tu enlace cuando lo compartes por WhatsApp o redes.">
        <GField label="Descripción" optional hint={`${desc.length}/${MAX_DESC} caracteres`}>
          <textarea
            rows={3}
            value={desc}
            maxLength={MAX_DESC}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Ej.: Barbería clásica en Chapinero. Cortes, barba y afeitado tradicional. Reserva en línea en 30 segundos."
            style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', resize: 'vertical' }}
          />
        </GField>
      </ConfigCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button loading={guardando} iconLeft="check" onClick={guardar}>Guardar marca</Button>
      </div>
    </div>
  );
}

// ── Cuenta: correo de acceso y contraseña (Plan-Correo E4) ───────────────────

/**
 * Credenciales del usuario EN SESIÓN (no confundir con Configuración › Usuarios,
 * que administra a los demás). El cambio de contraseña revoca todas las
 * sesiones en el backend (D8): aquí se renueva la propia iniciando sesión con
 * la clave nueva acto seguido, para que el usuario no se entere del corte. El
 * cambio de correo queda "pendiente" hasta que la dirección nueva confirme el
 * enlace que le llega.
 */
export function ConfigCredenciales() {
  const { usuario } = useAuth();
  const toast = useToast();

  // Cambio de contraseña.
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errorPass, setErrorPass] = useState<string>();
  const [guardandoPass, setGuardandoPass] = useState(false);

  // Cambio de correo.
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [passEmail, setPassEmail] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [errorEmail, setErrorEmail] = useState<string>();
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  useEffect(() => {
    api.get<{ pendiente: string | null }>('/auth/email/cambio')
      .then((r) => setPendiente(r.pendiente))
      .catch(() => { /* sin estado pendiente no se rompe nada */ });
  }, []);

  async function cambiarPassword() {
    if (guardandoPass) return;
    if (nueva.length < 8) { setErrorPass('La nueva contraseña necesita al menos 8 caracteres.'); return; }
    if (nueva !== confirmar) { setErrorPass('Las contraseñas no coinciden.'); return; }
    setErrorPass(undefined);
    setGuardandoPass(true);
    try {
      await api.post('/auth/password/cambiar', { passwordActual: actual, passwordNueva: nueva });
      // El backend revocó todas las sesiones: se renueva la propia en silencio.
      try {
        const r = await api.post<{ accessToken: string; refreshToken: string }>('/auth/login', { email: usuario!.email, password: nueva }, false);
        tokens.set(r.accessToken, r.refreshToken);
      } catch { /* si falla, la sesión sigue viva ~15 min y el guard pedirá login */ }
      setActual(''); setNueva(''); setConfirmar('');
      toast('Contraseña actualizada. Las sesiones en otros dispositivos se cerraron.', 'success');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setErrorPass('La contraseña actual no es correcta.');
      else if (e instanceof ApiError && e.status === 429) setErrorPass('Demasiados intentos. Espera un minuto.');
      else setErrorPass('No pudimos cambiar la contraseña. Intenta de nuevo.');
    } finally {
      setGuardandoPass(false);
    }
  }

  async function solicitarCambioEmail() {
    if (enviandoEmail) return;
    if (!/.+@.+\..+/.test(nuevoEmail.trim())) { setErrorEmail('Escribe un correo válido.'); return; }
    setErrorEmail(undefined);
    setEnviandoEmail(true);
    try {
      await api.post('/auth/email/cambio', { password: passEmail, nuevoEmail: nuevoEmail.trim() });
      setPendiente(nuevoEmail.trim().toLowerCase());
      setFormAbierto(false);
      setPassEmail(''); setNuevoEmail('');
      toast('Te enviamos un enlace de confirmación a la dirección nueva.', 'success');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setErrorEmail('La contraseña no es correcta.');
      else if (e instanceof ApiError && e.status === 409) setErrorEmail('Ya existe una cuenta con ese correo.');
      else if (e instanceof ApiError && e.status === 400) setErrorEmail(e.message);
      else setErrorEmail('No pudimos enviar la solicitud. Intenta de nuevo.');
    } finally {
      setEnviandoEmail(false);
    }
  }

  async function reenviarCambioEmail() {
    try {
      await api.post('/auth/email/cambio/reenviar');
      toast('Enlace reenviado.', 'success');
    } catch (e) {
      toast(e instanceof ApiError && e.status === 429 ? 'Espera un momento antes de reenviar.' : 'No pudimos reenviar el enlace.', 'error');
    }
  }

  async function cancelarCambioEmail() {
    try {
      await api.del('/auth/email/cambio');
      setPendiente(null);
      toast('Solicitud cancelada. El enlace enviado dejó de servir.', 'info');
    } catch {
      toast('No pudimos cancelar la solicitud.', 'error');
    }
  }

  const verificado = !!usuario?.emailVerificadoEn;

  return (
    <>
      <ConfigCard title="Correo de acceso" desc="Es tu usuario para entrar a Orkalis. Si lo cambias, la dirección nueva debe confirmar un enlace antes de que el cambio se aplique." pad={22}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Icon name="mail" size={18} color="var(--text-tertiary)" />
          <span className="data" style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{usuario?.email}</span>
          <Badge tone={verificado ? 'success' : 'neutral'}>{verificado ? 'Verificado' : 'Sin verificar'}</Badge>
          {!pendiente && !formAbierto && (
            <Button variant="secondary" size="sm" iconLeft="edit-3" onClick={() => setFormAbierto(true)} style={{ marginLeft: 'auto' }}>Cambiar correo</Button>
          )}
        </div>

        {pendiente && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16, padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
            <Icon name="clock" size={16} color="var(--text-tertiary)" />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Pendiente de confirmación: <strong>{pendiente}</strong>
            </span>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <Button variant="ghost" size="sm" onClick={() => void reenviarCambioEmail()}>Reenviar</Button>
              <Button variant="ghost" size="sm" onClick={() => void cancelarCambioEmail()}>Cancelar</Button>
            </div>
          </div>
        )}

        {formAbierto && !pendiente && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
            <GField label="Tu contraseña" hint="para confirmar que eres tú">
              <Input type="password" value={passEmail} onChange={(e) => setPassEmail(e.target.value)} placeholder="Tu contraseña actual" autoComplete="current-password" />
            </GField>
            <GField label="Nuevo correo" error={errorEmail}>
              <Input type="email" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} placeholder="nuevo@negocio.co" autoComplete="email" />
            </GField>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="primary" size="sm" loading={enviandoEmail} onClick={() => void solicitarCambioEmail()}>Enviar confirmación</Button>
              <Button variant="ghost" size="sm" onClick={() => { setFormAbierto(false); setErrorEmail(undefined); }}>Cancelar</Button>
            </div>
          </div>
        )}
      </ConfigCard>

      <ConfigCard title="Cambiar contraseña" desc="Al guardarla se cierran las sesiones abiertas en otros dispositivos." pad={22}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
          <GField label="Contraseña actual">
            <Input type="password" value={actual} onChange={(e) => setActual(e.target.value)} placeholder="Tu contraseña de hoy" autoComplete="current-password" />
          </GField>
          <GField label="Nueva contraseña" hint="mínimo 8 caracteres">
            <Input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Crea una contraseña" autoComplete="new-password" />
          </GField>
          <GField label="Confírmala" error={errorPass}>
            <Input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password" />
          </GField>
          <div>
            <Button variant="primary" size="sm" iconLeft="check" loading={guardandoPass} disabled={!actual || !nueva || !confirmar} onClick={() => void cambiarPassword()}>
              Guardar contraseña
            </Button>
          </div>
        </div>
      </ConfigCard>
    </>
  );
}
