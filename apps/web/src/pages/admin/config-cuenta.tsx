import { useEffect, useState } from 'react';
import type { CanalCupo } from '@orkalis/shared';
import { api } from '../../lib/api';
import { num } from '../../lib/format';
import { useCupos } from '../../lib/useCupos';
import { Badge, Button, Dialog, ErrorState, Icon, Spinner, useToast } from '../../ui/ui';
import { GField } from './gestion-ui';
import { ConfigBanner, ConfigCard } from './config-ui';

const CANAL_LABEL: Record<CanalCupo, { label: string; icon: string }> = {
  whatsapp_utility: { label: 'WhatsApp · utilidad', icon: 'message-circle' },
  whatsapp_marketing: { label: 'WhatsApp · marketing', icon: 'message-circle' },
  sms: { label: 'SMS', icon: 'smartphone' },
  email: { label: 'Email', icon: 'mail' },
};

const NOTIF_EVENTOS = [
  { id: 'confirmacion', name: 'Confirmación de cita' },
  { id: 'recordatorio', name: 'Recordatorio' },
  { id: 'cambio', name: 'Cambio o cancelación' },
];

// ── Notificaciones ───────────────────────────────────────────────────────────
export function ConfigNotif() {
  const cupos = useCupos();

  return (
    <div>
      <h1 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em' }}>Notificaciones</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '4px 0 20px' }}>Cupos de mensajería del plan y plantillas de los mensajes.</p>

      {/* Cupos de mensajería (REAL · H5) */}
      <ConfigCard title="Cupos de mensajería · período actual" desc="Consumo y cupo de cada canal según tu plan (ADR-009).">
        {cupos.error ? (
          <ErrorState onRetry={cupos.recargar} />
        ) : cupos.cargando || !cupos.data ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Spinner /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {cupos.data.map((c) => {
              const meta = CANAL_LABEL[c.canal];
              const pct = c.cupo > 0 ? Math.min(100, Math.round((c.consumo / c.cupo) * 100)) : 0;
              const restante = Math.max(0, c.cupo - c.consumo);
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

      {/* Canales y plantillas (MAQUETA · sin backend aún) */}
      <div style={{ marginBottom: 16 }}>
        <ConfigBanner tone="info" title="Edición de canales y plantillas — próximamente">
          La matriz de canales por evento y el editor de plantillas se conectarán cuando el backend exponga su almacenamiento. Abajo se muestra la vista previsualizada.
        </ConfigBanner>
      </div>

      <ConfigCard title="Plantillas de mensaje" desc="Texto que verá el cliente. Usa {cliente}, {fecha} y {especialista} como variables.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: 0.7 }}>
          {NOTIF_EVENTOS.map((e) => (
            <GField key={e.id} label={`Plantilla · ${e.name}`}>
              <textarea disabled rows={2} placeholder={`Hola {cliente}, tu cita de ${e.name.toLowerCase()}…`} style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-default)', background: 'var(--surface-sunken)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', resize: 'none' }} />
            </GField>
          ))}
        </div>
      </ConfigCard>
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
