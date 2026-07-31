import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../ui';
import { GField, GInput } from '../onboarding/onboarding-ui';
import { CargandoEnlace, EstadoEnlace, TarjetaEnlace } from './correo-ui';

type Fase = 'validando' | 'formulario' | 'invalido' | 'listo';

/**
 * Destino del enlace «Crear nueva contraseña» (Plan-Correo E3). Valida el token
 * antes de pintar el formulario: un enlace vencido merece el mensaje claro de
 * entrada, no un error después de teclear dos veces la contraseña.
 */
export function RestablecerPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [fase, setFase] = useState<Fase>('validando');
  const [pass, setPass] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!token) {
      setFase('invalido');
      return;
    }
    api
      .get<{ valido: boolean }>(`/auth/password/token/${token}`, false)
      .then((r) => setFase(r.valido ? 'formulario' : 'invalido'))
      .catch(() => setFase('invalido'));
  }, [token]);

  async function guardar() {
    if (enviando) return;
    if (pass.length < 8) {
      setError('Mínimo 8 caracteres.');
      return;
    }
    if (pass !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError(undefined);
    setEnviando(true);
    try {
      await api.post('/auth/password/restablecer', { token, password: pass }, false);
      setFase('listo');
    } catch {
      // 401 = el enlace se gastó o venció entre la validación y el envío.
      setFase('invalido');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TarjetaEnlace>
      {fase === 'validando' && <CargandoEnlace texto="Revisando el enlace…" />}

      {fase === 'formulario' && (
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>Crea tu nueva contraseña</h1>
          <p style={{ margin: '0 0 22px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Con ella entrarás a Orkalis desde ahora. Las sesiones abiertas en otros dispositivos se cerrarán.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); void guardar(); }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <GField label="Nueva contraseña" hint="mínimo 8 caracteres" error={error}>
              <GInput value={pass} onChange={setPass} type="password" placeholder="Crea una contraseña" invalid={!!error} autoComplete="new-password" revelable />
            </GField>
            <GField label="Confírmala">
              <GInput value={confirmar} onChange={setConfirmar} type="password" placeholder="Repite la contraseña" invalid={!!error} autoComplete="new-password" onEnter={() => void guardar()} />
            </GField>
            <Button type="submit" variant="primary" size="lg" fullWidth loading={enviando} disabled={enviando}>
              Guardar contraseña
            </Button>
          </form>
        </div>
      )}

      {fase === 'invalido' && (
        <EstadoEnlace tono="error" icon="alert-circle" titulo="Este enlace no es válido o ya venció">
          <p style={{ margin: '0 0 16px' }}>Los enlaces sirven una sola vez y vencen a los 60 minutos. Pide uno nuevo desde el inicio de sesión.</p>
          <Link to="/login"><Button variant="primary" fullWidth>Pedir otro enlace</Button></Link>
        </EstadoEnlace>
      )}

      {fase === 'listo' && (
        <EstadoEnlace tono="ok" icon="check-circle" titulo="Contraseña actualizada">
          <p style={{ margin: '0 0 16px' }}>Ya puedes entrar con tu nueva contraseña.</p>
          <Link to="/login"><Button variant="primary" fullWidth>Iniciar sesión</Button></Link>
        </EstadoEnlace>
      )}
    </TarjetaEnlace>
  );
}
