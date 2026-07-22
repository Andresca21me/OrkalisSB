import { useEffect, useState } from 'react';
import { medirSms, VARIABLES_PLANTILLA, type CanalCupo, type EventoPlantilla, type PlantillaMensaje } from '@orkalis/shared';
import { api } from '../../lib/api';
import { fechaCorta, num } from '../../lib/format';
import { marcarAlertaLeida, useAlertas, useCupos } from '../../lib/useCupos';
import { guardarPlantilla, usePlantillas } from '../../lib/usePlantillas';
import { Badge, Button, Dialog, ErrorState, Icon, Spinner, useToast } from '../../ui/ui';
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
  recordatorio: { name: 'Recordatorio', desc: 'Se envía dentro de la ventana configurada antes de la cita.' },
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
