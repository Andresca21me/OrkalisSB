import type { SplitType } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

/** Servicio del catálogo (precio/splitValor como string numérico). */
export interface Servicio {
  id: string;
  nombre: string;
  precio: string;
  duracionMin: number;
  categoria: string | null;
  splitType: SplitType;
  splitValor: string;
  favorito: boolean;
  activo: boolean;
}

export interface ServicioInput {
  nombre: string;
  precio: number;
  duracionMin: number;
  categoria?: string;
  splitType: SplitType;
  splitValor: number;
  favorito?: boolean;
}

export function useServicios() {
  return useApi<Servicio[]>(() => api.get('/servicios'));
}

export function crearServicio(body: ServicioInput): Promise<Servicio> {
  return api.post('/servicios', body);
}

export function editarServicio(id: string, body: Partial<ServicioInput>): Promise<Servicio> {
  return api.patch(`/servicios/${id}`, body);
}

export function eliminarServicio(id: string): Promise<unknown> {
  return api.del(`/servicios/${id}`);
}
