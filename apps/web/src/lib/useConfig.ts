import { api } from './api';
import { useApi } from './useApi';

export type Procedencia = 'sistema' | 'negocio' | 'sucursal';
export type ValorConfig = boolean | number | string;

export interface ConfigEfectivo {
  clave: string;
  valor: ValorConfig;
  procedencia: Procedencia;
  tipo: 'boolean' | 'porcentaje' | 'numero' | 'enum' | 'dinero' | 'duracion';
}

/** Configuración efectiva (resuelta sistema→negocio→sucursal). */
export function useConfig(sucursalId?: string | null) {
  return useApi<ConfigEfectivo[]>(() => api.get(`/config${sucursalId ? `?sucursalId=${sucursalId}` : ''}`), [sucursalId]);
}

/** ¿Está activo un módulo/flag booleano en la config efectiva? */
export function moduloActivo(config: ConfigEfectivo[] | null | undefined, clave: string): boolean {
  return config?.find((c) => c.clave === clave)?.valor === true;
}

export function efectivoDe(config: ConfigEfectivo[] | null | undefined, clave: string): ConfigEfectivo | undefined {
  return config?.find((c) => c.clave === clave);
}

// ── Mutaciones (FASE-09) ─────────────────────────────────────────────────────

/** Crea/actualiza un override de una clave en un nivel/ámbito. */
export function setConfig(nivel: Procedencia, ambitoId: string, clave: string, valor: ValorConfig): Promise<unknown> {
  return api.put(`/config/${nivel}/${ambitoId}/${clave}`, { valor });
}

/** Borra el override → vuelve a heredar del nivel superior. */
export function resetConfig(nivel: Procedencia, ambitoId: string, clave: string): Promise<unknown> {
  return api.del(`/config/${nivel}/${ambitoId}/${clave}`);
}

/** Fija la repartición profesional/salón (deben sumar 100). */
export function setReparticion(nivel: Procedencia, ambitoId: string, profesional: number, salon: number): Promise<unknown> {
  return api.put(`/config/reparticion/${nivel}/${ambitoId}`, { profesional, salon });
}

/** Clona los overrides de una sucursal a otra (copia puntual). */
export function clonarConfig(origenSucursalId: string, destinoSucursalId: string): Promise<unknown> {
  return api.post('/config/clonar', { origenSucursalId, destinoSucursalId });
}
