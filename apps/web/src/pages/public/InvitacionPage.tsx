import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { miTelefonoIniciar } from '../../lib/useEquipo';
import { Button, Icon } from '../../ui';
import { GField, GInput } from '../onboarding/onboarding-ui';
import { CargandoEnlace, EstadoEnlace, TarjetaEnlace } from './correo-ui';

type Info =
  | { estado: 'valida'; nombre: string; negocio: string; email: string }
  | { estado: 'usada' }
  | { estado: 'invalida' };

type Paso = 'cargando' | 'password' | 'celular' | 'enviado' | 'listo' | 'usada' | 'invalida';

/**
 * Activación de la cuenta del especialista (Plan-Correo E5, D4): desde el
 * enlace que le llegó al correo, ① crea su contraseña, ② registra su celular y
 * confirma el código SMS, ③ entra a su panel. Si la mensajería está pausada
 * (D5), el celular se pospone y lo verifica después desde su panel.
 */
export function InvitacionPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { login } = useAuth();

  const [paso, setPaso] = useState<Paso>('cargando');
  const [info, setInfo] = useState<Extract<Info, { estado: 'valida' }> | null>(null);
  const [pass, setPass] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [celular, setCelular] = useState('');
  const [error, setError] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  const cargada = useRef(false);

  useEffect(() => {
    if (cargada.current) return;
    cargada.current = true;
    if (!token) {
      setPaso('invalida');
      return;
    }
    api
      .get<Info>(`/public/invitacion/${token}`, false)
      .then((r) => {
        if (r.estado === 'valida') {
          setInfo(r);
          setPaso('password');
        } else setPaso(r.estado);
      })
      .catch(() => setPaso('invalida'));
  }, [token]);

  async function activar() {
    if (ocupado || !info) return;
    if (pass.length < 8) { setError('Mínimo 8 caracteres.'); return; }
    if (pass !== confirmar) { setError('Las contraseñas no coinciden.'); return; }
    setError(undefined);
    setOcupado(true);
    try {
      await api.post(`/public/invitacion/${token}/activar`, { password: pass }, false);
      // Sesión inmediata con las credenciales recién creadas: el paso del
      // celular usa endpoints autenticados del propio especialista.
      await login(info.email, pass);
      setPaso('celular');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setPaso('usada');
      else if (e instanceof ApiError && e.status === 400) setPaso('invalida');
      else setError('No pudimos activar tu cuenta. Intenta de nuevo.');
    } finally {
      setOcupado(false);
    }
  }

  async function guardarCelular() {
    if (ocupado) return;
    const digitos = celular.replace(/\D/g, '').replace(/^57/, '');
    if (!/^3\d{9}$/.test(digitos)) { setError('Celular de 10 dígitos que empiece por 3.'); return; }
    setError(undefined);
    setOcupado(true);
    try {
      await miTelefonoIniciar(digitos);
      setPaso('enviado');
      setAviso(undefined);
    } catch (e) {
      // Mensajería pausada (D5): se entra igual y se registra después.
      if (e instanceof ApiError && e.status === 409 && (e.body as { codigo?: string } | null)?.codigo === 'SIN_MENSAJERIA') {
        setAviso('Ahora mismo no podemos enviar mensajes. Podrás registrar tu celular más tarde desde tu panel.');
        setPaso('listo');
      } else if (e instanceof ApiError && e.status === 429) setError('Demasiados intentos. Espera un minuto.');
      else setError(e instanceof Error ? e.message : 'No pudimos guardar el número.');
    } finally {
      setOcupado(false);
    }
  }

  const indicador = paso === 'password' ? 1 : paso === 'celular' || paso === 'enviado' ? 2 : paso === 'listo' ? 3 : 0;

  return (
    <TarjetaEnlace>
      {indicador > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }} aria-label={`Paso ${indicador} de 3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} style={{ flex: 1, height: 4, borderRadius: 999, background: n <= indicador ? 'var(--blue)' : 'var(--border-subtle)' }} />
          ))}
        </div>
      )}

      {paso === 'cargando' && <CargandoEnlace texto="Abriendo tu invitación…" />}

      {paso === 'password' && info && (
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>Hola {info.nombre} 👋</h1>
          <p style={{ margin: '0 0 22px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            <strong>{info.negocio}</strong> te invitó a Orkalis: allí verás tu agenda, tus citas y tus ganancias.
            Entrarás con <strong>{info.email}</strong> y la contraseña que crees aquí.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); void activar(); }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <GField label="Crea tu contraseña" hint="mínimo 8 caracteres" error={error}>
              <GInput value={pass} onChange={setPass} type="password" placeholder="Tu contraseña" invalid={!!error} autoComplete="new-password" revelable />
            </GField>
            <GField label="Confírmala">
              <GInput value={confirmar} onChange={setConfirmar} type="password" placeholder="Repítela" invalid={!!error} autoComplete="new-password" onEnter={() => void activar()} />
            </GField>
            <Button type="submit" variant="primary" size="lg" fullWidth loading={ocupado} disabled={ocupado}>Activar mi cuenta</Button>
          </form>
        </div>
      )}

      {paso === 'celular' && (
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>Tu celular</h1>
          <p style={{ margin: '0 0 22px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Con él te avisamos de tus citas nuevas, canceladas o reagendadas. Te llegará un mensaje de prueba para comprobar que quedó bien.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); void guardarCelular(); }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <GField label="Celular" error={error}>
              <GInput value={celular} onChange={setCelular} type="tel" placeholder="300 123 4567" invalid={!!error} autoComplete="tel" onEnter={() => void guardarCelular()} />
            </GField>
            <Button type="submit" variant="primary" size="lg" fullWidth loading={ocupado} disabled={ocupado}>Guardar y probar</Button>
            <button type="button" onClick={() => { setAviso('Puedes registrar tu celular cuando quieras desde tu panel.'); setPaso('listo'); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-tertiary)' }}>
              Lo haré después
            </button>
          </form>
        </div>
      )}

      {paso === 'enviado' && (
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>Revisa tus mensajes</h1>
          <p style={{ margin: '0 0 22px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Enviamos un mensaje de prueba al <strong>{celular}</strong>. Si te llegó, tu número quedó listo; si no, corrígelo y vuelve a intentarlo.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Button variant="primary" size="lg" fullWidth onClick={() => setPaso('listo')}>Me llegó, continuar</Button>
            <Button variant="secondary" size="lg" fullWidth onClick={() => setPaso('celular')}>No llegó · corregir número</Button>
          </div>
        </div>
      )}

      {paso === 'listo' && (
        <EstadoEnlace tono="ok" icon="check-circle" titulo="¡Tu cuenta está lista!">
          {aviso && (
            <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '0 0 12px', textAlign: 'left' }}>
              <Icon name="info" size={15} color="var(--text-tertiary)" style={{ flex: 'none', marginTop: 2 }} />
              <span>{aviso}</span>
            </p>
          )}
          <Button variant="primary" fullWidth onClick={() => navigate('/especialista')}>Entrar a mi panel</Button>
        </EstadoEnlace>
      )}

      {paso === 'usada' && (
        <EstadoEnlace tono="info" icon="check-circle" titulo="Esta invitación ya se activó">
          <p style={{ margin: '0 0 16px' }}>Entra con tu correo y la contraseña que creaste. ¿La olvidaste? En el inicio de sesión puedes recuperarla.</p>
          <Link to="/login"><Button variant="primary" fullWidth>Iniciar sesión</Button></Link>
        </EstadoEnlace>
      )}

      {paso === 'invalida' && (
        <EstadoEnlace tono="error" icon="alert-circle" titulo="La invitación no es válida o ya venció">
          <p style={{ margin: 0 }}>Las invitaciones vencen a los 7 días. Pide al negocio que te la reenvíe desde su pantalla de Equipo.</p>
        </EstadoEnlace>
      )}
    </TarjetaEnlace>
  );
}
