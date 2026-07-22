import { VARIABLES_PLANTILLA, type EventoPlantilla } from '@orkalis/shared';
import { formatFechaHora, formatHora, plantillas, type DatosCita } from './templates';

/**
 * Render de plantillas (Plan-Mensajeria FASE-04, D5) — **módulo puro**: no toca
 * la base de datos, para poder probar los bordes sin levantar Postgres (mismo
 * criterio que `ciclo.ts`).
 */

/** Eventos configurables, en el orden en que se muestran en el panel. */
export const EVENTOS: EventoPlantilla[] = [
  'confirmacion',
  'recordatorio',
  'aviso',
  'aviso_especialista',
  'marketing',
];

/** Patrón de variable: `{{cliente}}`, tolerando espacios (`{{ cliente }}`). */
const VARIABLE = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

export const PERMITIDAS = new Set<string>(VARIABLES_PLANTILLA);

/** Valores con los que se sustituyen las variables de una plantilla. */
export function valoresDe(d: DatosCita): Record<string, string> {
  return {
    cliente: d.clienteNombre ?? '',
    fecha: formatFechaHora(d.inicio),
    hora: formatHora(d.inicio),
    sucursal: d.sucursalNombre,
    especialista: d.especialistaNombre,
    servicio: d.servicioNombre ?? '',
  };
}

/**
 * Sustituye `{{variable}}` por su valor. Una variable sin valor se sustituye por
 * cadena vacía: nunca se envía el literal `{{…}}` a un cliente real.
 */
export function renderizar(texto: string, valores: Record<string, string>): string {
  return texto.replace(VARIABLE, (_, nombre: string) => valores[nombre] ?? '').trim();
}

/** Variables usadas en un texto (sin repetir). */
export function variablesDe(texto: string): string[] {
  return [...new Set([...texto.matchAll(VARIABLE)].map((m) => m[1]))];
}

/** Texto de plataforma de un evento (fallback y previsualización del panel). */
export function textoPorDefecto(evento: EventoPlantilla, datos: DatosCita): string {
  switch (evento) {
    case 'recordatorio':
      return plantillas.recordatorio(datos);
    case 'aviso':
      return plantillas.aviso(datos);
    case 'aviso_especialista':
      return plantillas.avisoEspecialista(datos);
    case 'marketing':
      return plantillas.marketing(datos);
    case 'confirmacion':
    default:
      return plantillas.confirmacion(datos);
  }
}
