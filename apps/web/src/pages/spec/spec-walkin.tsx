import { useMemo, useState } from 'react';
import type { MetodoPago } from '@orkalis/shared';
import { hoyISO, money } from '../../lib/format';
import { useServicios } from '../../lib/useServicios';
import { walkInRetroactivo, walkInVivo } from '../../lib/useEspecialista';
import { AppHeader, FooterBar, ScrollArea } from '../../ui';
import { Button, Card, Chip, Icon, Segmented, Spinner, useToast } from '../../ui/ui';
import { PAGOS, SectionLabel } from './spec-ui';

/** 'HH:MM' (hoy, zona Bogotá) → ISO UTC, o null si inválido. */
function isoDeHora(hhmm: string): string | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${hoyISO()}T${m[1].padStart(2, '0')}:${m[2]}:00-05:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function WalkinSpec({ sucursalId, especialistaId, onDone }: { sucursalId: string | null; especialistaId: string; onDone: (modo: 'vivo' | 'retro') => void }) {
  const toast = useToast();
  const { data: servicios, cargando } = useServicios();
  const activos = useMemo(() => (servicios ?? []).filter((s) => s.activo), [servicios]);
  const categorias = useMemo(() => ['Todas', ...new Set(activos.map((s) => s.categoria).filter(Boolean) as string[])], [activos]);

  const [modo, setModo] = useState<'vivo' | 'retro'>('vivo');
  const [cat, setCat] = useState('Todas');
  const [picked, setPicked] = useState<string[]>([]);
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [pago, setPago] = useState<MetodoPago | null>(null);
  const [guardando, setGuardando] = useState(false);

  const lista = cat === 'Todas' ? activos : activos.filter((s) => s.categoria === cat);
  const elegidos = activos.filter((s) => picked.includes(s.id));
  const total = elegidos.reduce((a, s) => a + Number(s.precio), 0);
  const toggle = (id: string) => setPicked((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const iIso = isoDeHora(inicio);
  const fIso = isoDeHora(fin);
  const horasInvalidas = modo === 'retro' && !!inicio && !!fin && (!iIso || !fIso || fIso <= iIso);

  async function submit() {
    if (!sucursalId) { toast('No hay sucursal activa', 'error'); return; }
    if (!picked.length) { toast('Elige al menos un servicio', 'warning'); return; }
    if (modo === 'retro') {
      if (!iIso || !fIso) { toast('Indica hora de inicio y fin (HH:MM)', 'warning'); return; }
      if (horasInvalidas) { toast('La hora de fin no puede ser antes del inicio', 'error'); return; }
      if (!pago) { toast('Elige un método de pago', 'warning'); return; }
    }
    setGuardando(true);
    try {
      if (modo === 'vivo') {
        await walkInVivo({ sucursalId, especialistaId, servicioIds: picked });
        toast('Atención iniciada', 'success');
        onDone('vivo');
      } else {
        await walkInRetroactivo({ sucursalId, especialistaId, servicioIds: picked, inicio: iIso!, fin: fIso!, metodoPago: pago! });
        toast('Atención registrada', 'success');
        onDone('retro');
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Walk-in" />
      <div style={{ flex: 'none', padding: '14px 20px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <Segmented options={[{ value: 'vivo', label: 'Atender ahora' }, { value: 'retro', label: 'Atención pasada' }]} value={modo} onChange={(v) => setModo(v as 'vivo' | 'retro')} />
      </div>

      <ScrollArea>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--info-tint)', border: '1px solid rgba(59,130,246,0.22)', marginBottom: 18 }}>
            <Icon name={modo === 'vivo' ? 'zap' : 'rotate-ccw'} size={18} color="var(--info)" style={{ flex: 'none', marginTop: 1 }} />
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: '19px' }}>
              {modo === 'vivo' ? 'Crea el turno y empiézalo de inmediato (queda En progreso).' : 'Registra una atención ya realizada. Se crea como Completada.'} El cliente queda como walk-in.
            </div>
          </div>

          <SectionLabel>Servicios</SectionLabel>
          {cargando ? <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Spinner /></div> : (
            <>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 4 }}>
                {categorias.map((c) => {
                  const on = c === cat;
                  return <button key={c} type="button" onClick={() => setCat(c)} style={{ flex: 'none', height: 34, padding: '0 13px', borderRadius: 99, border: `1px solid ${on ? 'var(--brand)' : 'var(--border-subtle)'}`, background: on ? 'var(--brand)' : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{c}</button>;
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {lista.map((s) => {
                  const on = picked.includes(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggle(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-subtle)'}`, background: on ? 'var(--brand-tint)' : 'var(--surface-card)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{s.nombre}</div>
                        <div className="data" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{money(s.precio)} · {s.duracionMin} min</div>
                      </div>
                      <span style={{ width: 24, height: 24, borderRadius: 7, flex: 'none', border: `2px solid ${on ? 'var(--brand)' : 'var(--border-default)'}`, background: on ? 'var(--brand)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on && <Icon name="check" size={15} color="#fff" />}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {modo === 'retro' && (
            <>
              <SectionLabel>Cuándo se atendió</SectionLabel>
              <Card padding={14} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <Campo label="Inicio" value={inicio} onChange={setInicio} placeholder="14:00" invalid={horasInvalidas} />
                  <Campo label="Fin" value={fin} onChange={setFin} placeholder="14:40" invalid={horasInvalidas} />
                </div>
                {horasInvalidas && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)', fontSize: 'var(--text-xs)' }}><Icon name="alert-circle" size={13} color="var(--error)" /> La hora de fin debe ser posterior al inicio.</div>}
              </Card>
              <SectionLabel>Método de pago</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {PAGOS.map((p) => <Chip key={p.id} active={pago === p.id} icon={p.icon} onClick={() => setPago(p.id)}>{p.label}</Chip>)}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      <FooterBar>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {picked.length > 0 && (
            <div style={{ flex: 'none' }}>
              <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>{money(total)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: -2 }}>{picked.length} serv.</div>
            </div>
          )}
          <Button size="lg" style={{ flex: 1 }} loading={guardando} iconLeft={modo === 'vivo' ? 'play' : 'check'} onClick={submit}>{modo === 'vivo' ? 'Iniciar atención' : 'Registrar atención'}</Button>
        </div>
      </FooterBar>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, invalid }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; invalid: boolean }) {
  return (
    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode="numeric" className="data"
        style={{ height: 44, padding: '0 12px', borderRadius: 'var(--radius-xs)', border: `1px solid ${invalid ? 'var(--error)' : 'var(--border-default)'}`, outline: 'none', background: 'var(--surface-card)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', color: 'var(--text-primary)' }} />
    </label>
  );
}
