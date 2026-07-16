/**
 * Generadores de datos únicos y de fechas para las pruebas (FASE-00 v3).
 * Datos únicos = aislamiento: dos corridas no colisionan ni dependen de orden
 * (ver _ESTRATEGIA-Y-CONVENCIONES §6).
 */

/** Teléfono celular colombiano único (10 dígitos, prefijo 3). */
export function telefonoUnico(): string {
  return `3${Date.now().toString().slice(-9)}`;
}

/** Nombre de cliente/recurso único y reconocible en las vistas observadoras. */
export function nombreUnico(prefijo = 'E2E'): string {
  return `${prefijo} ${Math.random().toString(36).slice(2, 8)}`;
}

/** Email interno único (para alta de usuarios). */
export function emailUnico(prefijo = 'e2e'): string {
  return `${prefijo}.${Date.now().toString(36)}@orkalis.test`;
}

/** 'YYYY-MM-DD' de hoy en zona Bogotá (UTC-5). Espeja lib/format.hoyISO. */
export function hoyISO(): string {
  return new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' de hoy + n días (Bogotá). */
export function fechaMasDias(n: number): string {
  return new Date(Date.now() - 5 * 3600_000 + n * 86_400_000).toISOString().slice(0, 10);
}

/** 'HH:mm' (24h) de un ISO en zona Bogotá. Útil para llenar el input time de la UI. */
export function horaBogota(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}
