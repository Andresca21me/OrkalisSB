# FASE-01 · Reserva pública: privacidad y anti-abuso

> Parte de `PLAN-PILOTO.md`. Abre ese archivo + este. Prioridad 🔴: sin esta fase **no se
> abre el enlace público** a los clientes de la barbería.

## Problema (reproducido el 11-nov)
1. `POST /api/public/:sucursalId/cita/buscar { telefono }` devuelve la cita más próxima de
   **cualquier** celular: id, hora, especialista, servicios y precios.
2. Con ese `id`, `GET /api/public/:sucursalId/cita/:id` muestra el detalle y
   `POST /api/public/:sucursalId/cita/:id/cancelar` la **cancela**. No hay prueba de que
   quien pide sea el dueño del celular.
3. Sin OTP, cualquiera puede reservar con el número de otra persona. Eso dispara WhatsApp
   o SMS que cuestan saldo y llena la agenda de citas falsas. El único freno es el límite
   global de 120 req/min por IP.

## Decisión de diseño
- **Cada cita tiene un `token_gestion` secreto** (64 caracteres hex, ~244 bits de azar).
  Ver, cancelar o reagendar una cita **solo** se hace con ese token. El `id` deja de servir
  para eso.
- **Quien reserva recibe el token en la respuesta** de `confirmar`. El navegador lo guarda
  y la pantalla "Ver mi cita" funciona al instante en ese mismo dispositivo.
- **Desde otro dispositivo**, "Buscar por celular" **ya no muestra la cita**: responde
  siempre lo mismo ("Si hay una cita con ese número, te enviamos el enlace") y, si existe,
  manda por mensaje al celular el enlace `APP_URL/reservar/:sucursalId/gestion/:token`.
  Así solo el dueño del celular entra. Cuesta un mensaje por búsqueda, con tope.
- **Topes anti-abuso:** máximo **3 citas futuras activas por teléfono por negocio**,
  `@Throttle` estricto en `retener`, `confirmar` y `buscar`, y máximo **1 enlace por
  teléfono cada 10 minutos**.
- La confirmación por WhatsApp **no cambia** (su plantilla está aprobada por Meta y no tiene
  variable de enlace). Agregar el enlace ahí es opcional y manual (`_GUIA-MANUAL.md`,
  Parte J).

## Alcance
- `apps/api/src/db/schema/appointments.ts` (columna `token_gestion`) + migración generada.
- `apps/api/src/agendamiento/public-agendamiento.controller.ts`
- `apps/api/src/agendamiento/public-agendamiento.service.ts`
- `apps/api/src/agendamiento/dto/agendamiento.dto.ts`
- `apps/api/src/notificaciones/templates.ts`, el registro de eventos/plantillas y el
  enrutador de canal, **solo** para agregar el evento `enlace_gestion`.
- `apps/api/src/config/env.validation.ts` (solo si `APP_URL` necesita leerse aquí; ya existe).
- `apps/web/src/pages/public/BookingPage.tsx`, `apps/web/src/App.tsx` (ruta nueva).
- Pruebas: `apps/api/src/agendamiento/*.spec.ts`, `apps/web/e2e/specs/02-reserva/*`,
  `apps/web/e2e/pages/booking.page.ts`.

## Fuera de alcance
- Citas creadas por el personal (`agendamiento.service.ts`): reciben el token por default
  de la columna, sin más cambios.
- Plantilla de WhatsApp con enlace (manual y opcional).
- Rediseño visual de la página de reserva.

## Pasos 🤖
1. **Pruebas primero** (en un spec nuevo, `agendamiento/gestion-publica.spec.ts`), que
   deben **fallar** con el código actual:
   - `cita/buscar` con un teléfono que tiene cita **no** devuelve `id`, hora ni servicios.
   - `GET cita/:id` y `POST cita/:id/cancelar` ya no existen (404).
   - `GET gestion/:token` con token válido devuelve el detalle; con token inválido, 404.
   - `POST gestion/:token/cancelar` cancela respetando la antelación configurada
     (`agendamiento.antelacion_cancelacion_horas`).
   - El token de un negocio no sirve en la ruta de otra sucursal o negocio.
   - La 4.ª cita futura activa con el mismo teléfono en el mismo negocio se rechaza (409
     con mensaje claro); una cancelada no cuenta.
   - `buscar` encola **un** mensaje `enlace_gestion` y, si se repite antes de 10 min, no
     encola otro, aunque responde lo mismo.
2. **Columna.** En `cita`: `token_gestion text not null unique` con default en BD
   `replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')`. Generar la
   migración con `db:generate`; las citas existentes quedan con token por el default.
   Verificar que la migración es aditiva.
3. **Servicio:**
   - `confirmar()` devuelve además `tokenGestion`.
   - Nuevos `detallePorToken(sucursalId, token)` y `cancelarPorToken(sucursalId, token)`.
     Reutilizar `cargarDetalle` y la lógica de `cancelarDesdeEnlace`, filtrando por
     `token_gestion` **y** `sucursal_id`.
   - `buscarCita()` pasa a `enviarEnlaceGestion(sucursalId, telefono)`. Busca la cita
     futura no cancelada más próxima. Si existe y no se envió un enlace a ese teléfono en
     los últimos 10 minutos (consultar la tabla `mensaje` por evento + destino + fecha),
     encola el evento `enlace_gestion`. Responde **siempre** `{ enviado: true }`.
   - En `confirmar()`, antes de insertar: contar las citas de ese teléfono en el negocio
     con `inicio >= now()` y estado no cancelado ni no-asistió. Si son ≥ 3, lanzar
     `ConflictException('Ya tienes 3 citas próximas en este negocio. Cancela una para
     reservar otra.')`. Dejar el 3 como constante con nombre (`MAX_CITAS_FUTURAS_POR_TELEFONO`).
   - Normalizar el teléfono con el helper existente de `notificaciones/phone.ts` antes de
     buscar o contar, para que "300 123 4567" y "3001234567" sean el mismo.
4. **Controlador:**
   - Quitar `GET cita/:id` y `POST cita/:id/cancelar`.
   - Agregar `GET gestion/:token` y `POST gestion/:token/cancelar`.
   - `POST cita/buscar` → `@Throttle({ default: { limit: 5, ttl: 60_000 } })`.
   - `POST retener` → `@Throttle({ default: { limit: 20, ttl: 60_000 } })`.
   - `POST confirmar` → `@Throttle({ default: { limit: 5, ttl: 60_000 } })`.
5. **Mensaje `enlace_gestion`:** plantilla default corta y en GSM-7, siguiendo las reglas
   de `templates.ts`. Ejemplo: `Gestiona tu cita en {negocio}: {enlace}`. Es transaccional.
   Sin Content SID de WhatsApp para este evento, el enrutador lo manda por SMS (comportamiento
   ya existente). Dejar preparada la variable `TWILIO_WA_TPL_ENLACE_GESTION` (opcional) en
   `env.validation.ts` y `.env.example`, siguiendo el patrón de las otras plantillas, con
   el mapeo exacto de variables que espera la plantilla de la Parte J de la guía
   (`{{1}}` = nombre del negocio, `{{2}}` = enlace). Así, cuando Meta la apruebe, basta
   con cargar el SID en Railway. El enlace se construye con `APP_URL`.
6. **Frontend (`BookingPage.tsx`):**
   - Guardar `tokenGestion` tras confirmar en `localStorage` bajo
     `orkalis:citas:<sucursalId>` (lista, máximo 5, con `try/catch`).
   - "Ver mi cita" en el mismo dispositivo usa el token guardado → `GET gestion/:token`.
   - Pantalla de búsqueda por celular: al enviar, mostrar "Si hay una cita con ese número,
     te enviamos un enlace por mensaje para verla o cancelarla". Nunca mostrar la cita.
   - Nueva ruta `/reservar/:sucursalId/gestion/:token` en `App.tsx`. Abre directamente el
     detalle con las acciones de cancelar y reagendar.
   - Reagendar (hoy cancela por `id` en la línea ~132) pasa a cancelar por token.
7. **E2E:** actualizar `flujo-ui.spec.ts`: buscar por celular muestra el mensaje genérico;
   cancelar entra por la URL con token, que el spec obtiene de la respuesta de `confirmar`
   o de la BD; reagendar funciona.
8. Gate completo + `pnpm --filter web e2e -- e2e/specs/02-reserva e2e/specs/03-flujo-cruzado`.

## ✅ Criterio de hecho
- Las pruebas del paso 1 en verde; ninguna otra prueba en rojo.
- Con la API local corriendo: `curl -X POST .../cita/buscar -d '{"telefono":"3001112233"}'`
  responde `{"enviado":true}` y **no** contiene `id` ni `inicio`.
- `curl .../cita/<cualquier-id>/cancelar` → 404.

## Qué quedó hecho
_(Claude lo completa.)_

## Hallazgos para fases futuras
_(Claude anota aquí.)_
