import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { PerfilNegocio, type PlanSuscripcion } from '@orkalis/shared';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { money } from '../../lib/format';
import { prepararLogo } from '../../lib/imagen';
import { subirLogo } from '../../lib/useMarca';
import { Avatar, Badge, Button, Card, Icon, Logo, QtyStepper, Segmented, Switch } from '../../ui';
import {
  FEATURE_GROUPS,
  PLANS,
  VERTICAL,
  annualTotal,
  monthly,
  planById,
  planIncluyeModulo,
  planMinimoParaModulo,
  type Ciclo,
  type Plan,
  type Vertical,
} from './site-data';
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
 * **El plan va ANTES que los módulos** a propósito: el backend cruza
 * `plan ∧ config` (`ModuloGate`), así que preguntar primero qué módulos quieres
 * y luego venderte un plan que no los incluye deja banderas encendidas que no
 * hacen nada. Con el plan ya elegido, el paso de módulos solo ofrece lo que ese
 * plan desbloquea.
 *
 * NADA se escribe en el servidor hasta el último paso de configuración: el
 * usuario elige prueba o pago y ahí se crea el negocio (`POST /auth/registro`);
 * acto seguido se aplica lo recogido en los pasos anteriores (sucursal,
 * módulos, equipo, logo) con la sesión recién emitida. La sesión queda
 * preparada pero SIN activar (`entrar: false`) para que el router no arranque
 * al usuario del asistente antes de ver su enlace de reservas.
 */

const PASOS: PasoOnb[] = [
  { n: 1, label: 'Negocio' },
  { n: 2, label: 'Cuenta' },
  { n: 3, label: 'Sucursal' },
  { n: 4, label: 'Plan' },
  { n: 5, label: 'Módulos' },
  { n: 6, label: 'Equipo', opcional: true },
  { n: 7, label: 'Listo' },
];
const TOTAL = PASOS.length;
const PASO_PLAN = 4;
/** Último paso de configuración: aquí se crea la cuenta de verdad. */
const PASO_FINAL = 6;
const PASO_LISTO = 7;

/**
 * Módulos que se ofrecen en el alta → claves reales del registry de config
 * (FASE-06). `recomendado` replica el default por perfil del backend: lo que
 * viene marcado aquí es exactamente lo que el negocio tendría sin tocar nada.
 * Qué módulos desbloquea cada plan lo decide `planIncluyeModulo`.
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
  // ── Verificación del correo del Paso 2 (Plan-Correo E2) ──
  // El backend exige un enlace abierto antes de crear la cuenta; aquí se guarda
  // la verificación en curso, si la sub-vista de espera está visible y el
  // cooldown del botón «Reenviar».
  const [verificacion, setVerificacion] = useState<{ id: string; email: string; verificado: boolean } | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [enviandoVerif, setEnviandoVerif] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [avisoVerif, setAvisoVerif] = useState<string>();
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

  /**
   * Valor EFECTIVO de un módulo: la intención del usuario solo cuenta si el
   * plan lo incluye. Guardar la intención en vez de apagarla evita perderla
   * cuando alguien sube de plan tras haber visto el módulo bloqueado.
   */
  const modActivo = (clave: string) => !!mods[clave] && planIncluyeModulo(planId, clave);
  const modsActivos = MODULOS.filter((m) => modActivo(m.clave)).length;

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
      if (sucursal.cierre <= sucursal.apertura) e.horario = 'La hora de cierre debe ser posterior a la de apertura.';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  function continuar() {
    if (!validar(paso)) return;
    // El Paso 2 no avanza sin verificar el correo: manda el enlace y abre la
    // sub-vista de espera (el backend lo exige igual en el registro, D1).
    if (paso === 2) {
      void iniciarVerificacion();
      return;
    }
    setPaso((p) => Math.min(PASO_LISTO, p + 1));
    window.scrollTo(0, 0);
  }
  function atras() {
    setErrores({});
    setPaso((p) => Math.max(1, p - 1));
  }

  // ── Verificación de correo (Paso 2 → 3, Plan-Correo E2) ──
  async function iniciarVerificacion() {
    const email = cuenta.email.trim().toLowerCase();
    // Ya verificado y sin cambiar el correo: pasa directo (p. ej. volvió atrás).
    if (verificacion?.verificado && verificacion.email === email) {
      setPaso(3);
      window.scrollTo(0, 0);
      return;
    }
    if (enviandoVerif) return;
    setEnviandoVerif(true);
    setAvisoVerif(undefined);
    try {
      const r = await api.post<{ verificacionId: string }>('/auth/alta/verificacion', { email, nombre: cuenta.responsable.trim() }, false);
      setVerificacion({ id: r.verificacionId, email, verificado: false });
      setVerificando(true);
      setCooldown(60);
      window.scrollTo(0, 0);
    } catch (e) {
      setErrores({
        email:
          e instanceof ApiError && e.status === 409
            ? 'Ya existe una cuenta con ese correo. Inicia sesión.'
            : 'No pudimos enviar el correo de verificación. Intenta de nuevo.',
      });
    } finally {
      setEnviandoVerif(false);
    }
  }

  async function reenviarVerificacion() {
    if (!verificacion || cooldown > 0) return;
    setAvisoVerif(undefined);
    try {
      await api.post('/auth/alta/verificacion/reenviar', { verificacionId: verificacion.id }, false);
      setCooldown(60);
      setAvisoVerif('Listo, te enviamos otro correo.');
    } catch (e) {
      setAvisoVerif(e instanceof ApiError && e.status === 429 ? 'Espera un momento antes de reenviar.' : 'No pudimos reenviar el correo. Intenta de nuevo.');
    }
  }

  // Polling: cada 4 s se pregunta si el enlace ya se abrió (pudo abrirse en el
  // celular o en otra pestaña); al confirmarse, el asistente avanza solo.
  useEffect(() => {
    if (!verificando || !verificacion || verificacion.verificado) return;
    let activo = true;
    const t = setInterval(() => {
      api
        .get<{ verificado: boolean }>(`/auth/alta/verificacion/${verificacion.id}`, false)
        .then((r) => {
          if (!activo || !r.verificado) return;
          setVerificacion((v) => (v ? { ...v, verificado: true } : v));
          setVerificando(false);
          setPaso(3);
          window.scrollTo(0, 0);
        })
        .catch(() => {
          /* red caída o backend reiniciando: el siguiente tick reintenta */
        });
    }, 4000);
    return () => {
      activo = false;
      clearInterval(t);
    };
  }, [verificando, verificacion]);

  // Cuenta regresiva del botón «Reenviar».
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
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

    // El alta crea una sucursal «Principal»: se renombra a la del asistente y
    // se le fija el horario elegido, que es lo que decide qué puede reservar el
    // cliente desde el enlace público.
    try {
      setProgreso('Configurando tu sucursal…');
      const sucs = await api.get<Sucursal[]>('/sucursales');
      sucursalId = sucs[0]?.id ?? null;
      const nombre = sucursal.nombre.trim();
      if (sucursalId && nombre && nombre !== sucs[0].nombre) {
        await api.patch(`/sucursales/${sucursalId}`, { nombre });
      }
      if (sucursalId) {
        await api.put(`/agenda/horario/sucursal/${sucursalId}/horas`, {
          base: { apertura: sucursal.apertura, cierre: sucursal.cierre },
          dias: [null, null, null, null, null, null, null],
        });
        // El paso 3 promete «Lun a Sáb»: sin esto, el horario base abriría los
        // 7 días y el domingo quedaría reservable. El admin lo abre cuando
        // quiera desde Configuración › Horario.
        await api.put(`/agenda/horario/sucursal/${sucursalId}`, {
          dias: [false, true, true, true, true, true, true],
        });
      }
    } catch {
      fallos.push('No pudimos guardar tu sucursal ni su horario; revísalos en Configuración › Horario.');
    }

    try {
      setProgreso('Activando los módulos elegidos…');
      // Se manda el valor EFECTIVO: encender una bandera que el plan no incluye
      // no da error, pero deja un módulo que nunca responde.
      await Promise.all(MODULOS.map((m) => api.put(`/config/negocio/${negocioId}/${m.clave}`, { valor: modActivo(m.clave) })));
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
    // Sin correo verificado el backend rechaza el registro: mejor devolver al
    // usuario al Paso 2 con la explicación que dejarlo estrellarse con un 403.
    if (!verificacion?.verificado || verificacion.email !== cuenta.email.trim().toLowerCase()) {
      setErrores({ email: 'Verifica tu correo para continuar.' });
      setPaso(2);
      window.scrollTo(0, 0);
      return;
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
          verificacionId: verificacion.id,
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
      // La verificación caducó entre el Paso 2 y este clic: se vuelve a empezar
      // esa parte (correo nuevo → enlace nuevo) en vez de mostrar un 403 seco.
      if (e instanceof ApiError && e.status === 403 && (e.body as { codigo?: string } | null)?.codigo === 'CORREO_NO_VERIFICADO') {
        setVerificacion(null);
        setErrores({ email: 'Tu verificación venció. Verifica tu correo otra vez.' });
        setPaso(2);
        window.scrollTo(0, 0);
        setProgreso('');
        return;
      }
      setErrorServidor(e instanceof Error ? e.message : 'No se pudo crear la cuenta. Intenta de nuevo.');
      setProgreso('');
    } finally {
      setCreando(null);
    }
  }

  const publicUrl = alta?.sucursalId ? `${window.location.origin}/reservar/${alta.sucursalId}` : '';
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

          {/* ── 2b · Espera de verificación del correo (Plan-Correo E2) ── */}
          {paso === 2 && verificando && verificacion && (
            <StepShell n={2} total={TOTAL} title="Revisa tu bandeja de entrada" desc="Para continuar necesitamos confirmar que el correo es tuyo.">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '26px 12px', textAlign: 'center' }}>
                <div aria-hidden style={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--blue-tint, rgba(37,99,235,0.1))' }}>
                  <Icon name="mail" size={30} color="var(--blue)" />
                </div>
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                    Te enviamos un enlace a <strong>{verificacion.email}</strong>.
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    Ábrelo desde cualquier dispositivo; en cuanto lo confirmes, este asistente continúa solo.
                  </p>
                </div>
                <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                  <span className="onb-spin" aria-hidden style={{ width: 14, height: 14, border: '2px solid var(--border-strong)', borderTopColor: 'var(--blue)', borderRadius: '50%', display: 'inline-block', animation: 'onb-girar 0.9s linear infinite' }} />
                  Esperando tu confirmación…
                </div>
                {avisoVerif && <p role="status" style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{avisoVerif}</p>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button variant="secondary" size="md" disabled={cooldown > 0} onClick={() => void reenviarVerificacion()}>
                    {cooldown > 0 ? `Reenviar (${cooldown}s)` : 'Reenviar correo'}
                  </Button>
                  <Button variant="ghost" size="md" onClick={() => { setVerificando(false); setAvisoVerif(undefined); }}>
                    Cambiar correo
                  </Button>
                </div>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  ¿No llega? Revisa la carpeta de spam o correo no deseado.
                </p>
              </div>
              <style>{'@keyframes onb-girar { to { transform: rotate(360deg); } }'}</style>
            </StepShell>
          )}

          {/* ── 2 · Cuenta ─────────────────────────────────────────────── */}
          {paso === 2 && !verificando && (
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
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '8px 0 0' }}>Es el horario que tus clientes podrán reservar. Los días sueltos —el fin de semana, por ejemplo— se ajustan luego en Configuración › Horario.</p>
                  {errores.horario && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--error)', margin: '6px 0 0' }}>{errores.horario}</p>}
                </div>
                <OnbNota>
                  ¿Tienes más sedes? Termina esta primero; podrás agregar las demás desde <strong>Configuración › Sucursales</strong>. Cada sucursal activa se suma a tu suscripción.
                </OnbNota>
              </div>
            </StepShell>
          )}

          {/* ── 4 · Plan (antes que los módulos: los desbloquea) ────────── */}
          {paso === PASO_PLAN && (
            <StepShell n={PASO_PLAN} total={TOTAL} title="Elige tu plan" desc="El plan decide qué módulos puedes activar y cuántas sedes manejas. Empieza con 15 días de prueba o paga desde hoy; puedes cambiarlo cuando quieras.">
              <PasoPlan
                planId={planId}
                setPlanId={setPlanId}
                especialistas={numEspecialistas}
                setEspecialistas={setEspecialistas}
                ciclo={ciclo}
                setCiclo={setCiclo}
                onVentas={() => go('contacto')}
              />
            </StepShell>
          )}

          {/* ── 5 · Módulos (solo los que el plan incluye) ──────────────── */}
          {paso === 5 && (
            <StepShell n={5} total={TOTAL} title="Activa lo que necesitas" desc={`Preparamos los módulos recomendados para tu ${perfil === PerfilNegocio.Salon ? 'salón' : 'barbería'} dentro de tu plan ${plan.name}. Los esenciales vienen activos; ajústalos a tu gusto.`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {MODULOS.some((m) => !planIncluyeModulo(planId, m.clave)) && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: 13, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)' }}>
                    <Icon name="lock" size={17} color="var(--text-tertiary)" style={{ flex: 'none', marginTop: 1 }} />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: '20px' }}>
                      El plan <strong>{plan.name}</strong> trae la agenda, las reservas y los clientes. Inventario, repartición y cierres se desbloquean desde <strong>Pro</strong>.
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => saltarA(PASO_PLAN)}>Cambiar plan</Button>
                  </div>
                )}
                <Card padding={4}>
                  {MODULOS.map((m, i) => {
                    const disponible = planIncluyeModulo(planId, m.clave);
                    const minimo = disponible ? undefined : planMinimoParaModulo(m.clave);
                    return (
                      <div key={m.clave} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 14px', borderTop: i ? '1px solid var(--border-subtle)' : 'none', opacity: disponible ? 1 : 0.6 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', flex: 'none', marginTop: 1 }}>
                          <Icon name={disponible ? m.icon : 'lock'} size={19} color="var(--text-secondary)" />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 4 }}>
                            <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{m.nombre}</span>
                            {!disponible && minimo ? <Badge tone="neutral" size="md">Desde {minimo.name}</Badge>
                              : m.recomendado[perfil] && <Badge tone="brand" size="md">Recomendado</Badge>}
                          </div>
                          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '3px 0 0', maxWidth: 460, lineHeight: '20px' }}>{m.desc}</p>
                        </div>
                        <div style={{ flex: 'none', paddingTop: 4 }}>
                          <Switch testId={`alta-modulo-${m.clave}`} checked={modActivo(m.clave)} disabled={!disponible} onChange={(v) => setMods((o) => ({ ...o, [m.clave]: v }))} />
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            </StepShell>
          )}

          {/* ── 6 · Equipo + alta (último paso de configuración) ────────── */}
          {paso === PASO_FINAL && (
            <StepShell n={PASO_FINAL} total={TOTAL} optional title="Agrega tu equipo" desc={`Suma a tus ${espWord}s y asígnalos a la sucursal. Este paso es opcional: si prefieres, crea tu cuenta y hazlo después.`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
                <PasoEquipo equipo={equipo} setEquipo={setEquipo} espWord={espWord} sucursalNombre={sucursal.nombre || 'Tu sucursal'} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 22, borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="eyebrow">Ya está: crea tu cuenta</div>
                  <Card padding={18}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', rowGap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{plan.name} · {numEspecialistas} especialistas</div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                          {ciclo === 'anual' ? `Facturación anual · ${money(annualTotal(plan, numEspecialistas))}/año` : 'Facturación mensual'} · {modsActivos} módulos activos
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>{money(precioMostrado)}<span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>/mes</span></span>
                        <Button variant="ghost" size="sm" onClick={() => saltarA(PASO_PLAN)}>Cambiar</Button>
                      </div>
                    </div>
                  </Card>

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

          {/* Navegación. El último paso de configuración lleva sus propios CTA
              de alta, así que allí solo queda «Atrás». */}
          {paso < PASO_FINAL && !(paso === 2 && verificando) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, gap: 12 }}>
              <div>{paso > 1 && <Button variant="ghost" size="lg" iconLeft="arrow-left" onClick={atras}>Atrás</Button>}</div>
              <Button variant="primary" size="lg" iconRight="arrow-right" loading={enviandoVerif} disabled={enviandoVerif} onClick={continuar}>Continuar</Button>
            </div>
          )}
          {paso === PASO_FINAL && (
            <div style={{ marginTop: 22 }}>
              <Button variant="ghost" size="lg" iconLeft="arrow-left" disabled={!!creando} onClick={atras}>Atrás</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Plan (paso 4) ────────────────────────────────────────────────────────────
/**
 * Elección de plan. Los controles que mueven el precio (nº de especialistas y
 * ciclo) van ARRIBA: así las tres tarjetas muestran ya el precio real de cada
 * plan para ese negocio y la comparación es directa, en vez de un «desde».
 */
function PasoPlan({ planId, setPlanId, especialistas, setEspecialistas, ciclo, setCiclo, onVentas }: {
  planId: string;
  setPlanId: (v: string) => void;
  especialistas: number;
  setEspecialistas: (v: number) => void;
  ciclo: Ciclo;
  setCiclo: (v: Ciclo) => void;
  onVentas: () => void;
}) {
  const [comparar, setComparar] = useState(false);
  const plan = planById(planId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card padding={16}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', rowGap: 14 }}>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>¿Cuántos especialistas atienden?</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Cada plan incluye {plan.included}; los precios de abajo ya cuentan los extra.</div>
          </div>
          {/* El mínimo es lo que incluye el plan: el backend rechaza un cupo menor. */}
          <QtyStepper value={especialistas} onChange={setEspecialistas} min={plan.included} max={30} />
        </div>
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '14px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', rowGap: 14 }}>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Facturación</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>La anual te deja 2 meses gratis.</div>
          </div>
          {/* Ancho fijo: los botones de `Segmented` son `flex:1` con
              `min-width:0`, así que sin él la tira se encoge y trunca las
              etiquetas («Mens…»). */}
          <div style={{ flex: 'none', width: 210 }}>
            <Segmented value={ciclo} onChange={(v) => setCiclo(v as Ciclo)} options={[{ value: 'mensual', label: 'Mensual' }, { value: 'anual', label: 'Anual' }]} />
          </div>
        </div>
      </Card>

      <div className="onb-grid-3">
        {PLANES_ALTA.map((p) => (
          <TarjetaPlan key={p.id} plan={p} selected={planId === p.id} especialistas={especialistas} ciclo={ciclo} onClick={() => setPlanId(p.id)} />
        ))}
      </div>

      <div>
        <Button variant="ghost" size="md" iconRight={comparar ? 'chevron-up' : 'chevron-down'} onClick={() => setComparar((v) => !v)}>
          {comparar ? 'Ocultar la comparación' : 'Comparar los tres planes en detalle'}
        </Button>
        {comparar && <TablaPlanes planId={planId} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        <Icon name="building-2" size={16} color="var(--text-tertiary)" />
        ¿Cadena con varias sedes? El plan Empresarial es a la medida.
        <button type="button" onClick={onVentas} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--brand)', fontWeight: 600, fontSize: 'var(--text-sm)', padding: 0 }}>Habla con ventas</button>
      </div>
    </div>
  );
}

/** Tarjeta de plan: precio ya calculado para este negocio + qué incluye. */
function TarjetaPlan({ plan, selected, especialistas, ciclo, onClick }: { plan: Plan; selected: boolean; especialistas: number; ciclo: Ciclo; onClick: () => void }) {
  const esp = Math.max(especialistas, plan.included);
  const mes = monthly(plan, esp);
  const mostrado = ciclo === 'anual' ? Math.round((mes * 10) / 12) : mes;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', textAlign: 'left', padding: 20, cursor: 'pointer', height: '100%',
        border: `1.5px solid ${selected ? 'var(--brand)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-lg)',
        background: selected ? 'var(--brand-tint)' : 'var(--surface-card)', boxShadow: selected ? '0 0 0 1px var(--brand)' : 'var(--shadow-xs)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>{plan.name}</span>
          {plan.highlight && <Badge tone="brand" size="md">Recomendado</Badge>}
        </span>
        <span style={{ width: 22, height: 22, borderRadius: 999, flex: 'none', border: `2px solid ${selected ? 'var(--brand)' : 'var(--border-strong)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {selected && <span style={{ width: 11, height: 11, borderRadius: 999, background: 'var(--brand)' }} />}
        </span>
      </div>

      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.45, minHeight: 40 }}>{plan.blurb}</span>

      <div style={{ margin: '14px 0 4px' }}>
        <span className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{money(mostrado)}</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>/mes</span>
      </div>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        {ciclo === 'anual'
          ? `Facturado anual · ${money(annualTotal(plan, esp))}/año`
          : esp > plan.included
            ? `Base ${money(plan.base)} + ${esp - plan.included} extra × ${money(plan.perExtra)}`
            : `Incluye ${plan.included} especialistas`}
      </span>

      <div style={{ height: 1, background: selected ? 'var(--brand-tint-border)' : 'var(--border-subtle)', margin: '16px 0 14px' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {plan.perks.map((perk) => (
          <span key={perk} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            <Icon name="check" size={15} color="var(--success)" style={{ flex: 'none', marginTop: 2 }} />
            {perk}
          </span>
        ))}
      </div>
    </button>
  );
}

/** Matriz de funciones de los tres planes contratables (misma de /comparativa). */
function TablaPlanes({ planId }: { planId: string }) {
  const celda = (v: boolean | string) => {
    if (v === true) return <Icon name="check" size={16} color="var(--success)" />;
    if (v === false || v === '—') return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
    return <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{v}</span>;
  };
  const th: CSSProperties = { padding: '10px 12px', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', textAlign: 'center' };
  const td: CSSProperties = { padding: '10px 12px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)' };
  return (
    <div style={{ marginTop: 12, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Función</th>
            {PLANES_ALTA.map((p) => (
              <th key={p.id} style={{ ...th, color: p.id === planId ? 'var(--brand)' : 'var(--text-tertiary)', background: p.id === planId ? 'var(--brand-tint)' : 'transparent' }}>{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_GROUPS.map((g) => (
            <Fragment key={g.group}>
              <tr>
                <td colSpan={1 + PLANES_ALTA.length} style={{ ...td, fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)', background: 'var(--surface-sunken)' }}>{g.group}</td>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <td style={td}>{r.label}</td>
                  {PLANES_ALTA.map((p, i) => (
                    <td key={p.id} style={{ ...td, textAlign: 'center', background: p.id === planId ? 'var(--brand-tint)' : 'transparent' }}>{celda(r.vals[i])}</td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
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
            <Icon name="link" size={16} color="var(--accent-on-inverse)" />
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
