import type { EspecialistaEquipo, LiquidacionResultado } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

/** Equipo (especialistas con sus sucursales). */
export function useEquipo() {
  return useApi<EspecialistaEquipo[]>(() => api.get('/especialistas'));
}

export function crearEspecialista(body: {
  nombre: string;
  especialidad?: string;
  sucursalIds?: string[];
  // Acceso al panel (opcional): crea/enlaza el login del especialista.
  email?: string;
  password?: string;
}): Promise<EspecialistaEquipo> {
  return api.post('/especialistas', body);
}

export function editarEspecialista(id: string, body: { nombre?: string; especialidad?: string; disponible?: boolean }): Promise<unknown> {
  return api.patch(`/especialistas/${id}`, body);
}

export function asignarSucursales(id: string, sucursalIds: string[]): Promise<unknown> {
  return api.put(`/especialistas/${id}/sucursales`, { sucursalIds });
}

export function darDeBajaEspecialista(id: string): Promise<unknown> {
  return api.del(`/especialistas/${id}`);
}

/** Vista previa de liquidación (no persiste). Requiere partición ON. */
export function previewLiquidacion(body: { desde: string; hasta: string; sucursalId: string }): Promise<LiquidacionResultado[]> {
  return api.post('/liquidaciones/preview', body);
}
