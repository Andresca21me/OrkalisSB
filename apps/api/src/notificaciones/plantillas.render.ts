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
    motivo: d.motivo ?? '',
  };
}

/**
 * Variables que declara la plantilla de WhatsApp de cada evento (las
 * `orkalis_*` aprobadas por Meta vía Content API). Twilio rechaza el envío
 * ("Content Variables parameter is invalid") si `ContentVariables` trae claves
 * que la plantilla no declara O valores vacíos — por eso NO se puede mandar
 * `valoresDe` tal cual: hay que recortar al conjunto exacto y sin huecos.
 */
const VARIABLES_WA: Record<EventoPlantilla, string[]> = {
  confirmacion: ['cliente', 'servicio', 'especialista', 'sucursal', 'fecha'],
  recordatorio: ['cliente', 'fecha', 'sucursal', 'especialista'],
  aviso: ['cliente', 'fecha', 'sucursal'],
  aviso_especialista: ['motivo', 'cliente', 'servicio', 'fecha', 'sucursal'],
  marketing: ['cliente', 'sucursal'],
};

/** Relleno neutro cuando el dato falta: Meta no admite variables vacías. */
const RELLENO_WA: Record<string, string> = {
  cliente: 'cliente',
  servicio: 'tu servicio',
  motivo: 'Novedad en tu agenda',
};

/**
 * `ContentVariables` para la plantilla WhatsApp de un evento: exactamente las
 * claves que la plantilla declara, siempre con valor no vacío.
 */
export function variablesWa(evento: EventoPlantilla, datos: DatosCita): Record<string, string> {
  const valores = valoresDe(datos);
  const out: Record<string, string> = {};
  for (const k of VARIABLES_WA[evento] ?? []) {
    out[k] = valores[k]?.trim() || RELLENO_WA[k] || '-';
  }
  return out;
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
