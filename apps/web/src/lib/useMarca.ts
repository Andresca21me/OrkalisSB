import { api } from './api';
import { useApi } from './useApi';

export interface MarcaNegocio {
  nombre: string;
  descripcion: string | null;
  colorPrimario: string | null;
  logoVersion: string | null;
}

/** Marca del negocio en sesión (configuración del admin). */
export function useMarca() {
  return useApi<MarcaNegocio>(() => api.get('/negocios/marca'));
}

export function guardarMarca(body: { descripcion?: string | null; colorPrimario?: string | null }): Promise<unknown> {
  return api.patch('/negocios/marca', body);
}

export function subirLogo(dataUrl: string): Promise<{ logoVersion: string }> {
  return api.put('/negocios/logo', { dataUrl });
}

export function borrarLogo(): Promise<unknown> {
  return api.del('/negocios/logo');
}
