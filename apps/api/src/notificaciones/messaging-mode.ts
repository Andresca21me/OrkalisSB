/**
 * Detección del modo de mensajería (real vs simulado).
 *
 * La mensajería corre en MOCK cuando no están las tres claves de Twilio (misma
 * condición que usa `notificaciones.module.ts` para elegir el adaptador). En ese
 * modo el SMS no se envía de verdad, así que exponemos el código OTP al cliente
 * (devCode) para poder crear reservas de prueba. En cuanto se configuran las
 * claves reales de Twilio, la simulación se apaga sola y el código deja de
 * exponerse — no depende de NODE_ENV.
 */
export function twilioConfigurado(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER,
  );
}

/** true cuando la mensajería está simulada (sin Twilio real) → se puede revelar el OTP. */
export function mensajeriaSimulada(): boolean {
  return !twilioConfigurado();
}
