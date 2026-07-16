# FASE-01 · Cimientos: SDK, puerto multicanal y adaptadores reales

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.
> Esta fase **avanza en mock** sin necesidad de las claves de FASE-00; con claves, envía real.

## Objetivo
Generalizar el puerto de notificaciones a **multicanal** (SMS, WhatsApp, Email) y añadir los **adaptadores reales de Twilio** (SMS y WhatsApp) + **Twilio Verify** + **SendGrid Email**, manteniendo el `MockAdapter` como fallback. Además, introducir la **costura ISV-ready (D6)**: un `RemitenteResolver` y un `PerfilRemitente` que los adaptadores reciben en vez de leer el env global. El dominio sigue llamando la misma API de encolado (cero cambios en los flujos de negocio en esta fase).

## Prerrequisitos / Dependencias
- FASE-00 para envío real (opcional para avanzar en mock).

## Cambios técnicos (Pasos de Claude)
1. **Instalar SDKs** como dependencias: `twilio`, `@sendgrid/mail` (en `apps/api/package.json`). Mantener import perezoso para no exigirlos en tests unitarios.
2. **Nuevo puerto multicanal** en `notification-sender.port.ts`:
   - `type Canal = 'sms' | 'whatsapp' | 'email'`.
   - `interface MensajeSalida { canal; to; cuerpo?; plantillaContentSid?; variables?; asunto? }`.
   - `interface NotificationSender { enviar(m): Promise<{ proveedorId: string }>; soporta(canal): boolean }`.
3. **Adaptadores concretos** (uno por transporte). **Reciben `PerfilRemitente`** (D6) y de ahí sacan `from`/`messagingServiceSid`/`whatsappFrom` y el cliente Twilio (cuenta madre o subcuenta); **no leen el env directamente**:
   - `adapters/twilio-sms.adapter.ts` → `messages.create({ to, messagingServiceSid | from, body, statusCallback })`.
   - `adapters/twilio-whatsapp.adapter.ts` → `messages.create({ to:'whatsapp:'+to, from:'whatsapp:'+perfil.whatsappFrom, contentSid, contentVariables })`.
   - `adapters/sendgrid-email.adapter.ts` → cableado real de `@sendgrid/mail`.
   - `adapters/mock.adapter.ts` → adaptado a la nueva interfaz (guarda `enviados[]`).
4. **Dispatcher de canal** dentro de `NotificacionesService` (o `MessageDispatcher`): dado un `MensajeSalida`, elige el adaptador cuyo `soporta(canal)` es true. Registro de adaptadores por DI.
5. **Resolutor de remitente (D6)** `remitente/remitente.resolver.ts` + `remitente/perfil-remitente.ts`:
   - `PerfilRemitente { negocioId; modo:'plataforma'|'propio'; subcuentaSid?; authToken?; messagingServiceSid?; smsFrom?; whatsappFrom?; wabaId?; verifyServiceSid? }`.
   - `RemitenteResolver.resolver(negocioId)`: **en v1 devuelve siempre el perfil PLATAFORMA** construido desde las `TWILIO_*` del env. Deja el punto de extensión para leer `mensajeria_remitente` (FASE-11) — puede consultarse ya con fallback al perfil plataforma si no hay fila propia. Cachea por `negocioId`.
   - Los adaptadores y el Verify reciben este perfil.
6. **Verify aparte** (no es "enviar"): `verify/twilio-verify.adapter.ts` con `start(to, canal)` y `check(to, codigo)`; puerto `verify/verify.port.ts` + token. Usa el `verifyServiceSid` del perfil (plataforma en v1). Mock de Verify para dev/tests.
7. **Factory por entorno** en `notificaciones.module.ts`: registra adaptadores reales si hay claves; si no, el mock. Registra el `RemitenteResolver`. Wire de SendGrid (hoy falta).
8. Ajustar `notificaciones.service.ts` para construir `MensajeSalida` y resolver el `PerfilRemitente` del `negocioId` antes de despachar (todavía sin cambiar canales por evento — eso es FASE-05; aquí `sms` sigue de default, pero pasando por el dispatcher con perfil plataforma).

## Archivos afectados
- `apps/api/package.json`
- `apps/api/src/notificaciones/notification-sender.port.ts`
- `apps/api/src/notificaciones/adapters/twilio-sms.adapter.ts` (renombrado de `twilio.adapter.ts`)
- `apps/api/src/notificaciones/adapters/twilio-whatsapp.adapter.ts` (nuevo)
- `apps/api/src/notificaciones/adapters/sendgrid-email.adapter.ts` (de `sendgrid.adapter.ts`, cableado)
- `apps/api/src/notificaciones/adapters/mock.adapter.ts`
- `apps/api/src/notificaciones/verify/verify.port.ts` + `verify/twilio-verify.adapter.ts` + `verify/mock-verify.adapter.ts` (nuevos)
- `apps/api/src/notificaciones/remitente/perfil-remitente.ts` + `remitente/remitente.resolver.ts` (nuevos, D6)
- `apps/api/src/notificaciones/notificaciones.module.ts`
- `apps/api/src/notificaciones/notificaciones.service.ts`
- `apps/api/src/notificaciones/notificaciones.spec.ts`

## ⚠️ Acción requerida del desarrollador
- Ninguna nueva (usa las claves de FASE-00). Sin claves → mock.

## Riesgos y mitigaciones
- **Cambio de interfaz del puerto** rompe mock/tests → actualizar `notificaciones.spec.ts` en la misma fase.
- **Import perezoso del SDK** en tests → mockear `twilio`/`@sendgrid/mail`; nunca importarlos en unit tests puros.
- **Confusión utility/marketing en WhatsApp** → en esta fase el transporte es único; la distinción de cupo/política llega en FASE-03/05.

## Criterios de aceptación (Done)
- Con claves, un envío SMS y uno WhatsApp reales salen por Twilio; sin claves, se registran en mock.
- Los adaptadores reciben el `PerfilRemitente` (no leen env directo); `RemitenteResolver.resolver()` devuelve el perfil plataforma para cualquier `negocioId` en v1.
- `verify.start/check` funcionan contra Twilio Verify (o mock).
- `pnpm --filter @orkalis/api build` y `test` verdes; sin regresiones en los flujos existentes.

## Pruebas
- Unit de cada adaptador con el SDK mockeado (verifica payload a `messages.create` y a Verify).
- `notificaciones.spec.ts` actualizado al nuevo puerto.
- Smoke manual: encolar un OTP y ver el SMS real/mock.

## Trazabilidad
ADR-007, `Plan-Ejecucion-V1/FASE-11` (puerto + adaptadores).

## Resultado esperado
Base multicanal lista: SMS/WhatsApp/Email/Verify enchufables por DI, sin tocar el dominio. Preparado para outbox (FASE-02).
