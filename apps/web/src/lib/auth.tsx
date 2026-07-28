import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { EstadoSuscripcion, type PerfilNegocio, type PlanSuscripcion, type SesionUsuario } from '@orkalis/shared';
import { api, ApiError, tokens, urlFotoEspecialista } from './api';

/** Usuario en sesión = respuesta de `GET /auth/me` (incluye su negocio). */
export type Usuario = SesionUsuario;

/** Datos del alta pública (Plan-Pagos FASE-03). */
export interface RegistroPayload {
  negocioNombre: string;
  perfil: PerfilNegocio;
  plan: PlanSuscripcion;
  numEspecialistas: number;
  admin: { nombre: string; email: string; password: string };
  modo: 'prueba' | 'pago';
}

/** Opciones del alta. */
export interface RegistroOpciones {
  /** Activar la sesión al terminar (default `true`). Ver `registrar`. */
  entrar?: boolean;
}

/** Resultado del alta: a dónde enrutar el front. */
export interface RegistroResultado {
  negocioId: string;
  modo: 'prueba' | 'pago';
  requierePago: boolean;
}

/** Motivo del bloqueo de acceso (Plan-Pagos FASE-04/11). */
export type MotivoBloqueo = 'prueba_vencida' | 'suspendida' | 'cancelada';

interface AuthState {
  usuario: Usuario | null;
  cargando: boolean;
  cuentaSuspendida: boolean;
  motivoBloqueo: MotivoBloqueo | null;
  login: (email: string, password: string) => Promise<void>;
  registrar: (datos: RegistroPayload, opts?: RegistroOpciones) => Promise<RegistroResultado>;
  logout: () => Promise<void>;
  refrescar: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/** Lee el `motivo` del cuerpo de un error 403 de acceso, si viene. */
function motivoDeError(e: unknown): MotivoBloqueo | null {
  if (e instanceof ApiError && e.body && typeof e.body === 'object') {
    const m = (e.body as { motivo?: string }).motivo;
    if (m === 'prueba_vencida' || m === 'suspendida' || m === 'cancelada') return m;
  }
  return null;
}

/** `true` si el 403 es el bloqueo por suscripción (no otro forbidden). */
function esBloqueoSuscripcion(e: unknown): boolean {
  return (
    e instanceof ApiError &&
    e.status === 403 &&
    typeof e.body === 'object' &&
    (e.body as { codigo?: string })?.codigo === 'SUSCRIPCION_BLOQUEADA'
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cuentaSuspendida, setSuspendida] = useState(false);
  const [motivoBloqueo, setMotivo] = useState<MotivoBloqueo | null>(null);

  const cargarMe = useCallback(async () => {
    if (!tokens.access) {
      setUsuario(null);
      setCargando(false);
      return;
    }
    try {
      const me = await api.get<Usuario>('/auth/me');
      setUsuario(me);
      setSuspendida(false);
      setMotivo(null);
    } catch (e) {
      if (esBloqueoSuscripcion(e)) {
        // Sesión LIMITADA (FASE-11): conserva los tokens para poder pagar en la
        // pantalla de recuperación; el router lleva a /recuperar.
        setSuspendida(true);
        setMotivo(motivoDeError(e) ?? 'suspendida');
        setUsuario(null);
      } else {
        // 401 u otro error: token inválido → sesión cerrada.
        setUsuario(null);
        tokens.clear();
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarMe();
  }, [cargarMe]);

  const login = useCallback(async (email: string, password: string) => {
    setSuspendida(false);
    setMotivo(null);
    try {
      const r = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/login',
        { email, password },
        false,
      );
      tokens.set(r.accessToken, r.refreshToken);
      const me = await api.get<Usuario>('/auth/me');
      setUsuario(me);
      setSuspendida(false);
      setMotivo(null);
    } catch (e) {
      // El login pudo ser OK pero `me` da 403 por suscripción bloqueada: NO se
      // lanza error; se conservan los tokens (sesión limitada) y el router envía
      // a /recuperar para pagar (FASE-11).
      if (esBloqueoSuscripcion(e)) {
        setSuspendida(true);
        setMotivo(motivoDeError(e) ?? 'suspendida');
        setUsuario(null);
        return;
      }
      // Credenciales malas u otro error: se limpia cualquier token a medias.
      if (!tokens.access) {
        /* login falló antes de setear tokens */
      }
      throw e;
    }
  }, []);

  const registrar = useCallback(async (datos: RegistroPayload, opts?: RegistroOpciones): Promise<RegistroResultado> => {
    setSuspendida(false);
    const r = await api.post<RegistroResultado & { accessToken: string; refreshToken: string }>(
      '/auth/registro',
      datos,
      false,
    );
    tokens.set(r.accessToken, r.refreshToken);
    // Modo prueba: entra de una vez (carga la sesión → el router lleva al panel).
    // Modo pago: dejamos los tokens pero NO iniciamos sesión todavía; el front
    // enruta al checkout (FASE-05) y allí, tras pagar, se entra al panel.
    //
    // `entrar: false` (asistente de alta): la sesión queda EMITIDA pero sin
    // activar. Es lo que permite seguir configurando el negocio recién creado
    // —sucursal, módulos, equipo— sin que el router saque al usuario del
    // asistente al último paso; se entra con `refrescar()` cuando él decide.
    if (!r.requierePago && (opts?.entrar ?? true)) {
      const me = await api.get<Usuario>('/auth/me');
      setUsuario(me);
      setSuspendida(me.negocio.estadoSuscripcion === EstadoSuscripcion.Suspendida);
    }
    return { negocioId: r.negocioId, modo: r.modo, requierePago: r.requierePago };
  }, []);

  const logout = useCallback(async () => {
    if (tokens.refresh) {
      try {
        await api.post('/auth/logout', { refreshToken: tokens.refresh }, false);
      } catch {
        /* ignora */
      }
    }
    tokens.clear();
    setUsuario(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ usuario, cargando, cuentaSuspendida, motivoBloqueo, login, registrar, logout, refrescar: cargarMe }),
    [usuario, cargando, cuentaSuspendida, motivoBloqueo, login, registrar, logout, cargarMe],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}

/**
 * Foto del especialista en sesión, o `null` si no tiene (entonces el `Avatar`
 * cae a la inicial sobre color).
 *
 * La sesión ya trae `fotoVersion`, así que el avatar sale bien desde el primer
 * render y, al cambiarla, basta con `refrescar()` para que se actualice en la
 * cabecera, el menú lateral y el perfil a la vez.
 */
export function useMiFoto(): string | null {
  const { usuario } = useAuth();
  if (!usuario?.especialistaId) return null;
  return urlFotoEspecialista(usuario.especialistaId, usuario.fotoVersion);
}
