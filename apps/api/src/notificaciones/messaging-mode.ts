/**
 * ¿Hay credenciales de Twilio en el entorno?
 *
 * Es la mitad "estática" de la decisión: sin claves, la mensajería corre en
 * `MockAdapter` y nada sale de verdad (misma condición que usa
 * `notificaciones.module.ts` para elegir adaptador). No depende de NODE_ENV.
 *
 * La otra mitad —el interruptor que se apaga al quedarse sin crédito— vive en
 * `MensajeriaEstadoService`, porque cambia en caliente y hay que poder
 * encenderlo sin redesplegar. Para preguntar "¿puedo enviar ahora?" úsese
 * `MensajeriaEstadoService.operativa()`, que combina las dos.
 */
export function twilioConfigurado(): boolean {
  // Misma condición que el factory de adaptadores (`notificaciones.module.ts`):
  // como remitente SMS vale el número directo O el Messaging Service.
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID),
  );
}
