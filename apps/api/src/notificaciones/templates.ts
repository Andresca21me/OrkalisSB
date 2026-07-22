/**
 * Plantillas de mensaje en español, formato es-CO (RF-047/048).
 *
 * Desde FASE-04 estas son los **defaults de plataforma**: se usan cuando el
 * negocio no ha personalizado el evento (`PlantillasService`). No se borran ni
 * se tocan al editar una plantilla — son la red que garantiza que siempre haya
 * un texto válido que enviar.
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

/** Formatea fecha/hora en es-CO (zona America/Bogota). */
export function formatFechaHora(d: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(d);
}

/** Solo la hora, para la variable `{{hora}}` de las plantillas. */
export function formatHora(d: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    timeStyle: 'short',
  }).format(d);
}

export const plantillas = {
  otp: (codigo: string): string =>
    `Tu código de verificación Orkalis es ${codigo}. Vence en 5 minutos. No lo compartas.`,

  confirmacion: (d: DatosCita): string =>
    `¡Reserva confirmada! ${d.servicioNombre ? d.servicioNombre + ' ' : ''}con ${d.especialistaNombre} en ${d.sucursalNombre} el ${formatFechaHora(d.inicio)}.`,

  recordatorio: (d: DatosCita): string =>
    `Recordatorio: tienes una cita el ${formatFechaHora(d.inicio)} en ${d.sucursalNombre} con ${d.especialistaNombre}.`,

  aviso: (d: DatosCita): string =>
    `Tu cita del ${formatFechaHora(d.inicio)} en ${d.sucursalNombre} fue cancelada. Escríbenos para reagendar.`,

  /** Aviso al ESPECIALISTA sobre un cambio en su agenda (FASE-07, D4). */
  avisoEspecialista: (d: DatosCita): string =>
    `${d.motivo ?? 'Novedad en tu agenda'}: ${d.clienteNombre ?? 'cliente'}${d.servicioNombre ? ' · ' + d.servicioNombre : ''} el ${formatFechaHora(d.inicio)} en ${d.sucursalNombre}.`,

  /** Base de campaña (FASE-05); el negocio normalmente la personaliza. */
  marketing: (d: DatosCita): string =>
    `${d.sucursalNombre}: tenemos cupos disponibles esta semana. Responde para agendar.`,
};
