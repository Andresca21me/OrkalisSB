import type { AlertaAdmin, EstadoCupo } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

/** Consumo/cupo de mensajería por canal en el ciclo de cobro vigente (H5, D1). */
export function useCupos() {
  return useApi<EstadoCupo[]>(() => api.get('/notificaciones/cupos'));
}

/** Avisos persistentes al admin (sobreconsumo de cupos, FASE-03). */
export function useAlertas() {
  return useApi<AlertaAdmin[]>(() => api.get('/notificaciones/alertas?sinLeer=true'));
}

/** Marca un aviso como leído (desaparece de la bandeja). */
export function marcarAlertaLeida(id: string): Promise<unknown> {
  return api.post(`/notificaciones/alertas/${id}/leer`);
}
