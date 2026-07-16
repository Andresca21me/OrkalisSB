# FASE-05 · Primer pago y registro del método de pago

## Objetivo
Que el cliente ingrese su tarjeta (tokenizada por el SDK de Mercado Pago), se guarde como **tarjeta recurrente** (Customer + Card), se haga el **primer cobro** y la cuenta pase a `activa`. Es el corazón del cobro.

## Prerrequisitos
- FASE-02 (`MercadoPagoClient` real + credenciales). 🧑‍💻 tener tarjetas de prueba (`_GUIA` PASO 4).

## Pasos

### 🤖 Frontend (checkout)
1. **`CheckoutPage`** (sitio) y/o **pantalla de facturación** del admin: cargar el **SDK de Mercado Pago** (`@mercadopago/sdk-js` / SecureFields o el brick **CardForm**) con `VITE_MP_PUBLIC_KEY` para **tokenizar la tarjeta** en el navegador (la tarjeta **nunca** toca nuestro backend → PCI). Resultado: un **token de tarjeta** + el `email` del pagador.
   - Mostrar plan, nº especialistas y **monto** (`cargoMensual`) antes de pagar.
2. Enviar al backend `{ cardToken, payerEmail }`.

### 🤖 Backend
3. **`POST /suscripcion/metodo-pago`**: con el token de tarjeta:
   - `crearCustomer({ email })` (o reutilizar el existente) → `guardarTarjeta({ customerId, cardToken })` → guardar `mp_customer_id`, `mp_card_id`, `metodo_ultimos4` y `mp_payer_email` en la suscripción.
4. **`POST /suscripcion/pagar` (primer cobro):** crear un `cobro` (`periodo` actual, `monto`, `referencia` única) → `tokenizarTarjetaGuardada({ cardId })` → `crearPago({ token, montoCOP, referencia, payerEmail, customerId })` (con `X-Idempotency-Key = referencia`).
   - Si el pago es `approved` (o llega el webhook): transición `pago_ok` → `activa`, fijar `dia_cobro = day(now)` (ancla 1..28) y `proximo_cobro = +1 mes`.
   - Si `rejected`: mostrar error (mapear el `status_detail` de Mercado Pago a un mensaje claro), no activar.
5. **Confirmación por webhook:** el resultado definitivo lo confirma la notificación de Mercado Pago (FASE-02). El front hace polling a `GET /suscripcion` hasta ver `activa`.

### 🧑‍💻 TÚ (pruebas)
6. Confirmar en la doc de Mercado Pago las **tarjetas de prueba** vigentes y los **nombres de titular** que fuerzan el estado (`APRO` aprobado, `OTHE`/`FUND` rechazado). Si no usas ngrok, te doy un `curl` que **simula** la notificación firmada (`x-signature`) para cerrar el flujo.

## ✅ Verificación
- E2E/test: con titular **`APRO`** → cuenta pasa a `activa`, `dia_cobro` y `proximo_cobro` fijados, `cobro` `pagado`, `metodo_ultimos4` visible.
- E2E/test: titular **`OTHE`** (rechazado) → cuenta NO se activa, mensaje claro, sin método guardado en mal estado.
- Idempotencia: reenviar la notificación (mismo `mp_payment_id`/`referencia`) no duplica el cobro.

## Trazabilidad
- HU-ADM-001 (pagar ya), HU-PLT-001 (monto correcto). `_MODELO §2, §5`. ADR-P1.
