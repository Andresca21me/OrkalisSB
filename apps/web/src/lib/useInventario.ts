import type {
  HistorialVentasResp,
  MovimientoInventarioItem,
  ProductoInventario,
  TipoProducto,
} from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

function qs(sucursalId?: string | null): string {
  return sucursalId ? `?sucursalId=${sucursalId}` : '';
}

export function useInventario(sucursalId?: string | null) {
  return useApi<ProductoInventario[]>(() => api.get(`/inventario/productos${qs(sucursalId)}`), [sucursalId]);
}

export function useAlertasStock(sucursalId?: string | null) {
  return useApi<ProductoInventario[]>(() => api.get(`/inventario/alertas${qs(sucursalId)}`), [sucursalId]);
}

export function useValoracion(sucursalId?: string | null) {
  return useApi<{ valoracion: number }>(() => api.get(`/inventario/valoracion${qs(sucursalId)}`), [sucursalId]);
}

/** Kardex de un producto (historial de movimientos). */
export function useMovimientos(productoId?: string | null) {
  return useApi<{ items: MovimientoInventarioItem[] }>(
    () => api.get(`/inventario/movimientos?productoId=${productoId}`),
    [productoId],
  );
}

/** Filtros del historial de ventas de producto (todos opcionales). */
export interface FiltrosVentas {
  sucursalId?: string | null;
  desde?: string;
  hasta?: string;
  especialistaId?: string;
  productoId?: string;
  clienteId?: string;
  origen?: 'cita' | 'directa';
}

export function useHistorialVentas(f: FiltrosVentas) {
  const q = new URLSearchParams();
  if (f.sucursalId) q.set('sucursalId', f.sucursalId);
  if (f.desde) q.set('desde', f.desde);
  if (f.hasta) q.set('hasta', f.hasta);
  if (f.especialistaId) q.set('especialistaId', f.especialistaId);
  if (f.productoId) q.set('productoId', f.productoId);
  if (f.clienteId) q.set('clienteId', f.clienteId);
  if (f.origen) q.set('origen', f.origen);
  const query = q.toString();
  return useApi<HistorialVentasResp>(
    () => api.get(`/inventario/ventas${query ? `?${query}` : ''}`),
    [query],
  );
}

/** Compras (movimientos de entrada con costo) en un rango, para "Compras e inversión". */
export function useCompras(sucursalId?: string | null, desde?: string, hasta?: string) {
  const q = new URLSearchParams({ tipo: 'entrada' });
  if (sucursalId) q.set('sucursalId', sucursalId);
  if (desde) q.set('desde', desde);
  if (hasta) q.set('hasta', hasta);
  const query = q.toString();
  return useApi<{ items: MovimientoInventarioItem[] }>(
    () => api.get(`/inventario/movimientos?${query}`),
    [query],
  );
}

export interface ProductoInput {
  sucursalId: string;
  nombre: string;
  tipo: TipoProducto;
  cantidad?: number;
  stockMin?: number;
  costo?: number;
  precioVenta?: number;
  generaGasto?: boolean;
}

export function crearProducto(body: ProductoInput): Promise<ProductoInventario> {
  return api.post('/inventario/productos', body);
}

export function editarProducto(id: string, body: { nombre?: string; tipo?: TipoProducto; stockMin?: number; costo?: number; precioVenta?: number }): Promise<ProductoInventario> {
  return api.patch(`/inventario/productos/${id}`, body);
}

export function eliminarProducto(id: string): Promise<unknown> {
  return api.del(`/inventario/productos/${id}`);
}

export function registrarMovimiento(body: { productoId: string; tipoMov: 'entrada' | 'salida' | 'ajuste'; cantidad: number; motivo?: string; generaGasto?: boolean; costoTotal?: number }): Promise<{ stock: number; gastoId?: string }> {
  return api.post('/inventario/movimientos', body);
}
