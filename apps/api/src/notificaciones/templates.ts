/**
 * Plantillas de mensaje en español, formato es-CO (FASE-11, RF-047/048).
 */

export interface DatosCita {
  sucursalNombre: string;
  especialistaNombre: string;
  servicioNombre?: string;
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

export const plantillas = {
  otp: (codigo: string): string =>
    `Tu código de verificación Orkalis es ${codigo}. Vence en 5 minutos. No lo compartas.`,

  confirmacion: (d: DatosCita): string =>
    `¡Reserva confirmada! ${d.servicioNombre ? d.servicioNombre + ' ' : ''}con ${d.especialistaNombre} en ${d.sucursalNombre} el ${formatFechaHora(d.inicio)}.`,

  recordatorio: (d: DatosCita): string =>
    `Recordatorio: tienes una cita el ${formatFechaHora(d.inicio)} en ${d.sucursalNombre} con ${d.especialistaNombre}.`,

  aviso: (d: DatosCita): string =>
    `Tu cita del ${formatFechaHora(d.inicio)} en ${d.sucursalNombre} fue cancelada. Escríbenos para reagendar.`,
};
