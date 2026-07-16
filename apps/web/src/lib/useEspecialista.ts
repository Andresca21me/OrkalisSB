import type { GananciasEspecialista, MetodoPago } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

/** Ganancias del especialista en un rango (H3). */
export function useGanancias(especialistaId: string | null, desde: string, hasta: string) {
  return useApi<GananciasEspecialista>(
    () => api.get(`/especialistas/${especialistaId}/ganancias?desde=${desde}&hasta=${hasta}`),
    [especialistaId, desde, hasta],
  );
}

/** El especialista alterna su propia disponibilidad. */
export function setDisponibilidad(especialistaId: string, disponible: boolean): Promise<unknown> {
  return api.patch(`/especialistas/${especialistaId}/disponibilidad`, { disponible });
}

export function walkInVivo(body: { sucursalId: string; especialistaId: string; clienteId?: string; servicioIds: string[] }): Promise<unknown> {
  return api.post('/citas/walk-in', body);
}

export function walkInRetroactivo(body: { sucursalId: string; especialistaId: string; clienteId?: string; servicioIds: string[]; inicio: string; fin: string; metodoPago: MetodoPago }): Promise<unknown> {
  return api.post('/citas/walk-in/retroactivo', body);
}
