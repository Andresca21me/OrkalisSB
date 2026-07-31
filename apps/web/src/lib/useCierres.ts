import type { Cierre } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

export function useCierres() {
  return useApi<Cierre[]>(() => api.get('/cierres'));
}

/**
 * Cierra el período (Plan-Finanzas F6): se manda el ANCLA (día Bogotá) y el
 * backend deriva el rango — el navegador ya no decide fechas de cierre.
 */
export function crearCierre(body: { tipo: 'quincenal' | 'mensual'; ancla: string; sucursalId?: string }): Promise<Cierre> {
  return api.post('/cierres', body);
}
