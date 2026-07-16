import type { ProductoInventario, TipoProducto } from '@orkalis/shared';
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

export interface ProductoInput {
  sucursalId: string;
  nombre: string;
  tipo: TipoProducto;
  cantidad?: number;
  stockMin?: number;
  costo?: number;
  precioVenta?: number;
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
