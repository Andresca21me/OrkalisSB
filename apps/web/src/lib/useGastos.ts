import type { Gasto, GastosDetalle } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

export function useGastos(sucursalId?: string | null) {
  return useApi<Gasto[]>(() => api.get(`/gastos${sucursalId ? `?sucursalId=${sucursalId}` : ''}`), [sucursalId]);
}

/** Desglose del período (Plan-Gastos): cada ocurrencia con su fecha + totales. */
export function useGastosDetalle(desde: string, hasta: string, sucursalId?: string | null) {
  return useApi<GastosDetalle>(
    () => api.get(`/gastos/detalle?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}${sucursalId ? `&sucursalId=${sucursalId}` : ''}`),
    [desde, hasta, sucursalId],
  );
}

export function crearGasto(body: {
  sucursalId: string;
  tipo: 'fijo' | 'variable';
  categoria?: string;
  monto: number;
  /** Variables: día (Bogotá) en que se hizo el gasto. */
  fecha?: string;
  /** Fijos: día del mes en que se cobra, cada mes. */
  diaCobro?: number;
}): Promise<Gasto> {
  return api.post('/gastos', body);
}

export function eliminarGasto(id: string): Promise<unknown> {
  return api.del(`/gastos/${id}`);
}

/** Venta directa de producto (sin servicio) → descuenta stock. La comisión la calcula el servidor. */
export function registrarVenta(body: { productoId: string; cantidad: number; especialistaId?: string }): Promise<{ ventaId: string; total: number; comision: number }> {
  return api.post('/inventario/ventas', body);
}
