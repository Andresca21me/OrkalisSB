/**
 * Cliente HTTP central (FASE-13). Adjunta el access token y refresca
 * automáticamente al recibir 401 (rotación de FASE-05). Los endpoints públicos
 * de reserva no requieren token.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

const ACCESS_KEY = 'orkalis_access';
const REFRESH_KEY = 'orkalis_refresh';

export const tokens = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Cuerpo JSON de la respuesta de error (p. ej. `{ motivo, codigo }`). */
    public body?: unknown,
  ) {
    super(message);
  }
}

interface Opts {
  method?: string;
  body?: unknown;
  auth?: boolean; // adjuntar access token (default true)
  raw?: boolean; // devolver texto crudo (CSV)
}

let refreshing: Promise<boolean> | null = null;

async function intentarRefresh(): Promise<boolean> {
  if (!tokens.refresh) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refresh }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        tokens.set(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function ejecutar<T>(path: string, opts: Opts, reintento = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const usarAuth = opts.auth !== false;
  if (usarAuth && tokens.access) headers['Authorization'] = `Bearer ${tokens.access}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && usarAuth && !reintento && (await intentarRefresh())) {
    return ejecutar<T>(path, opts, true);
  }

  if (res.status === 204) return undefined as T;
  if (opts.raw) {
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return (await res.text()) as T;
  }
  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : null;
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Error ${res.status}`;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : msg, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, auth = true) => ejecutar<T>(path, { method: 'GET', auth }),
  post: <T>(path: string, body?: unknown, auth = true) =>
    ejecutar<T>(path, { method: 'POST', body, auth }),
  patch: <T>(path: string, body?: unknown, auth = true) =>
    ejecutar<T>(path, { method: 'PATCH', body, auth }),
  put: <T>(path: string, body?: unknown, auth = true) =>
    ejecutar<T>(path, { method: 'PUT', body, auth }),
  del: <T>(path: string, auth = true) => ejecutar<T>(path, { method: 'DELETE', auth }),
};


/**
 * URL pública de la foto de un especialista. `fotoVersion` (la fecha de la
 * última subida) va en la query, de modo que la respuesta se puede cachear un
 * año y aun así cambiar en cuanto el admin sube otra foto.
 * Devuelve `null` si no tiene foto, para que el avatar caiga a la inicial.
 */
export function urlFotoEspecialista(id: string, fotoVersion: string | null | undefined): string | null {
  if (!fotoVersion) return null;
  return `${BASE}/especialistas/${id}/foto?v=${encodeURIComponent(fotoVersion)}`;
}
