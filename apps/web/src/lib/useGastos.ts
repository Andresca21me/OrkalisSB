import type { Gasto } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

export function useGastos(sucursalId?: string | null) {
  return useApi<Gasto[]>(() => api.get(`/gastos${sucursalId ? `?sucursalId=${sucursalId}` : ''}`), [sucursalId]);
}

export function crearGasto(body: { sucursalId: string; tipo: 'fijo' | 'variable'; categoria?: string; monto: number }): Promise<Gasto> {
  return api.post('/gastos', body);
}

export function eliminarGasto(id: string): Promise<unknown> {
  return api.del(`/gastos/${id}`);
}

/** Venta directa de producto (sin servicio) → descuenta stock + comisión. */
export function registrarVenta(body: { productoId: string; cantidad: number; especialistaId?: string; comisionProf?: number }): Promise<{ ventaId: string; total: number }> {
  return api.post('/inventario/ventas', body);
}
