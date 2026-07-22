import type { PaginaMensajes, ResumenMensajes } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

export interface FiltrosMensajes {
  canal?: string;
  estado?: string;
  tipo?: string;
  pagina?: number;
}

/** Registro de mensajes enviados con su estado de entrega (FASE-10). */
export function useMensajes(f: FiltrosMensajes) {
  const qs = new URLSearchParams();
  if (f.canal) qs.set('canal', f.canal);
  if (f.estado) qs.set('estado', f.estado);
  if (f.tipo) qs.set('tipo', f.tipo);
  if (f.pagina) qs.set('pagina', String(f.pagina));
  return useApi<PaginaMensajes>(() => api.get(`/notificaciones/mensajes?${qs}`), [f.canal, f.estado, f.tipo, f.pagina]);
}

/** Conteo por estado de los últimos 30 días (cabecera del registro). */
export function useResumenMensajes() {
  return useApi<ResumenMensajes>(() => api.get('/notificaciones/mensajes/resumen'));
}
