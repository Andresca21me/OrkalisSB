# FASE-00 · Prerrequisitos y cuentas Twilio

> Parte de `PLAN-MENSAJERIA`. Al empezar la sesión abre **solo** `PLAN-MENSAJERIA.md` (contexto global) + este archivo.
> Esta fase es **casi toda del USUARIO** (crear cuentas, obtener claves, aprobar plantillas). Claude solo documenta variables y deja notas; **no inventa claves**: si faltan, usa mock y lo avisa.

## Objetivo
Dejar Twilio operativo (SMS, WhatsApp, Verify) y **todas las credenciales disponibles** en `.env` (local) y Railway (prod), de modo que las fases siguientes puedan enviar de verdad. Sin esto, el sistema corre en `MockAdapter` (válido para desarrollar).

## Prerrequisitos / Dependencias
- Ninguna fase previa. Es la primera.
- Cuenta Twilio (existe trial creado 2026-06-15 según `CREDENCIALES-PENDIENTES.md`).

## Cambios técnicos (Pasos de Claude)
1. Declarar/confirmar en `apps/api/src/config/env.validation.ts` las variables (todas **opcionales**, para no romper dev en mock):
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (ya existen).
   - **Nuevas:** `TWILIO_MESSAGING_SERVICE_SID?`, `TWILIO_WHATSAPP_FROM?`, `TWILIO_VERIFY_SERVICE_SID?`, `TWILIO_STATUS_CALLBACK_URL?`, y los Content SID de plantillas WhatsApp (`TWILIO_WA_TPL_CONFIRMACION?`, `..._RECORDATORIO?`, `..._AVISO?`, `..._AVISO_ESPECIALISTA?`, `..._MARKETING?`).
   - `SENDGRID_API_KEY?`, `MAIL_FROM?` (ya existen).
2. Reflejar todas en `apps/api/.env.example` con comentarios.
3. Actualizar `CREDENCIALES-PENDIENTES.md` con el checklist de esta fase.
4. **No** escribir lógica de adaptadores aquí (eso es FASE-01).

## Archivos afectados
- `apps/api/src/config/env.validation.ts`
- `apps/api/.env.example`
- `CREDENCIALES-PENDIENTES.md`

## ⚠️ Acción requerida del desarrollador (intervención manual)
- **AM-1 · Número SMS + Messaging Service:** en consola Twilio → Phone Numbers, activar un número con SMS para Colombia y crear un **Messaging Service** que lo contenga (mejor entregabilidad/pooling y es el primitivo ISV-ready para FASE-11). Entregar `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` (recomendado) y/o `TWILIO_FROM_NUMBER`. Configurar **geo-permissions → solo Colombia**.
- **AM-2 · Verify Service:** Twilio → Verify → Services → crear. Entregar `TWILIO_VERIFY_SERVICE_SID`.
- **AM-3 · WhatsApp sender + plantillas:** Twilio → Messaging → WhatsApp senders (registro Meta) + Content Template Builder. Crear y **enviar a aprobación** las plantillas: confirmación, recordatorio, aviso de cancelación, aviso al especialista, marketing. Entregar `TWILIO_WHATSAPP_FROM` y el **Content SID** de cada plantilla. ⚠️ La aprobación de Meta puede tardar días: **empezar ya**.
- **AM-5 (opcional) · SendGrid:** cuenta + remitente verificado. Entregar `SENDGRID_API_KEY`, `MAIL_FROM`.
- Pegar todo en `.env` local y variables de Railway.

## Riesgos y mitigaciones
- **Aprobación WhatsApp lenta (Meta):** iniciarla al principio; las fases de código avanzan en paralelo con mock.
- **Número trial con restricciones:** trial solo envía a números verificados; para pruebas reales verificar tu propio número o pasar a cuenta paga (FASE-10).

## Criterios de aceptación (Done)
- `.env`/Railway con `TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER` válidos.
- `TWILIO_VERIFY_SERVICE_SID` creado.
- `TWILIO_WHATSAPP_FROM` activo y ≥1 plantilla aprobada con su Content SID.
- `CREDENCIALES-PENDIENTES.md` actualizado.

## Pruebas
- Envío manual de un SMS y un WhatsApp de prueba desde la consola Twilio a tu número.
- `pnpm --filter @orkalis/api build` sigue verde (variables opcionales no rompen el arranque).

## Trazabilidad
ADR-007 (canal de notificaciones), `Plan-Ejecucion-V1/FASE-00` y `FASE-11`, `CREDENCIALES-PENDIENTES.md`.

## Resultado esperado
Credenciales listas para que FASE-01+ envíen mensajes reales; sin ellas, el sistema sigue funcionando en mock.
