import type { CitaAgenda, MetodoPago } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

/** Rango UTC [00:00, 24:00) de un día 'YYYY-MM-DD' en zona Bogotá (UTC-5). */
export function rangoDiaBogota(iso: string): { desde: string; hasta: string } {
  const desde = `${iso}T05:00:00.000Z`;
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const hasta = `${d.toISOString().slice(0, 10)}T05:00:00.000Z`;
  return { desde, hasta };
}

interface FiltrosCitas {
  desde: string;
  hasta: string;
  sucursalId?: string | null;
  especialistaId?: string;
}

/** Hook de agenda: lista citas enriquecidas por rango/sucursal. */
export function useCitas(filtros: FiltrosCitas) {
  const qs = new URLSearchParams({ desde: filtros.desde, hasta: filtros.hasta });
  if (filtros.sucursalId) qs.set('sucursalId', filtros.sucursalId);
  if (filtros.especialistaId) qs.set('especialistaId', filtros.especialistaId);
  return useApi<CitaAgenda[]>(
    () => api.get(`/citas?${qs.toString()}`),
    [filtros.desde, filtros.hasta, filtros.sucursalId, filtros.especialistaId],
  );
}

export type EventoCita = 'aprobar' | 'iniciar' | 'cancelar' | 'no-asistio' | 'revertir';

/** Transición de estado de una cita (máquina de estados del backend). */
export function accionCita(id: string, evento: EventoCita): Promise<unknown> {
  return api.post(`/citas/${id}/${evento}`);
}

/** Una línea del pago (permite dividir el cobro en varios métodos). */
export interface PagoLinea {
  metodo: MetodoPago;
  monto: number;
}

/** Completa la cita con cobro dividido en 1+ métodos (guard de pago, ADR-006). */
export function completarCita(
  id: string,
  body: { pagos: PagoLinea[]; servicios?: { servicioId: string; precio?: number }[]; productos?: { productoId: string; cantidad: number }[] },
): Promise<unknown> {
  return api.post(`/citas/${id}/completar`, body);
}

/** Crea una cita agendada (futura). */
export function crearCita(body: { sucursalId: string; especialistaId: string; clienteId?: string; servicioIds: string[]; inicio: string }): Promise<CitaAgenda> {
  return api.post('/citas', body);
}

/** Reasigna la cita a otro especialista (FASE-11, H4). */
export function reasignarCita(id: string, especialistaId: string): Promise<unknown> {
  return api.post(`/citas/${id}/reasignar`, { especialistaId });
}

/** Walk-in en vivo desde recepción/especialista. */
export function walkInVivo(body: { sucursalId: string; especialistaId: string; clienteId?: string; servicioIds: string[] }): Promise<unknown> {
  return api.post('/citas/walk-in', body);
}
