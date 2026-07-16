import type { EstadoCupo } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

/** Consumo/cupo de mensajería por canal en el período actual (H5). */
export function useCupos() {
  return useApi<EstadoCupo[]>(() => api.get('/notificaciones/cupos'));
}
