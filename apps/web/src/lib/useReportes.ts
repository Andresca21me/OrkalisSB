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

/**
 * Franja de fechas seleccionada por el usuario (calendario). Ambos extremos son
 * días de calendario inclusivos en zona Bogotá ('YYYY-MM-DD'), no timestamps.
 */
export interface RangoDias {
  desde: string; // 'YYYY-MM-DD'
  hasta: string; // 'YYYY-MM-DD' (inclusivo)
}

/** Rango de un preset ('semana' = últimos 7 días · 'mes' = desde el 1 · 'ano' = desde ene). */
export function presetRango(p: Periodo): RangoDias {
  const hoy = hoyISO();
  const [y, m] = hoy.split('-').map(Number);
  if (p === 'semana') return { desde: sumarDiasISO(hoy, -6), hasta: hoy };
  if (p === 'mes') return { desde: `${y}-${String(m).padStart(2, '0')}-01`, hasta: hoy };
  return { desde: `${y}-01-01`, hasta: hoy };
}

/**
 * Convierte la franja de días a los timestamps que espera la API: desde la
 * medianoche de Bogotá del primer día hasta el final del último día (inclusivo).
 * Bogotá = UTC-5, así que medianoche local = 05:00Z.
 */
export function diasATimestamps({ desde, hasta }: RangoDias): { desde: string; hasta: string } {
  return { desde: `${desde}T05:00:00.000Z`, hasta: `${sumarDiasISO(hasta, 1)}T04:59:59.999Z` };
}

const FMT_DM = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' });
const FMT_DMA = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' });
/** 'YYYY-MM-DD' → Date fijado al mediodía de Bogotá (evita corrimiento de día por TZ). */
function diaMediodia(iso: string): Date {
  return new Date(`${iso}T17:00:00Z`);
}
/** Etiqueta legible de la franja: "21 jul 2026" · "16 jun – 21 jul 2026". */
export function etiquetaRango({ desde, hasta }: RangoDias): string {
  if (desde === hasta) return FMT_DMA.format(diaMediodia(hasta));
  const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4);
  return `${(mismoAnio ? FMT_DM : FMT_DMA).format(diaMediodia(desde))} – ${FMT_DMA.format(diaMediodia(hasta))}`;
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
