/**
 * Plantillas de mensaje en español, formato es-CO (RF-047/048).
 *
 * Desde FASE-04 estas son los **defaults de plataforma**: se usan cuando el
 * negocio no ha personalizado el evento (`PlantillasService`). No se borran ni
 * se tocan al editar una plantilla — son la red que garantiza que siempre haya
 * un texto válido que enviar.
 *
 * **Por qué el texto evita `á í ó ú` y va corto.** Un SMS con cualquier
 * carácter fuera del GSM-7 se codifica entero en UCS-2 y pasa de 160 a 70
 * caracteres por segmento: el mismo aviso cuesta el doble o el triple. Además,
 * los cuerpos largos con fecha "de lujo" se parecen a promociones y los filtra
 * el operador con más frecuencia (SMS que "a veces no llegan"). GSM-7 sí
 * incluye `é`, `ñ`, `ü`, `¡` y `¿`, así que se usan con libertad; las
 * plantillas personalizadas por el negocio pueden usar lo que quieran.
 */

export interface DatosCita {
  sucursalNombre: string;
  especialistaNombre: string;
  servicioNombre?: string;
  clienteNombre?: string;
  /** Qué pasó con la cita (avisos al especialista, FASE-07). */
  motivo?: string;
  inicio: Date;
}

/** Día/mes abreviados sin salirse del GSM-7 (nada de «sáb» ni «miércoles»). */
const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Fecha/hora compacta en zona Bogotá (UTC-5 fijo, sin DST): «sab 26 jul, 3:30 p.m.».
 * Sustituye al viejo `dateStyle: 'full'`, cuyos nombres de día («sábado»)
 * sacaban el SMS del GSM-7 y disparaban su costo en segmentos.
 */
export function formatFechaHora(d: Date): string {
  const b = new Date(d.getTime() - 5 * 3600_000);
  return `${DIAS[b.getUTCDay()]} ${b.getUTCDate()} ${MESES[b.getUTCMonth()]}, ${formatHora(d)}`;
}

/** Solo la hora, para la variable `{{hora}}` de las plantillas. */
export function formatHora(d: Date): string {
  const b = new Date(d.getTime() - 5 * 3600_000);
  const h24 = b.getUTCHours();
  const h12 = h24 % 12 || 12;
  const min = String(b.getUTCMinutes()).padStart(2, '0');
  return `${h12}:${min} ${h24 < 12 ? 'a.m.' : 'p.m.'}`;
}

export const plantillas = {
  /** Prueba de canal al registrar el celular de un especialista (sin códigos). */
  bienvenidaEspecialista: (negocioNombre: string): string =>
    `${negocioNombre}: tu número quedó registrado para recibir avisos de tu agenda. Si no esperabas este mensaje, ignóralo.`,

  confirmacion: (d: DatosCita): string =>
    `¡Reserva confirmada! ${d.servicioNombre ? d.servicioNombre + ' ' : ''}con ${d.especialistaNombre} en ${d.sucursalNombre} el ${formatFechaHora(d.inicio)}.`,

  recordatorio: (d: DatosCita): string =>
    `Recordatorio: tu cita es el ${formatFechaHora(d.inicio)} en ${d.sucursalNombre} con ${d.especialistaNombre}.`,

  aviso: (d: DatosCita): string =>
    `Tu cita del ${formatFechaHora(d.inicio)} en ${d.sucursalNombre} fue cancelada. Puedes reservar de nuevo cuando quieras.`,

  /** Aviso al ESPECIALISTA sobre un cambio en su agenda (FASE-07, D4). */
  avisoEspecialista: (d: DatosCita): string =>
    `${d.motivo ?? 'Novedad en tu agenda'}: ${d.clienteNombre ?? 'cliente'}${d.servicioNombre ? ' - ' + d.servicioNombre : ''} el ${formatFechaHora(d.inicio)} en ${d.sucursalNombre}.`,

  /** Base de campaña (FASE-05); el negocio normalmente la personaliza. */
  marketing: (d: DatosCita): string =>
    `${d.sucursalNombre}: tenemos cupos disponibles esta semana. Responde para agendar.`,
};
