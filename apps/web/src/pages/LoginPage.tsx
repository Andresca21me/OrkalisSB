import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type MotivoBloqueo } from '../lib/auth';
import { ApiError } from '../lib/api';
import { Button, Icon, Logo, Spinner } from '../ui/ui';

type EstadoLogin = 'normal' | 'suspendida' | 'bloqueo';

/**
 * Login del panel (FASE-02), fiel a `login-app.jsx`: pantalla dividida (panel
 * de marca navy + tarjeta de ingreso). Estados: normal, error de credenciales,
 * cargando, cuenta suspendida y bloqueo por intentos.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { login, cuentaSuspendida, motivoBloqueo } = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState<EstadoLogin>('normal');

  const vista: EstadoLogin = cuentaSuspendida ? 'suspendida' : estado;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await login(email, pass);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setEstado('bloqueo');
      } else if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
        setError('Correo o contraseña incorrectos.');
      } else if (err instanceof ApiError && err.status >= 500) {
        setError('No pudimos conectar con el servidor. Verifica que el backend (apps/api) esté activo e inténtalo de nuevo.');
      } else if (!cuentaSuspendida) {
        setError((err as Error).message);
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface-page)' }}>
      {/* ── Panel de marca ── */}
      <aside
        className="ork-brandpane"
        style={{
          position: 'relative',
          flex: '0 0 46%',
          maxWidth: 620,
          background: 'var(--navy)',
          color: '#fff',
          padding: '48px 56px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)', backgroundSize: '26px 26px' }} />
        <div
          style={{ position: 'absolute', right: -120, bottom: -120, width: 380, height: 380, pointerEvents: 'none', opacity: 0.16 }}
          dangerouslySetInnerHTML={{ __html: '<svg width="380" height="380" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="2.5" width="19" height="19" rx="6.5" stroke="#fff" stroke-width="1"/><circle cx="14.5" cy="14.5" r="4.2" stroke="#fff" stroke-width="1"/></svg>' }}
        />
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => navigate('/')} aria-label="Volver al inicio" style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'inline-flex' }}>
            <Logo color="#fff" />
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 11px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,255,255,0.10)', marginBottom: 20 }}>
            <Icon name="store" size={14} color="var(--accent)" />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)' }}>Panel de administración</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, letterSpacing: '-0.03em', lineHeight: 1.06, margin: 0, color: '#fff' }}>Tu negocio, bajo control</h1>
          <p style={{ fontSize: 'var(--text-md)', color: 'rgba(255,255,255,0.72)', margin: '14px 0 0', maxWidth: 380, lineHeight: 1.5 }}>
            Gestiona tu agenda, tu equipo y tus finanzas desde un solo lugar.
          </p>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.6)' }}>
          <Icon name="shield-check" size={16} color="rgba(255,255,255,0.6)" />
          Acceso seguro · solo personal autorizado
        </div>
      </aside>

      {/* ── Tarjeta de ingreso ── */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <button type="button" onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, marginBottom: 22, fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <Icon name="chevron-left" size={16} color="var(--text-secondary)" /> Volver al inicio
          </button>
          <button type="button" className="ork-mobilelogo" onClick={() => navigate('/')} aria-label="Volver al inicio" style={{ display: 'none', marginBottom: 28, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
            <Logo />
          </button>

          {vista === 'suspendida' ? (
            <SuspendedNotice motivo={motivoBloqueo} onVolver={() => window.location.reload()} />
          ) : vista === 'bloqueo' ? (
            <LockedNotice />
          ) : (
            <>
              <h2 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em', margin: 0 }}>Ingresa a tu panel</h2>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', margin: '8px 0 26px' }}>Usa el correo con el que te invitaron al negocio.</p>

              {error && (
                <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--error-tint)', border: '1px solid rgba(239,68,68,0.24)', marginBottom: 18 }}>
                  <Icon name="alert-circle" size={18} color="var(--error)" style={{ flex: 'none', marginTop: 1 }} />
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: '20px' }}>
                    <strong>{error}</strong>
                  </div>
                </div>
              )}

              <form onSubmit={enviar}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <LoginField label="Correo" type="email" icon="mail" value={email} onChange={setEmail} placeholder="tu@negocio.co" invalid={!!error} disabled={cargando} autoComplete="username" />
                  <LoginField
                    label="Contraseña"
                    type={ver ? 'text' : 'password'}
                    icon="lock"
                    value={pass}
                    onChange={setPass}
                    placeholder="Tu contraseña"
                    invalid={!!error}
                    disabled={cargando}
                    autoComplete="current-password"
                    trailing={
                      <button type="button" onClick={() => setVer((s) => !s)} aria-label={ver ? 'Ocultar' : 'Mostrar'} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', padding: 2 }}>
                        <Icon name={ver ? 'eye-off' : 'eye'} size={18} color="var(--text-tertiary)" />
                      </button>
                    }
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '12px 0 22px' }}>
                  <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--brand)' }}>¿Olvidaste tu contraseña?</a>
                </div>

                <Button type="submit" variant="primary" size="lg" fullWidth disabled={cargando}>
                  {cargando ? (
                    <>
                      <Spinner size={18} color="#fff" /> Entrando…
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>

              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'center', margin: '22px 0 0', lineHeight: '18px' }}>
                No hay registro público. El acceso es solo para el personal del negocio.
                <br />
                ¿Problemas para entrar? Escribe a{' '}
                <a href="mailto:soporte@orkalis.co" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>soporte@orkalis.co</a>
              </p>
            </>
          )}
        </div>
      </main>

      <style>{`
        @media (max-width: 860px) {
          .ork-brandpane { display: none !important; }
          .ork-mobilelogo { display: block !important; }
        }
      `}</style>
    </div>
  );
}

// Campo con label arriba (patrón del prototipo).
function LoginField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  invalid,
  icon,
  trailing,
  disabled,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  icon?: string;
  trailing?: React.ReactNode;
  disabled?: boolean;
  autoComplete?: string;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          height: 48,
          padding: '0 12px',
          background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${invalid ? 'var(--error)' : focus ? 'var(--brand)' : 'var(--border-default)'}`,
          boxShadow: focus ? `0 0 0 3px ${invalid ? 'var(--error-tint)' : 'var(--brand-tint)'}` : 'none',
          transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
        }}
      >
        {icon && <Icon name={icon} size={18} color="var(--text-tertiary)" />}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}
        />
        {trailing}
      </div>
    </label>
  );
}

// Aviso de acceso bloqueado: prueba vencida (FASE-04) o cuenta suspendida por pago.
function SuspendedNotice({ motivo, onVolver }: { motivo: MotivoBloqueo | null; onVolver: () => void }) {
  const prueba = motivo === 'prueba_vencida';
  return (
    <div>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 'var(--radius-lg)', background: prueba ? 'var(--brand-tint)' : 'var(--error-tint)', marginBottom: 18 }}>
        <Icon name={prueba ? 'sparkles' : 'alert-octagon'} size={26} color={prueba ? 'var(--brand)' : 'var(--error)'} />
      </span>
      <h2 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em', margin: 0 }}>
        {prueba ? 'Tu prueba terminó' : 'Cuenta suspendida'}
      </h2>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', margin: '10px 0 0', lineHeight: 1.5 }}>
        {prueba
          ? 'Se acabaron tus 15 días de prueba. Agrega un método de pago para reactivar el acceso al panel y seguir operando.'
          : 'El acceso al panel está suspendido por un pago pendiente de la suscripción. Mientras tanto, el equipo no puede agendar ni cobrar.'}
      </p>
      <div style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', margin: '22px 0' }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          {prueba ? '¿Cómo continuar?' : '¿Cómo reactivarla?'}
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: '20px' }}>
          {prueba
            ? 'Inicia sesión como administrador y agrega tu método de pago en Suscripción para activar tu plan.'
            : 'El administrador de la cuenta puede regularizar el pago desde Suscripción. Si crees que es un error, contáctanos.'}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {prueba ? (
          <Button variant="primary" size="lg" fullWidth iconLeft="credit-card" onClick={onVolver}>
            Iniciar sesión para pagar
          </Button>
        ) : (
          <Button variant="primary" size="lg" fullWidth iconLeft="mail" onClick={() => (window.location.href = 'mailto:soporte@orkalis.co')}>
            Contactar a soporte
          </Button>
        )}
        <Button variant="ghost" size="lg" fullWidth onClick={onVolver}>
          Volver al ingreso
        </Button>
      </div>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'center', margin: '18px 0 0' }}>soporte@orkalis.co · +57 601 432 0099</p>
    </div>
  );
}

// Bloqueo por intentos (cuenta regresiva).
function LockedNotice() {
  const [secs, setSecs] = useState(294);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return (
    <div>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 'var(--radius-lg)', background: 'var(--warning-tint)', marginBottom: 18 }}>
        <Icon name="lock" size={24} color="#B45309" />
      </span>
      <h2 style={{ fontSize: 'var(--text-2xl)', letterSpacing: '-0.02em', margin: 0 }}>Acceso bloqueado temporalmente</h2>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', margin: '10px 0 22px', lineHeight: 1.5 }}>
        Detectamos demasiados intentos fallidos. Por seguridad, espera antes de volver a intentar.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
        <Icon name="clock" size={20} color="var(--text-tertiary)" />
        <div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Podrás intentar de nuevo en</div>
          <div className="data" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-xl)', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {mm}:{ss}
          </div>
        </div>
      </div>
    </div>
  );
}
