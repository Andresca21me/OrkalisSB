import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../ui';
import { CargandoEnlace, EstadoEnlace, TarjetaEnlace } from './correo-ui';

type Estado = { fase: 'procesando' } | { fase: 'ok'; contexto: string } | { fase: 'error' };

/**
 * Destino del enlace «Confirmar mi correo» (Plan-Correo E2/E4). Atiende dos
 * contextos que el backend distingue por el token: la verificación del alta
 * (el asistente en la otra pestaña avanza solo vía polling) y la confirmación
 * del cambio de correo de una cuenta existente.
 */
export function VerificarCorreoPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [estado, setEstado] = useState<Estado>({ fase: 'procesando' });
  // El StrictMode de React monta dos veces en dev; sin este candado el segundo
  // POST llegaría con el token ya usado (el backend igual responde amistoso).
  const lanzado = useRef(false);

  useEffect(() => {
    if (lanzado.current) return;
    lanzado.current = true;
    if (!token) {
      setEstado({ fase: 'error' });
      return;
    }
    api
      .post<{ ok: true; contexto: string }>('/auth/verificar-correo', { token }, false)
      .then((r) => setEstado({ fase: 'ok', contexto: r.contexto }))
      .catch(() => setEstado({ fase: 'error' }));
  }, [token]);

  return (
    <TarjetaEnlace>
      {estado.fase === 'procesando' && <CargandoEnlace texto="Confirmando tu correo…" />}

      {estado.fase === 'ok' && estado.contexto === 'alta' && (
        <EstadoEnlace tono="ok" icon="check-circle" titulo="¡Correo confirmado!">
          <p style={{ margin: 0 }}>
            Vuelve a la pestaña donde estabas creando tu cuenta: el asistente continúa solo.
            Si la cerraste, puedes empezar de nuevo desde <Link to="/alta" style={{ color: 'var(--blue)', fontWeight: 600 }}>orkalis.com/alta</Link>.
          </p>
        </EstadoEnlace>
      )}

      {estado.fase === 'ok' && estado.contexto !== 'alta' && (
        <EstadoEnlace tono="ok" icon="check-circle" titulo="Tu correo quedó actualizado">
          <p style={{ margin: '0 0 16px' }}>Desde ahora entras a Orkalis con esta dirección.</p>
          <Link to="/login"><Button variant="primary" fullWidth>Ir a iniciar sesión</Button></Link>
        </EstadoEnlace>
      )}

      {estado.fase === 'error' && (
        <EstadoEnlace tono="error" icon="alert-circle" titulo="Este enlace no es válido o ya venció">
          <p style={{ margin: 0 }}>
            Pide uno nuevo desde donde iniciaste el proceso: el asistente de registro tiene el botón
            «Reenviar correo», y el cambio de correo se repite desde Configuración › Cuenta.
          </p>
        </EstadoEnlace>
      )}
    </TarjetaEnlace>
  );
}
