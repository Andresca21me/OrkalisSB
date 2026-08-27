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

/** Vista previa de liquidación (no persiste). Sin sucursal = consolidado. Requiere partición ON. */
export function previewLiquidacion(body: { desde: string; hasta: string; sucursalId?: string }): Promise<LiquidacionResultado[]> {
  return api.post('/liquidaciones/preview', body);
}

// ── Alta por invitación (Plan-Correo E5, D4) ─────────────────────────────────
// El admin captura los datos básicos + correo; la contraseña y el celular los
// pone el propio especialista desde el enlace que recibe (7 días).

export interface InvitarEspecialistaBody {
  nombre: string;
  apellidos?: string;
  especialidad?: string;
  email: string;
  sucursalIds: string[];
  servicioIds?: string[];
  disponible?: boolean;
}

/** Crea el especialista (ya cuenta para el cupo) y le envía la invitación. */
export function invitarEspecialista(body: InvitarEspecialistaBody): Promise<EspecialistaEquipo & { invitacionEmail: string }> {
  return api.post('/especialistas/invitar', body);
}

/**
 * "Yo también atiendo" (Plan-Correo E8): crea la ficha de especialista del
 * PROPIO usuario en sesión, enlazada a su cuenta. Sin correo ni invitación.
 */
export function crearMiFicha(body: {
  nombre?: string;
  apellidos?: string;
  especialidad?: string;
  sucursalIds: string[];
  servicioIds?: string[];
  disponible?: boolean;
}): Promise<EspecialistaEquipo> {
  return api.post('/especialistas/mi-ficha', body);
}

export interface InvitacionPendiente {
  especialistaId: string;
  email: string;
  expiraEn: string;
}

/** Invitaciones vigentes del negocio (para los badges del equipo). */
export function invitacionesPendientes(): Promise<InvitacionPendiente[]> {
  return api.get('/especialistas/invitaciones');
}

/** Invita (o re-invita con otro correo) a un especialista existente sin acceso. */
export function invitarExistente(id: string, email: string): Promise<unknown> {
  return api.post(`/especialistas/${id}/invitar`, { email });
}

/**
 * "Este soy yo" (E8): enlaza un especialista YA creado a la cuenta en sesión
 * (cancela su invitación pendiente si la tenía).
 */
export function vincularMiCuenta(id: string): Promise<unknown> {
  return api.post(`/especialistas/${id}/vincular-mi-cuenta`);
}

/** Reenvía la invitación vigente (cooldown 60 s, máximo 5 reenvíos). */
export function reenviarInvitacion(id: string): Promise<unknown> {
  return api.post(`/especialistas/${id}/invitacion/reenviar`);
}

// ── El propio especialista verifica su celular ───────────────────────────────

/** Guarda el celular del especialista en sesión y dispara el código SMS. */
export function miTelefonoIniciar(celular: string): Promise<{ ok: true }> {
  return api.post('/especialistas/mi/telefono/iniciar', { celular });
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
