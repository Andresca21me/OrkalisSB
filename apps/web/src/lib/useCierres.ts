import type { Cierre } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

export function useCierres() {
  return useApi<Cierre[]>(() => api.get('/cierres'));
}

export function crearCierre(body: { tipo: 'quincenal' | 'mensual'; desde: string; hasta: string; sucursalId?: string }): Promise<Cierre> {
  return api.post('/cierres', body);
}
