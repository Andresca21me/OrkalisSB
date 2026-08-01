/** Localización es-CO / COP (FASE-13, RNF-004). */

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
const NUM = new Intl.NumberFormat('es-CO');

/** Formatea un monto COP (acepta number o string numérico). */
export function money(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  return COP.format(Number.isFinite(n) ? n : 0);
}

export function num(v: number | string): string {
  return NUM.format(typeof v === 'string' ? Number(v) : v);
}

/** Porcentaje 0..1 → "57%". */
export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const HORA_24 = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const FECHA_HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const FECHA_CORTA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function fechaLarga(d: Date | string): string {
  return FECHA_LARGA.format(new Date(d));
}
/** Fecha compacta: "16 jun 2026". */
export function fechaCorta(d: Date | string): string {
  return FECHA_CORTA.format(new Date(d));
}
/** Hora legible con meridiano: "1:05 p. m.". */
export function hora(d: Date | string): string {
  return HORA.format(new Date(d));
}

/**
 * Hora sin meridiano: "1:05". SOLO donde el contexto ya dice si es mañana,
 * tarde o noche (los grupos de franjas); en cualquier otro sitio usa `hora`,
 * porque una hora suelta sin meridiano se puede leer con 12 h de diferencia.
 */
export function horaSimple(d: Date | string): string {
  const partes = HORA.formatToParts(new Date(d));
  const hh = partes.find((p) => p.type === 'hour')?.value ?? '';
  const mm = partes.find((p) => p.type === 'minute')?.value ?? '';
  return `${hh}:${mm}`;
}

/** Solo el meridiano: "a. m." / "p. m." (para separarlo de la hora en filas estrechas). */
export function meridiano(d: Date | string): string {
  return HORA.formatToParts(new Date(d)).find((p) => p.type === 'dayPeriod')?.value ?? '';
}

/** Hora de reloj del negocio ('18:00' → "6:00 p. m."). */
export function horaDesdeHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  // Instante UTC que cae en esa hora de pared en Bogotá (UTC−5).
  return HORA.format(new Date(Date.UTC(2000, 0, 1, h + 5, m)));
}

/** Hora en 24 h ("13:05"): claves estables (testids), NUNCA para mostrar. */
export function hora24(d: Date | string): string {
  return HORA_24.format(new Date(d));
}
export function fechaHora(d: Date | string): string {
  return FECHA_HORA.format(new Date(d));
}

/** 'YYYY-MM-DD' de hoy en zona Bogotá. */
export function hoyISO(): string {
  return new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
}

/** Suma días a una fecha ISO 'YYYY-MM-DD'. */
export function sumarDiasISO(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' (Bogotá) → "lunes 16 de junio". */
export function fechaDesdeISO(iso: string): string {
  return FECHA_LARGA.format(new Date(`${iso}T17:00:00Z`));
}
