import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PerfilNegocio } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Avatar, Button, Card, Icon, Logo, Spinner, Switch, useToast } from '../../ui';
import { ChoiceCard, GField, GInput, ONB_CSS, StepShell, Stepper, inputCss } from './onboarding-ui';

interface ValorEfectivo {
  clave: string;
  valor: boolean | number | string;
  procedencia: string;
  tipo: string;
}
interface Sucursal {
  id: string;
  nombre: string;
  activa: boolean;
}
interface Especialista {
  id: string;
  nombre: string;
  especialidad: string | null;
  activo: boolean;
}

const STEPS = [
  { n: 1, label: 'Negocio', icon: 'store' },
  { n: 2, label: 'Sucursal', icon: 'map-pin' },
  { n: 3, label: 'Módulos', icon: 'package' },
  { n: 4, label: 'Equipo', icon: 'users', optional: true },
  { n: 5, label: 'Listo', icon: 'check-circle' },
];

/** Módulos de onboarding → claves reales del registry de config. */
const MODULOS = [
  { clave: 'modulo.inventario', name: 'Inventario y productos', icon: 'package', desc: 'Controla stock, ventas de producto y alertas de mínimos.' },
  { clave: 'modulo.particion_por_especialista', name: 'Repartición de ganancias', icon: 'percent', desc: 'Reparte cada atención entre el profesional y el negocio.' },
  { clave: 'modulo.cierre_periodo', name: 'Cierre de período', icon: 'calendar', desc: 'Habilita cierres quincenales/mensuales y su archivo.' },
  { clave: 'agendamiento.aprobacion_manual', name: 'Aprobación manual de reservas', icon: 'shield-check', desc: 'Las reservas públicas entran como solicitudes hasta que las apruebes.' },
];

export function OnboardingApp() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const negocioId = usuario?.negocio.id ?? '';

  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [step, setStep] = useState(1);
  const [guardando, setGuardando] = useState(false);

  // Estado del asistente
  const [perfil, setPerfil] = useState<PerfilNegocio>(usuario?.negocio.perfil ?? PerfilNegocio.Barberia);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalId, setSucursalId] = useState<string | null>(null);
  const [sucursalNombre, setSucursalNombre] = useState('');
  const [mods, setMods] = useState<Record<string, boolean>>({});
  const [equipo, setEquipo] = useState<Especialista[]>([]);
  const [errSuc, setErrSuc] = useState<string | undefined>();

  // Carga inicial: sucursales, config efectiva, equipo.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const [sucs, conf, esp] = await Promise.all([
          api.get<Sucursal[]>('/sucursales'),
          api.get<ValorEfectivo[]>('/config'),
          api.get<Especialista[]>('/especialistas'),
        ]);
        if (!vivo) return;
        setSucursales(sucs);
        if (sucs[0]) {
          setSucursalId(sucs[0].id);
          setSucursalNombre(sucs[0].nombre);
        }
        const mapa: Record<string, boolean> = {};
        for (const m of MODULOS) {
          const v = conf.find((c) => c.clave === m.clave)?.valor;
          mapa[m.clave] = v === true;
        }
        setMods(mapa);
        setEquipo(esp.filter((e) => e.activo));
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        if (vivo) setCargandoInicial(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [toast]);

  const espWord = perfil === PerfilNegocio.Salon ? 'especialista' : 'barbero';
  const publicUrl = sucursalId ? `${window.location.origin}/reservar/${sucursalId}` : '';

  // Persistencia por paso al avanzar.
  async function continuar() {
    setGuardando(true);
    try {
      if (step === 1) {
        if (perfil !== usuario?.negocio.perfil) {
          await api.patch(`/negocios/${negocioId}/perfil`, { perfil });
        }
      } else if (step === 2) {
        const nombre = sucursalNombre.trim();
        if (nombre.length < 2) {
          setErrSuc('Ponle un nombre a la sucursal (mín. 2 letras).');
          setGuardando(false);
          return;
        }
        setErrSuc(undefined);
        if (!sucursalId) {
          const s = await api.post<Sucursal>('/sucursales', { nombre });
          setSucursalId(s.id);
          setSucursales((arr) => [...arr, s]);
        } else if (nombre !== sucursales.find((s) => s.id === sucursalId)?.nombre) {
          await api.patch(`/sucursales/${sucursalId}`, { nombre });
          setSucursales((arr) => arr.map((s) => (s.id === sucursalId ? { ...s, nombre } : s)));
        }
      } else if (step === 3) {
        await Promise.all(MODULOS.map((m) => api.put(`/config/negocio/${negocioId}/${m.clave}`, { valor: !!mods[m.clave] })));
      }
      setStep((s) => Math.min(5, s + 1));
      window.scrollTo(0, 0);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  function atras() {
    setErrSuc(undefined);
    setStep((s) => Math.max(1, s - 1));
  }

  async function agregarMiembro(nombre: string) {
    if (!sucursalId) {
      toast('Primero define tu sucursal.', 'error');
      return;
    }
    try {
      const esp = await api.post<Especialista>('/especialistas', { nombre, sucursalIds: [sucursalId] });
      setEquipo((arr) => [...arr, esp]);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function quitarMiembro(id: string) {
    try {
      await api.del(`/especialistas/${id}`);
      setEquipo((arr) => arr.filter((e) => e.id !== id));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  if (cargandoInicial) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--surface-page)' }}>
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-page)' }}>
      <style>{ONB_CSS}</style>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-card)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Configuración inicial</span>
          {step < 5 && <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>Completar después</Button>}
        </div>
      </header>

      {step < 5 && (
        <div style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '18px 24px' }}>
            <Stepper steps={STEPS} current={step} onJump={(n) => n < step && setStep(n)} />
          </div>
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 24px 64px' }}>
        <div key={step} style={{ width: '100%', maxWidth: step === 5 ? 600 : 680 }}>
          {step === 1 && (
            <StepShell n={1} title="Cuéntanos de tu negocio" desc="Ajustamos la terminología y los valores por defecto según tu tipo de negocio. Podrás cambiar todo más adelante.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <GField label="Nombre del negocio" hint="Se define al crear la cuenta.">
                  <div style={{ ...inputCss(false), display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>{usuario?.negocio.nombre}</div>
                </GField>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Perfil del negocio</div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 12px' }}>Define cómo llamamos a tu equipo y los valores por defecto.</p>
                  <div className="onb-grid-2">
                    <ChoiceCard selected={perfil === PerfilNegocio.Salon} onClick={() => setPerfil(PerfilNegocio.Salon)} icon="scissors" title="Salón de belleza" desc="Especialistas, cabello, color, uñas y estética." tag="Equipo: especialistas" />
                    <ChoiceCard selected={perfil === PerfilNegocio.Barberia} onClick={() => setPerfil(PerfilNegocio.Barberia)} icon="scissors" title="Barbería" desc="Barberos, cortes, barba y arreglo." tag="Equipo: barberos" />
                  </div>
                </div>
              </div>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell n={2} title="Tu primera sucursal" desc="Configura la sede principal. Podrás agregar más sucursales y sus horarios desde Configuración.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <GField label="Nombre de la sucursal" hint="Suele incluir el barrio o la zona." error={errSuc}>
                  <GInput value={sucursalNombre} onChange={setSucursalNombre} placeholder={perfil === PerfilNegocio.Salon ? 'Ej.: Estudio Aura · El Nogal' : 'Ej.: La Navaja · Chapinero'} invalid={!!errSuc} />
                </GField>
                <div style={{ display: 'flex', gap: 11, padding: 13, borderRadius: 'var(--radius-sm)', background: 'var(--brand-tint)' }}>
                  <Icon name="info" size={17} color="var(--brand)" style={{ flex: 'none', marginTop: 1 }} />
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: '20px' }}>
                    Los horarios de atención y la disponibilidad por especialista se configuran en <strong>Configuración › Agenda</strong>. Cada sucursal activa se suma a tu suscripción.
                  </span>
                </div>
              </div>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell n={3} title="Activa lo que necesitas" desc="Enciende los módulos que usarás. Puedes ajustarlos cuando quieras desde Configuración.">
              <Card padding={4}>
                {MODULOS.map((m, i) => (
                  <div key={m.clave} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 14px', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', flex: 'none', marginTop: 1 }}>
                      <Icon name={m.icon} size={19} color="var(--text-secondary)" />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{m.name}</div>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '3px 0 0', maxWidth: 460, lineHeight: '20px' }}>{m.desc}</p>
                    </div>
                    <div style={{ flex: 'none', paddingTop: 4 }}>
                      <Switch testId={`onb-modulo-${m.clave}`} checked={!!mods[m.clave]} onChange={(v) => setMods((o) => ({ ...o, [m.clave]: v }))} />
                    </div>
                  </div>
                ))}
              </Card>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell n={4} title="Agrega tu equipo" desc={`Suma a tus ${espWord}s y asígnalos a la sucursal. Este paso es opcional: puedes hacerlo después.`} optional>
              <TeamStep equipo={equipo} espWord={espWord} sucursalNombre={sucursalNombre} onAdd={agregarMiembro} onRemove={quitarMiembro} />
            </StepShell>
          )}

          {step === 5 && (
            <DoneStep
              bizName={usuario?.negocio.nombre ?? ''}
              publicUrl={publicUrl}
              perfil={perfil}
              sucursalNombre={sucursalNombre}
              modsActivos={Object.values(mods).filter(Boolean).length}
              equipoCount={equipo.length}
              onIrPanel={() => navigate('/admin')}
            />
          )}

          {step < 5 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, gap: 12 }}>
              <div>{step > 1 && <Button variant="ghost" size="lg" iconLeft="arrow-left" onClick={atras}>Atrás</Button>}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {STEPS[step - 1].optional && <Button variant="secondary" size="lg" onClick={() => setStep(5)}>Omitir por ahora</Button>}
                <Button variant="primary" size="lg" iconRight="arrow-right" loading={guardando} onClick={() => void continuar()}>
                  {step === 4 ? 'Finalizar' : 'Continuar'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── TeamStep ─────────────────────────────────────────────────────────────────
function TeamStep({ equipo, espWord, sucursalNombre, onAdd, onRemove }: { equipo: Especialista[]; espWord: string; sucursalNombre: string; onAdd: (nombre: string) => void; onRemove: (id: string) => void }) {
  const [nombre, setNombre] = useState('');
  function add() {
    if (nombre.trim().length >= 2) {
      onAdd(nombre.trim());
      setNombre('');
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <GField label={`Nombre del ${espWord}`}>
            <GInput value={nombre} onChange={setNombre} placeholder={espWord === 'barbero' ? 'Ej.: Andrés Mejía' : 'Ej.: Valentina Gómez'} onEnter={add} />
          </GField>
        </div>
        <Button variant="secondary" size="lg" iconLeft="plus" onClick={add}>Agregar</Button>
      </div>

      {equipo.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '36px 20px', borderRadius: 'var(--radius-lg)', border: '1.5px dashed var(--border-default)', textAlign: 'center' }}>
          <Icon name="users" size={28} color="var(--text-tertiary)" />
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Aún no agregas a nadie</div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, maxWidth: 320 }}>Agrega a tu equipo ahora o desde Gestión › Equipo más adelante.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {equipo.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
              <Avatar name={m.nombre} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{m.nombre}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{espWord === 'barbero' ? 'Barbero' : 'Especialista'} · {sucursalNombre || 'Sucursal'}</div>
              </div>
              <button type="button" onClick={() => onRemove(m.id)} aria-label="Quitar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', padding: 6 }}>
                <Icon name="x" size={17} color="var(--text-tertiary)" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DoneStep ─────────────────────────────────────────────────────────────────
function DoneStep({ bizName, publicUrl, perfil, sucursalNombre, modsActivos, equipoCount, onIrPanel }: { bizName: string; publicUrl: string; perfil: PerfilNegocio; sucursalNombre: string; modsActivos: number; equipoCount: number; onIrPanel: () => void }) {
  const toast = useToast();
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      toast('No se pudo copiar', 'error');
    }
  }
  const resumen: [string, string, string][] = [
    ['store', 'Perfil', perfil === PerfilNegocio.Salon ? 'Salón de belleza' : 'Barbería'],
    ['map-pin', 'Sucursal', sucursalNombre || 'Sede principal'],
    ['package', 'Módulos activos', `${modsActivos} activos`],
    ['users', 'Equipo', equipoCount ? `${equipoCount} ${equipoCount === 1 ? 'persona' : 'personas'}` : 'Por agregar'],
  ];
  return (
    <div style={{ textAlign: 'center' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 999, background: 'var(--success-tint)', marginBottom: 20 }}>
        <Icon name="check-circle" size={38} color="var(--success)" />
      </span>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-3xl)', lineHeight: 1.12, letterSpacing: '-0.025em', margin: 0 }}>¡{bizName} está listo!</h1>
      <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-secondary)', margin: '12px 0 0', lineHeight: 1.5 }}>Tu cuenta quedó configurada. Comparte tu enlace de reservas para empezar a recibir citas.</p>

      <div style={{ marginTop: 28, padding: 20, borderRadius: 'var(--radius-lg)', background: 'var(--navy)', color: '#fff', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon name="link" size={16} color="var(--accent)" />
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>Tu enlace de reservas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', padding: '11px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
            <span className="data" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{publicUrl}</span>
          </div>
          <button type="button" onClick={() => void copiar()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 18px', border: 'none', cursor: 'pointer', flex: 'none', borderRadius: 'var(--radius-sm)', background: copiado ? 'var(--success)' : 'var(--brand)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
            <Icon name={copiado ? 'check' : 'copy'} size={16} color="#fff" />{copiado ? '¡Copiado!' : 'Copiar'}
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent('Reserva tu cita aquí: ' + publicUrl)}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 44, padding: '0 16px', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
            <Icon name="message-circle" size={15} color="rgba(255,255,255,0.85)" />WhatsApp
          </a>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', textAlign: 'left' }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Resumen de tu configuración</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
          {resumen.map(([ic, k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name={ic} size={17} color="var(--text-tertiary)" style={{ flex: 'none' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{k}</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Button variant="primary" size="lg" fullWidth iconRight="arrow-right" onClick={onIrPanel}>Ir a mi panel</Button>
      </div>
    </div>
  );
}

