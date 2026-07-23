import type {
  BajaEspecialistaResp,
  CitasFuturasResp,
  EspecialistaEquipo,
  LiquidacionResultado,
} from '@orkalis/shared';
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

/**
 * Da de baja al especialista. Sin `accion`, si tiene citas futuras el servidor
 * responde 409 con el conteo para que el admin decida qué hacer con ellas.
 */
export function darDeBajaEspecialista(id: string, accion?: 'reasignar' | 'cancelar'): Promise<BajaEspecialistaResp> {
  return api.del(`/especialistas/${id}${accion ? `?accion=${accion}` : ''}`);
}

/** Citas futuras pendientes del especialista (para el aviso previo a la baja). */
export function citasFuturasEspecialista(id: string): Promise<CitasFuturasResp> {
  return api.get(`/especialistas/${id}/citas-futuras`);
}

/** Servicios que el especialista realiza. Lista vacía = todos (sin restricción). */
export function asignarServicios(id: string, servicioIds: string[]): Promise<unknown> {
  return api.put(`/especialistas/${id}/servicios`, { servicioIds });
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
  servicioIds?: string[];
}

/** Paso 1: guarda el borrador y envía el código por SMS. */
export function iniciarVerificacion(
  body: IniciarVerificacionBody,
): Promise<{ verificacionId: string; expiraEn: string; codigoVisible?: string }> {
  return api.post('/especialistas/verificacion/iniciar', body);
}

/** Paso 2: valida el código y crea el especialista. */
export function confirmarVerificacion(verificacionId: string, codigo: string): Promise<EspecialistaEquipo> {
  return api.post('/especialistas/verificacion/confirmar', { verificacionId, codigo });
}

/** Reenvía el código (cooldown 30 s, máximo 3 reenvíos). */
export function reenviarCodigo(verificacionId: string): Promise<{ reenvios: number; codigoVisible?: string }> {
  return api.post('/especialistas/verificacion/reenviar', { verificacionId });
}

/** Sube o reemplaza la foto del especialista (data URL ya reducido). */
export function subirFotoEspecialista(id: string, dataUrl: string): Promise<{ fotoVersion: string }> {
  return api.put(`/especialistas/${id}/foto`, { dataUrl });
}

/** Quita la foto: el avatar vuelve a la inicial sobre color. */
export function borrarFotoEspecialista(id: string): Promise<unknown> {
  return api.del(`/especialistas/${id}/foto`);
}

// El especialista sobre su propia foto: sin id en la ruta, el servidor la
// deduce de la sesión para que nadie pueda apuntar a un compañero.

/** El especialista cambia su propia foto desde su panel. */
export function subirMiFoto(dataUrl: string): Promise<{ fotoVersion: string }> {
  return api.put('/especialistas/mi/foto', { dataUrl });
}

/** El especialista quita su propia foto. */
export function borrarMiFoto(): Promise<unknown> {
  return api.del('/especialistas/mi/foto');
}
