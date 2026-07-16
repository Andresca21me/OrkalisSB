import type { ReporteAnalisis, ReporteFinanciero } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';
import { hoyISO, sumarDiasISO } from './format';

export type Periodo = 'semana' | 'mes' | 'ano';

export const PERIODO_LABEL: Record<Periodo, string> = {
  semana: 'esta semana',
  mes: 'este mes',
  ano: 'este año',
};

/** Rango [desde, hasta] del período, alineado a calendario en zona Bogotá. */
export function rangoPeriodo(p: Periodo): { desde: string; hasta: string } {
  const hoy = hoyISO();
  const [y, m] = hoy.split('-').map(Number);
  let desdeIso: string;
  if (p === 'semana') desdeIso = sumarDiasISO(hoy, -6);
  else if (p === 'mes') desdeIso = `${y}-${String(m).padStart(2, '0')}-01`;
  else desdeIso = `${y}-01-01`;
  return { desde: `${desdeIso}T05:00:00.000Z`, hasta: new Date().toISOString() };
}

function suc(sucursalId?: string | null): string {
  return sucursalId ? `&sucursalId=${sucursalId}` : '';
}

export function useFinanciero(desde: string, hasta: string, sucursalId?: string | null) {
  return useApi<ReporteFinanciero>(() => api.get(`/reportes/financiero?desde=${desde}&hasta=${hasta}${suc(sucursalId)}`), [desde, hasta, sucursalId]);
}

export function useAnalisis(desde: string, hasta: string, sucursalId?: string | null) {
  return useApi<ReporteAnalisis>(() => api.get(`/reportes/analisis?desde=${desde}&hasta=${hasta}${suc(sucursalId)}`), [desde, hasta, sucursalId]);
}
