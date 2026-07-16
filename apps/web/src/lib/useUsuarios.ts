import type { RolUsuario, UsuarioInterno } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

export function useUsuarios() {
  return useApi<UsuarioInterno[]>(() => api.get('/usuarios'));
}

export function crearUsuario(body: { nombre: string; email: string; password: string; rol: RolUsuario; sucursalIds?: string[] }): Promise<UsuarioInterno> {
  return api.post('/usuarios', body);
}

export function editarUsuario(id: string, body: { nombre?: string; rol?: RolUsuario; activo?: boolean; sucursalIds?: string[] }): Promise<UsuarioInterno> {
  return api.patch(`/usuarios/${id}`, body);
}

export function desactivarUsuario(id: string): Promise<unknown> {
  return api.del(`/usuarios/${id}`);
}
