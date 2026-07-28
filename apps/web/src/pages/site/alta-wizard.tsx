import { useEffect, useState } from 'react';
import { PerfilNegocio, type PlanSuscripcion } from '@orkalis/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { money } from '../../lib/format';
import { prepararLogo } from '../../lib/imagen';
import { subirLogo } from '../../lib/useMarca';
import { Avatar, Badge, Button, Card, Icon, Logo, QtyStepper, Segmented, Switch } from '../../ui';
import { VERTICAL, monthly, planById, PLANS, type Ciclo, type Vertical } from './site-data';
import type { Funnel, Go } from './site-ui';
import {
  ChoiceCard,
  GField,
  GInput,
  GSelect,
  HORAS,
  ONB_CSS,
  OnbNota,
  StepShell,
  Stepper,
  type PasoOnb,
} from '../onboarding/onboarding-ui';

/**
 * Alta del negocio (`/alta`) — asistente guiado, réplica del prototipo
 * «Onboarding del negocio» (Lote 6 · 6.2).
 *
 * Los 5 pasos del prototipo (Negocio · Sucursal · Módulos · Equipo · Listo) se
 * conservan tal cual y se intercalan los dos que el prototipo no podía tener
 * porque no había backend: **Cuenta** (los datos con los que se inicia sesión)
 * y **Plan** (suscripción + prueba de 15 días o pago inmediato).
 *
 * NADA se escribe en el servidor hasta el paso 6: el usuario elige prueba o
 * pago y ahí se crea el negocio (`POST /auth/registro`); acto seguido se aplica
 * lo recogido en los pasos anteriores (sucursal, módulos, equipo, logo) con la
 * sesión recién emitida. La sesión queda preparada pero SIN activar
 * (`entrar: false`) para que el router no arranque al usuario del asistente
 * antes de ver su enlace de reservas.
 */

const PASOS: PasoOnb[] = [
  { n: 1, label: 'Negocio' },
  { n: 2, label: 'Cuenta' },
  { n: 3, label: 'Sucursal' },
  { n: 4, label: 'Módulos' },
  { n: 5, label: 'Equipo', opcional: true },
  { n: 6, label: 'Plan' },
  { n: 7, label: 'Listo' },
];
const TOTAL = PASOS.length;
const PASO_LISTO = 7;

/**
 * Módulos que se ofrecen en el alta → claves reales del registry de config
 * (FASE-06). `recomendado` replica el default por perfil del backend: lo que
 * viene marcado aquí es exactamente lo que el negocio tendría sin tocar nada.
 */
const MODULOS: { clave: string; nombre: string; icon: string; desc: string; recomendado: Record<PerfilNegocio, boolean> }[] = [
  { clave: 'modulo.inventario', nombre: 'Inventario y productos', icon: 'package', desc: 'Control de stock, alertas de existencias bajas y descuento automático al vender.', recomendado: { [PerfilNegocio.Salon]: true, [PerfilNegocio.Barberia]: false } },
  { clave: 'modulo.particion_por_especialista', nombre: 'Repartición de ganancias', icon: 'percent', desc: 'Reparte cada servicio entre el profesional y el negocio según los parámetros financieros.', recomendado: { [PerfilNegocio.Salon]: true, [PerfilNegocio.Barberia]: true } },
  { clave: 'modulo.cierre_periodo', nombre: 'Cierre de período', icon: 'calendar', desc: 'Habilita liquidaciones por corte (quincenal o mensual) con cuadre de caja.', recomendado: { [PerfilNegocio.Salon]: false, [PerfilNegocio.Barberia]: false } },
  { clave: 'agendamiento.recordatorio_2h', nombre: 'Recordatorios automáticos', icon: 'bell', desc: 'Avisa al cliente 2 horas antes de su cita por WhatsApp o SMS.', recomendado: { [PerfilNegocio.Salon]: true, [PerfilNegocio.Barberia]: true } },
  { clave: 'agendamiento.aprobacion_manual', nombre: 'Aprobación manual de reservas', icon: 'shield-check', desc: 'Las reservas del enlace público entran como solicitud hasta que el equipo las confirme.', recomendado: { [PerfilNegocio.Salon]: false, [PerfilNegocio.Barberia]: false } },
];

/** Planes que se pueden contratar solos; «Empresarial» pasa por ventas. */
const PLANES_ALTA = PLANS.filter((p) => !p.contact);

interface Props { vertical: Vertical; go: Go; funnel: Funnel; setFunnel: (f: (p: Funnel) => Funnel) => void }

interface Sucursal { id: string; nombre: string }

export function SignupPage({ vertical, go, funnel, setFunnel }: Props) {
  const { registrar, refrescar } = useAuth();
  const [paso, setPaso] = useState(1);

  // ── Estado del asistente (todo en memoria hasta el paso 6) ──
  const [perfil, setPerfil] = useState<PerfilNegocio>(vertical === 'salon' ? PerfilNegocio.Salon : PerfilNegocio.Barberia);
  const [negocio, setNegocio] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState({ responsable: '', tel: '', email: '', pass: '' });
  const [sucursal, setSucursal] = useState({ nombre: '', direccion: '', apertura: '09:00', cierre: '20:00' });
  const [mods, setMods] = useState<Record<string, boolean>>({});
  const [equipo, setEquipo] = useState<string[]>([]);
  const [planId, setPlanId] = useState(funnel.planId);
  const [especialistas, setEspecialistas] = useState(funnel.specialists);
  const [ciclo, setCiclo] = useState<Ciclo>(funnel.cycle);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [creando, setCreando] = useState<null | 'prueba' | 'pago'>(null);
  const [progreso, setProgreso] = useState('');
  const [errorServidor, setErrorServidor] = useState<string>();
  const [avisos, setAvisos] = useState<string[]>([]);
  const [alta, setAlta] = useState<{ sucursalId: string | null } | null>(null);

  const plan = planById(planId);
  const espWord = perfil === PerfilNegocio.Salon ? 'especialista' : 'barbero';
  const vv = VERTICAL[perfil === PerfilNegocio.Salon ? 'salon' : 'barberia'];
  const numEspecialistas = Math.max(especialistas, plan.included);
  const precioMes = monthly(plan, numEspecialistas);
  const precioMostrado = ciclo === 'anual' ? Math.round((precioMes * 10) / 12) : precioMes;

  // Los módulos recomendados dependen del perfil: al cambiarlo se recalculan,
  // igual que en el prototipo (y que los defaults del registry del backend).
  useEffect(() => {
    setMods(Object.fromEntries(MODULOS.map((m) => [m.clave, m.recomendado[perfil]])));
  }, [perfil]);

  // El plan manda sobre el número de especialistas: el backend rechaza un cupo
  // por debajo de los incluidos.
  useEffect(() => {
    setEspecialistas((n) => Math.max(n, plan.included));
  }, [plan.included]);

  // ── Validación por paso ──
  function validar(p: number): boolean {
    const e: Record<string, string> = {};
    if (p === 1 && negocio.trim().length < 2) e.negocio = 'Ingresa el nombre de tu negocio.';
    if (p === 2) {
      if (cuenta.responsable.trim().length < 2) e.responsable = 'Escribe el nombre del responsable.';
      if (!/.+@.+\..+/.test(cuenta.email.trim())) e.email = 'Correo no válido.';
      if (cuenta.pass.length < 8) e.pass = 'Mínimo 8 caracteres.';
    }
    if (p === 3) {
      if (sucursal.nombre.trim().length < 2) e.sucursal = 'Ponle un nombre a la sucursal.';
      if (!sucursal.direccion.trim()) e.direccion = 'Ingresa la dirección.';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  function continuar() {
    if (!validar(paso)) return;
    setPaso((p) => Math.min(PASO_LISTO, p + 1));
    window.scrollTo(0, 0);
  }
  function atras() {
    setErrores({});
    setPaso((p) => Math.max(1, p - 1));
  }
  function saltarA(n: number) {
    setErrores({});
    setPaso(n);
  }

  /**
   * Aplica al negocio recién creado lo que se recogió en los pasos anteriores.
   * Cada bloque va aparte a propósito: la cuenta YA existe, así que un fallo
   * aquí no puede tumbar el alta — se anota y el usuario lo corrige luego
   * desde el panel.
   */
  async function aplicarConfiguracion(negocioId: string): Promise<{ sucursalId: string | null; avisos: string[] }> {
    const fallos: string[] = [];
    let sucursalId: string | null = null;

    // El alta crea una sucursal «Principal»: se renombra a la del asistente.
    try {
      setProgreso('Configurando tu sucursal…');
      const sucs = await api.get<Sucursal[]>('/sucursales');
      sucursalId = sucs[0]?.id ?? null;
      const nombre = sucursal.nombre.trim();
      if (sucursalId && nombre && nombre !== sucs[0].nombre) {
        await api.patch(`/sucursales/${sucursalId}`, { nombre });
      }
    } catch {
      fallos.push('No pudimos renombrar tu sucursal; la encontrarás como «Principal».');
    }

    try {
      setProgreso('Activando los módulos elegidos…');
      await Promise.all(MODULOS.map((m) => api.put(`/config/negocio/${negocioId}/${m.clave}`, { valor: !!mods[m.clave] })));
    } catch {
      fallos.push('No pudimos guardar los módulos; ajústalos en Configuración.');
    }

    if (equipo.length && sucursalId) {
      try {
        setProgreso('Dando de alta a tu equipo…');
        for (const nombre of equipo) {
          await api.post('/especialistas', { nombre, sucursalIds: [sucursalId] });
        }
      } catch {
        fallos.push('No pudimos crear a todo tu equipo; agrégalo desde Gestión › Equipo.');
      }
    }

    if (logo) {
      try {
        setProgreso('Subiendo tu logo…');
        await subirLogo(logo);
      } catch {
        fallos.push('No pudimos subir el logo; vuelve a intentarlo en Configuración › Marca.');
      }
    }

    return { sucursalId, avisos: fallos };
  }

  /** Paso 6: crea la cuenta de verdad y deja el negocio listo para operar. */
  async function crearCuenta(modo: 'prueba' | 'pago') {
    if (creando) return;
    // Se revalida todo el asistente: si algo quedó a medias, se vuelve al paso.
    for (const p of [1, 2, 3]) {
      if (!validar(p)) {
        setPaso(p);
        window.scrollTo(0, 0);
        return;
      }
    }
    setErrorServidor(undefined);
    setCreando(modo);
    setProgreso('Creando tu cuenta…');
    // El checkout y el resumen leen el plan del funnel.
    setFunnel((f) => ({ ...f, planId, specialists: numEspecialistas, cycle: ciclo, vertical: perfil === PerfilNegocio.Salon ? 'salon' : 'barberia', negocio: negocio.trim() }));
    try {
      const r = await registrar(
        {
          negocioNombre: negocio.trim(),
          perfil,
          plan: planId as PlanSuscripcion,
          numEspecialistas,
          admin: { nombre: cuenta.responsable.trim(), email: cuenta.email.trim(), password: cuenta.pass },
          modo,
        },
        // La sesión se activa al final, con «Ir a mi panel».
        { entrar: false },
      );
      const res = await aplicarConfiguracion(r.negocioId);
      setAlta({ sucursalId: res.sucursalId });
      setAvisos(res.avisos);
      setProgreso('');
      // Modo pago: al checkout (FASE-05). La cuenta ya existe y arranca en
      // prueba, así que si abandona el pago no pierde nada de lo configurado.
      if (r.requierePago) {
        go('pago');
        return;
      }
      setPaso(PASO_LISTO);
      window.scrollTo(0, 0);
    } catch (e) {
      setErrorServidor(e instanceof Error ? e.message : 'No se pudo crear la cuenta. Intenta de nuevo.');
      setProgreso('');
    } finally {
      setCreando(null);
    }
  }

  const publicUrl = alta?.sucursalId ? `${window.location.origin}/reservar/${alta.sucursalId}` : '';
  const modsActivos = Object.values(mods).filter(Boolean).length;
  const resumen: [string, string, string][] = [
    ['store', 'Perfil', perfil === PerfilNegocio.Salon ? 'Salón de belleza' : 'Barbería'],
    ['map-pin', 'Sucursal', sucursal.nombre.trim() || 'Sede principal'],
    ['package', 'Módulos activos', `${modsActivos} activos`],
    ['users', 'Equipo', equipo.length ? `${equipo.length} ${equipo.length === 1 ? 'persona' : 'personas'}` : 'Por agregar'],
    ['credit-card', 'Plan', `${plan.name} · ${numEspecialistas} especialistas`],
    ['zap', 'Suscripción', 'Prueba de 15 días'],
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-page)' }}>
      <style>{ONB_CSS}</style>

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-card)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" onClick={() => go('landing')} aria-label="Ir al inicio" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
          <Logo />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="mkt-desktop" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Configuración inicial</span>
          {paso < PASO_LISTO && <Button variant="ghost" size="sm" onClick={() => go('login')}>Ya tengo cuenta</Button>}
        </div>
      </header>

      {paso < PASO_LISTO && (
        <div style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '18px 24px' }}>
            <Stepper steps={PASOS} current={paso} onJump={saltarA} />
          </div>
        </div>
      )}

      {/* Sin <main> propio: el asistente se monta dentro del <main> del sitio. */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 24px 64px' }}>
        <div key={paso} style={{ width: '100%', maxWidth: paso === PASO_LISTO ? 600 : paso === 6 ? 820 : 680 }}>
          {/* ── 1 · Negocio ────────────────────────────────────────────── */}
          {paso === 1 && (
            <StepShell n={1} total={TOTAL} title="Cuéntanos de tu negocio" desc="Empecemos por lo esencial. Podrás cambiar todo esto más adelante.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <GField label="Nombre del negocio" error={errores.negocio}>
                  <GInput value={negocio} onChange={setNegocio} placeholder={`Ej.: ${vv.sample}`} invalid={!!errores.negocio} onEnter={continuar} />
                </GField>
                <LogoPicker logo={logo} onLogo={setLogo} />
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Perfil del negocio</div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 12px' }}>Ajusta la terminología (cómo llamamos a tu equipo y tus servicios) y las categorías por defecto.</p>
                  <div className="onb-grid-2">
                    <ChoiceCard selected={perfil === PerfilNegocio.Salon} onClick={() => setPerfil(PerfilNegocio.Salon)} icon="scissors" title="Salón de belleza" desc="Especialistas, servicios de cabello, color, uñas y estética." tag="Equipo: especialistas" />
                    <ChoiceCard selected={perfil === PerfilNegocio.Barberia} onClick={() => setPerfil(PerfilNegocio.Barberia)} icon="scissors" title="Barbería" desc="Barberos, cortes, barba y arreglo. Citas más cortas y frecuentes." tag="Equipo: barberos" />
                  </div>
                </div>
              </div>
            </StepShell>
          )}

          {/* ── 2 · Cuenta ─────────────────────────────────────────────── */}
          {paso === 2 && (
            <StepShell n={2} total={TOTAL} title="Tus datos de acceso" desc="Con este correo y esta contraseña entrarás a Orkalis como administrador del negocio.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="onb-grid-2">
                  <GField label="Nombre del responsable" error={errores.responsable}>
                    <GInput value={cuenta.responsable} onChange={(v) => setCuenta((c) => ({ ...c, responsable: v }))} placeholder="Ej.: Catalina Mejía" invalid={!!errores.responsable} autoComplete="name" />
                  </GField>
                  <GField label="Teléfono" hint="opcional">
                    <GInput value={cuenta.tel} onChange={(v) => setCuenta((c) => ({ ...c, tel: v }))} placeholder="300 000 0000" type="tel" autoComplete="tel" />
                  </GField>
                </div>
                <GField label="Correo" hint="será tu usuario" error={errores.email}>
                  <GInput value={cuenta.email} onChange={(v) => setCuenta((c) => ({ ...c, email: v }))} placeholder="nombre@negocio.co" type="email" invalid={!!errores.email} autoComplete="email" />
                </GField>
                <GField label="Contraseña" hint="mínimo 8 caracteres" error={errores.pass}>
                  <GInput value={cuenta.pass} onChange={(v) => setCuenta((c) => ({ ...c, pass: v }))} placeholder="Crea una contraseña" type="password" invalid={!!errores.pass} autoComplete="new-password" revelable />
                </GField>
                <OnbNota icon="lock">
                  Este acceso es tuyo, el del <strong>dueño o administrador</strong>. A tu equipo lo invitas después con su propio usuario desde <strong>Configuración › Usuarios y roles</strong>.
                </OnbNota>
              </div>
            </StepShell>
          )}

          {/* ── 3 · Sucursal ───────────────────────────────────────────── */}
          {paso === 3 && (
            <StepShell n={3} total={TOTAL} title="Tu primera sucursal" desc="Configura la sede principal. Podrás agregar más sucursales cuando quieras.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <GField label="Nombre de la sucursal" hint="suele incluir el barrio o la zona" error={errores.sucursal}>
                  <GInput value={sucursal.nombre} onChange={(v) => setSucursal((s) => ({ ...s, nombre: v }))} placeholder={`Ej.: ${vv.sample} · ${perfil === PerfilNegocio.Salon ? 'El Nogal' : 'Chapinero'}`} invalid={!!errores.sucursal} />
                </GField>
                <GField label="Dirección" error={errores.direccion}>
                  <GInput value={sucursal.direccion} onChange={(v) => setSucursal((s) => ({ ...s, direccion: v }))} placeholder="Calle, número, barrio, ciudad" invalid={!!errores.direccion} />
                </GField>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Horario base</div>
                  <div className="onb-horario">
                    <div className="onb-hora"><GSelect value={sucursal.apertura} onChange={(v) => setSucursal((s) => ({ ...s, apertura: v }))} options={HORAS} /></div>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>a</span>
                    <div className="onb-hora"><GSelect value={sucursal.cierre} onChange={(v) => setSucursal((s) => ({ ...s, cierre: v }))} options={HORAS} /></div>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Lun a Sáb</span>
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '8px 0 0' }}>Podrás definir horarios distintos por día y por especialista desde Configuración › Agenda.</p>
                </div>
                <OnbNota>
                  ¿Tienes más sedes? Termina esta primero; podrás agregar las demás desde <strong>Configuración › Sucursales</strong>. Cada sucursal activa se suma a tu suscripción.
                </OnbNota>
              </div>
            </StepShell>
          )}

          {/* ── 4 · Módulos ────────────────────────────────────────────── */}
          {paso === 4 && (
            <StepShell n={4} total={TOTAL} title="Activa lo que necesitas" desc={`Preparamos los módulos recomendados para tu ${perfil === PerfilNegocio.Salon ? 'salón' : 'barbería'}. Los esenciales vienen activos; ajústalos a tu gusto.`}>
              <Card padding={4}>
                {MODULOS.map((m, i) => (
                  <div key={m.clave} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 14px', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', flex: 'none', marginTop: 1 }}>
                      <Icon name={m.icon} size={19} color="var(--text-secondary)" />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 4 }}>
                        <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{m.nombre}</span>
                        {m.recomendado[perfil] && <Badge tone="brand" size="md">Recomendado</Badge>}
                      </div>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '3px 0 0', maxWidth: 460, lineHeight: '20px' }}>{m.desc}</p>
                    </div>
                    <div style={{ flex: 'none', paddingTop: 4 }}>
                      <Switch testId={`alta-modulo-${m.clave}`} checked={!!mods[m.clave]} onChange={(v) => setMods((o) => ({ ...o, [m.clave]: v }))} />
                    </div>
                  </div>
                ))}
              </Card>
            </StepShell>
          )}

          {/* ── 5 · Equipo ─────────────────────────────────────────────── */}
          {paso === 5 && (
            <StepShell n={5} total={TOTAL} optional title="Agrega tu equipo" desc={`Suma a tus ${espWord}s y asígnalos a la sucursal. Este paso es opcional: puedes hacerlo después.`}>
              <PasoEquipo equipo={equipo} setEquipo={setEquipo} espWord={espWord} sucursalNombre={sucursal.nombre || 'Tu sucursal'} />
            </StepShell>
          )}

          {/* ── 6 · Plan ───────────────────────────────────────────────── */}
          {paso === 6 && (
            <StepShell n={6} total={TOTAL} title="Elige tu plan" desc="Empieza con 15 días de prueba (no pedimos tarjeta) o activa tu suscripción hoy mismo. Puedes cambiar de plan cuando quieras.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="onb-grid-3">
                  {PLANES_ALTA.map((p) => (
                    <ChoiceCard
                      key={p.id}
                      selected={planId === p.id}
                      onClick={() => setPlanId(p.id)}
                      icon={p.highlight ? 'zap' : 'wallet'}
                      title={p.name}
                      desc={p.blurb}
                      tag={`Incluye ${p.included} especialistas`}
                    >
                      <span className="data" style={{ marginTop: 12, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>
                        {money(monthly(p, Math.max(especialistas, p.included)))}
                        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}> /mes</span>
                      </span>
                    </ChoiceCard>
                  ))}
                </div>

                <Card padding={18}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', rowGap: 12 }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Especialistas</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{plan.name} incluye {plan.included}; cada uno extra suma {money(plan.perExtra)}.</div>
                    </div>
                    <QtyStepper value={numEspecialistas} onChange={setEspecialistas} min={plan.included} max={30} />
                  </div>
                  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '16px 0' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', rowGap: 12 }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Facturación</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Anual = 2 meses gratis.</div>
                    </div>
                    {/* Ancho fijo: los botones de `Segmented` son `flex:1` con
                        `min-width:0`, así que sin él la tira se encoge y trunca
                        las etiquetas («Mens…»). */}
                    <div style={{ flex: 'none', width: 210 }}>
                      <Segmented value={ciclo} onChange={(v) => setCiclo(v as Ciclo)} options={[{ value: 'mensual', label: 'Mensual' }, { value: 'anual', label: 'Anual' }]} />
                    </div>
                  </div>
                  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '16px 0' }} />
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>Total {ciclo === 'anual' ? 'equivalente mensual' : 'mensual'}</span>
                    <span className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>{money(precioMostrado)}</span>
                  </div>
                </Card>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  <Icon name="building-2" size={16} color="var(--text-tertiary)" />
                  ¿Cadena con varias sedes?
                  <button type="button" onClick={() => go('contacto')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand)', fontWeight: 600, fontSize: 'var(--text-sm)', padding: 0 }}>Habla con ventas</button>
                </div>

                {errorServidor && (
                  <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 13px', borderRadius: 'var(--radius-sm)', background: 'var(--error-tint)', border: '1px solid var(--error)', fontSize: 'var(--text-sm)', color: 'var(--error)' }}>
                    <Icon name="alert-circle" size={16} color="var(--error)" style={{ flex: 'none', marginTop: 2 }} />
                    <div>
                      {errorServidor}
                      <button type="button" onClick={() => saltarA(2)} style={{ display: 'block', marginTop: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error)', fontWeight: 700, fontSize: 'var(--text-sm)', padding: 0, textDecoration: 'underline' }}>Revisar mis datos de acceso</button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Button variant="primary" size="lg" fullWidth iconRight={creando ? undefined : 'arrow-right'} loading={creando === 'prueba'} disabled={!!creando} onClick={() => void crearCuenta('prueba')}>
                    Empezar prueba gratis (15 días)
                  </Button>
                  <Button variant="secondary" size="lg" fullWidth iconLeft={creando ? undefined : 'credit-card'} loading={creando === 'pago'} disabled={!!creando} onClick={() => void crearCuenta('pago')}>
                    Pagar y empezar ya
                  </Button>
                </div>
                <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                  {progreso || 'La prueba no pide tarjeta. Puedes cancelar cuando quieras.'}
                </p>
              </div>
            </StepShell>
          )}

          {/* ── 7 · Listo ──────────────────────────────────────────────── */}
          {paso === PASO_LISTO && (
            <PasoListo
              bizName={negocio.trim() || vv.sample}
              publicUrl={publicUrl}
              avisos={avisos}
              resumen={resumen}
              onIrPanel={() => void refrescar()}
            />
          )}

          {/* Navegación (el paso 6 tiene sus propios CTA de alta). */}
          {paso < 6 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, gap: 12 }}>
              <div>{paso > 1 && <Button variant="ghost" size="lg" iconLeft="arrow-left" onClick={atras}>Atrás</Button>}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {PASOS[paso - 1].opcional && <Button variant="secondary" size="lg" onClick={() => saltarA(6)}>Omitir por ahora</Button>}
                <Button variant="primary" size="lg" iconRight="arrow-right" onClick={continuar}>Continuar</Button>
              </div>
            </div>
          )}
          {paso === 6 && (
            <div style={{ marginTop: 22 }}>
              <Button variant="ghost" size="lg" iconLeft="arrow-left" disabled={!!creando} onClick={atras}>Atrás</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Logo (paso 1) ────────────────────────────────────────────────────────────
/** Selector de logo: se procesa en el navegador y se sube tras crear la cuenta. */
function LogoPicker({ logo, onLogo }: { logo: string | null; onLogo: (v: string | null) => void }) {
  const [error, setError] = useState<string>();

  async function elegir(archivo: File | undefined) {
    if (!archivo) return;
    try {
      onLogo(await prepararLogo(archivo));
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la imagen.');
    }
  }

  return (
    <div>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
        Logo <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>· opcional</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px dashed var(--border-strong)', flex: 'none', overflow: 'hidden' }}>
          {logo ? <img src={logo} alt="Logo del negocio" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Icon name="image" size={24} color="var(--text-tertiary)" />}
        </span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', boxShadow: 'var(--shadow-xs)' }}>
          <Icon name="image" size={18} color="var(--text-secondary)" />
          {logo ? 'Cambiar logo' : 'Subir logo'}
          <input type="file" accept="image/*" onChange={(e) => void elegir(e.target.files?.[0])} style={{ display: 'none' }} />
        </label>
        {logo && (
          <button type="button" onClick={() => onLogo(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>Quitar</button>
        )}
      </div>
      {error && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--error)', marginTop: 6 }}>{error}</div>}
    </div>
  );
}

// ── Equipo (paso 5) ──────────────────────────────────────────────────────────
function PasoEquipo({ equipo, setEquipo, espWord, sucursalNombre }: { equipo: string[]; setEquipo: (f: (p: string[]) => string[]) => void; espWord: string; sucursalNombre: string }) {
  const [nombre, setNombre] = useState('');
  function agregar() {
    const n = nombre.trim();
    if (n.length < 2) return;
    setEquipo((arr) => [...arr, n]);
    setNombre('');
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <GField label={`Nombre del ${espWord}`}>
            <GInput value={nombre} onChange={setNombre} placeholder={espWord === 'barbero' ? 'Ej.: Andrés Mejía' : 'Ej.: Valentina Gómez'} onEnter={agregar} />
          </GField>
        </div>
        <Button variant="secondary" size="lg" iconLeft="plus" onClick={agregar}>Agregar</Button>
      </div>

      {equipo.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '36px 20px', borderRadius: 'var(--radius-lg)', border: '1.5px dashed var(--border-default)', textAlign: 'center' }}>
          <Icon name="users" size={28} color="var(--text-tertiary)" />
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Aún no agregas a nadie</div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, maxWidth: 320 }}>Agrega a tu equipo ahora o invítalos después desde Gestión › Equipo.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {equipo.map((m, i) => (
            <div key={`${m}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
              <Avatar name={m} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{m}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{espWord === 'barbero' ? 'Barbero' : 'Especialista'} · {sucursalNombre}</div>
              </div>
              <button type="button" onClick={() => setEquipo((arr) => arr.filter((_, j) => j !== i))} aria-label={`Quitar a ${m}`} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', padding: 6 }}>
                <Icon name="x" size={17} color="var(--text-tertiary)" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Listo (paso 7) ───────────────────────────────────────────────────────────
function PasoListo({ bizName, publicUrl, resumen, avisos, onIrPanel }: { bizName: string; publicUrl: string; resumen: [string, string, string][]; avisos: string[]; onIrPanel: () => void }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      /* sin portapapeles: el enlace queda a la vista para copiarlo a mano */
    }
  }
  return (
    <div style={{ textAlign: 'center' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 999, background: 'var(--success-tint)', marginBottom: 20 }}>
        <Icon name="check-circle" size={38} color="var(--success)" />
      </span>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-3xl)', lineHeight: 1.12, letterSpacing: '-0.025em', margin: 0 }}>¡{bizName} está listo!</h1>
      <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-secondary)', margin: '12px 0 0', lineHeight: 1.5 }}>Tu cuenta quedó configurada y lista para operar. Comparte tu enlace de reservas para empezar a recibir citas.</p>

      {publicUrl && (
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
            <a href={`https://wa.me/?text=${encodeURIComponent(`Reserva tu cita aquí: ${publicUrl}`)}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 44, padding: '0 16px', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 500, textDecoration: 'none' }}>
              <Icon name="message-circle" size={15} color="rgba(255,255,255,0.85)" />WhatsApp
            </a>
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, padding: 18, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', textAlign: 'left' }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Resumen de tu configuración</div>
        <div className="onb-grid-2">
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

      {avisos.length > 0 && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--warning-tint)', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 'var(--text-sm)', fontWeight: 700, color: '#B45309' }}>
            <Icon name="alert-triangle" size={16} color="#B45309" />Quedó algo pendiente
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {avisos.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Button variant="primary" size="lg" fullWidth iconRight="arrow-right" onClick={onIrPanel}>Ir a mi panel</Button>
      </div>
    </div>
  );
}
