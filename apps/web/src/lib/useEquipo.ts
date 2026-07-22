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

// ── Alta con verificación de celular (FASE-06, D3) ───────────────────────────
// El especialista NO se crea al iniciar: solo cuando el código es correcto.

export interface IniciarVerificacionBody {
  nombre: string;
  apellidos?: string;
  celular: string;
  especialidad?: string;
  sucursalIds?: string[];
  email?: string;
  password?: string;
}

/** Paso 1: guarda el borrador y envía el código por SMS. */
export function iniciarVerificacion(body: IniciarVerificacionBody): Promise<{ verificacionId: string; expiraEn: string }> {
  return api.post('/especialistas/verificacion/iniciar', body);
}

/** Paso 2: valida el código y crea el especialista. */
export function confirmarVerificacion(verificacionId: string, codigo: string): Promise<EspecialistaEquipo> {
  return api.post('/especialistas/verificacion/confirmar', { verificacionId, codigo });
}

/** Reenvía el código (cooldown 30 s, máximo 3 reenvíos). */
export function reenviarCodigo(verificacionId: string): Promise<{ reenvios: number }> {
  return api.post('/especialistas/verificacion/reenviar', { verificacionId });
}
