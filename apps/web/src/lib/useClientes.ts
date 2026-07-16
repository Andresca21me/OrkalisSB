import type { ClienteCRM, ClienteHistorial } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

/** Directorio de clientes (CRM) con búsqueda por nombre/teléfono. */
export function useClientes(buscar?: string) {
  const q = buscar?.trim() ? `?buscar=${encodeURIComponent(buscar.trim())}` : '';
  return useApi<ClienteCRM[]>(() => api.get(`/clientes${q}`), [buscar]);
}

export function crearCliente(body: { nombre: string; telefono?: string }): Promise<unknown> {
  return api.post('/clientes', body);
}

export function editarCliente(id: string, body: { nombre?: string; telefono?: string }): Promise<unknown> {
  return api.patch(`/clientes/${id}`, body);
}

/** Borrado lógico: saca al cliente del directorio conservando su historial. */
export function desactivarCliente(id: string): Promise<unknown> {
  return api.del(`/clientes/${id}`);
}

export function historialCliente(id: string): Promise<ClienteHistorial> {
  return api.get(`/clientes/${id}/historial`);
}
