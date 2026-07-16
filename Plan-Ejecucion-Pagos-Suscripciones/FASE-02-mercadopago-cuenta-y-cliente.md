# FASE-02 · Mercado Pago: cuenta, credenciales y cliente real

## Objetivo
Tener la cuenta/aplicación de Mercado Pago (modo prueba) con sus credenciales y webhook, y un `MercadoPagoClient` capaz de **tokenizar tarjetas** (en el front), **guardar la tarjeta** del cliente (Customer + Card) y **crear pagos** contra esa tarjeta (la base del cobro recurrente), además de verificar las notificaciones. **Esta es la fase con trabajo manual tuyo.**

## Prerrequisitos
- FASE-00/01. **Abrir `_GUIA-MERCADOPAGO-PASO-A-PASO.md` y hacer PASOS 1–5.**

## Pasos

### 🧑‍💻 TÚ (Mercado Pago) — guiado en `_GUIA-MERCADOPAGO`
1. Crear cuenta y una **Aplicación** de "Pagos online" y entrar a su tablero (PASO 1).
2. Copiar las **credenciales de prueba**: **Public Key** y **Access Token** (PASO 2).
3. Configurar la **URL del webhook** y copiar su **clave secreta** (PASO 3) — con ngrok si pruebas local, o decidir webhook simulado.
4. **Pásame los 3 datos** (Public Key, Access Token, clave secreta del webhook) — o ponlos en `apps/api/.env` (PASO 5).

### 🤖 Backend
5. **Env:** agregar `MP_PUBLIC_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_ENV` a `env.validation.ts` y `.env.example`; exponer `VITE_MP_PUBLIC_KEY` para el front. Retirar las variables `WOMPI_*` que ya no se usan.
6. **`MercadoPagoClient` real** (`pagos/mercadopago.client.ts`, NUEVO; reemplaza `wompi.client.ts`) — implementar contra la API de Mercado Pago (**`https://api.mercadopago.com`**, misma URL en test y prod; el ambiente lo decide el `Access Token`). Todas las llamadas privadas llevan `Authorization: Bearer <MP_ACCESS_TOKEN>`:
   - `crearCustomer({ email })` → `POST /v1/customers` → devuelve `customer.id`. (Reutilizar si ya existe por email.)
   - `guardarTarjeta({ customerId, cardToken })` → `POST /v1/customers/:customerId/cards` con el `token` de tarjeta del front → devuelve `card.id` y los `last_four_digits` (para `metodo_ultimos4`).
   - `tokenizarTarjetaGuardada({ cardId })` → `POST /v1/card_tokens` con `{ card_id }` → genera un **token de un solo uso** desde la tarjeta guardada, necesario para cada cobro recurrente (MIT). *(En sandbox basta el `card_id`; si la doc vigente exige CVV para recurrencia, lo anotamos en FASE-05.)*
   - `crearPago({ token, montoCOP, referencia, payerEmail, customerId, descripcion })` → `POST /v1/payments` con header **`X-Idempotency-Key: <referencia>`** y body `{ transaction_amount: montoCOP, token, installments: 1, payment_method_id, payer: { type: 'customer', id: customerId, email: payerEmail }, external_reference: referencia, description }`. Devuelve `{ id, status }` (`approved` / `rejected` / `in_process` / `pending`). **Nota:** Mercado Pago usa el **monto en unidades** (COP, no centavos).
   - `consultarPago(id)` → `GET /v1/payments/:id` (para confirmar el estado si el webhook tarda).
   - `verificarFirma({ headers, dataId })` → valida el header **`x-signature`** (HMAC-SHA256 con `MP_WEBHOOK_SECRET` sobre el manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`). Sustituye a `verificarFirma` de Wompi.
   - **Modo inactivo** (sin credenciales): que todo devuelva respuestas simuladas claramente marcadas, para no bloquear desarrollo (mantener el patrón que ya existía en `WompiClient`).
   > Nota: ya **no** existen `obtenerAcceptanceToken` ni `payment_source` (eran de Wompi). En Mercado Pago el equivalente es **Customer + Card** + token de un solo uso.
7. **Webhook robusto** (`pagos/pagos.controllers.ts` + servicio): al recibir una notificación con `type=payment` (`data.id`):
   - Verificar firma (`x-signature`). Hacer `consultarPago(data.id)` para leer el estado real y su `external_reference`.
   - Buscar el `cobro` por `referencia` (= `external_reference`). Si `approved` → marcar `pagado` + `pago_ok` (transición). Si `rejected/cancelled` → marcar `fallido` + `cobro_falla`. **Idempotente** por referencia (y por `mp_payment_id`).

## ✅ Verificación
- `MercadoPagoClient.configurado` true con tus credenciales; `crearCustomer(...)` responde en sandbox (prueba manual con un `curl`/test).
- Unit test de la verificación de **firma del webhook** (`x-signature`) con un evento de ejemplo.
- 🧑‍💻 Si configuraste ngrok: una notificación de prueba de Mercado Pago llega a `/api/pagos/webhook` y se loguea verificada. (Si no, lo simulamos en FASE-05.)

## Trazabilidad
- `_GUIA-MERCADOPAGO` PASOS 1–5. ADR-P1, ADR-P4, ADR-P5. RNF-012 (firma).
