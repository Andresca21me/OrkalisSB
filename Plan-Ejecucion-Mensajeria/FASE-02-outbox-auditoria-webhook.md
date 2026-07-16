# FASE-02 · Outbox persistente + auditoría + webhook de estado

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.

## Objetivo
Reemplazar la cola en memoria (`JobQueue`, fire-and-forget) por un **outbox durable** (tabla `mensaje`) que es a la vez cola con reintentos, **log de auditoría** y fuente de métricas. Añadir el **webhook de estado de Twilio** para conocer la entrega real. Mantener intacta la API de encolado del dominio.

## Prerrequisitos / Dependencias
- FASE-01 (puerto multicanal y adaptadores).

## Cambios técnicos (Pasos de Claude)
1. **Tabla `mensaje`** (Parte III.3 del plan) en `db/schema/notificaciones.ts` + export en `index.ts` + migración Drizzle. Columnas: `negocio_id, sucursal_id?, canal, tipo, transaccional, destino, plantilla_clave?, cuerpo?, estado, sobre_cupo, proveedor, proveedor_id?, error?, intento, cita_id?, creado_en, enviado_en?, entregado_en?`. Índices `(negocio_id, creado_en)`, `(estado)`, `(proveedor_id)`.
2. **Encolado → insert en outbox:** `NotificacionesService.encolar*` inserta fila `estado='pendiente'` (dentro del tenant) en vez de empujar a `JobQueue`.
3. **`OutboxWorker`** (`@Interval`, reemplaza `job-queue.ts`): toma pendientes con lock (`FOR UPDATE SKIP LOCKED` o marca `enviando`), **resuelve el `PerfilRemitente` del `negocio_id` (D6, `RemitenteResolver` de FASE-01)**, llama al adaptador del canal con ese perfil, guarda `proveedor_id` y `estado='enviado'`/`enviado_en`. Fallo transitorio (**429 / 5xx / timeout**) → `intento++` con **backoff exponencial** (máx 3); permanente o agotado → `estado='fallido'` + `error`. Idempotente por fila.
4. **Webhook** `notificaciones/webhooks.controller.ts`: `POST /api/webhooks/twilio/status` (`@Public()`), **valida `X-Twilio-Signature`**, actualiza `mensaje.estado` por `proveedor_id` (sent/delivered/undelivered/failed → `enviado`/`entregado`/`fallido`) + `entregado_en`. Idempotente.
5. **Métricas:** extender `observability/metrics.service.ts` con `mensajes_enviados`, `mensajes_fallidos` por canal/estado.
6. **`drain()` para tests:** exponer un método del worker que procese pendientes de forma síncrona (equivalente al `JobQueue.drain` actual).
7. Conservar `JobQueue` solo si algún job no-mensajería lo usa (p. ej. `exportacion-pesada`); si no, migrarlo también.

## Archivos afectados
- `apps/api/src/db/schema/notificaciones.ts`, `db/schema/index.ts`, `apps/api/drizzle/*` (migración)
- `apps/api/src/notificaciones/outbox.worker.ts` (nuevo, reemplaza `job-queue.ts`)
- `apps/api/src/notificaciones/notificaciones.service.ts`
- `apps/api/src/notificaciones/webhooks.controller.ts` (nuevo)
- `apps/api/src/notificaciones/notificaciones.module.ts`
- `apps/api/src/observability/metrics.service.ts`
- Ajustes en `notificaciones.spec.ts`

## ⚠️ Acción requerida del desarrollador
- **AM-4 · Webhook público:** exponer `https://<dominio>/api/webhooks/twilio/status` y configurarlo como Status Callback del número/Messaging Service en Twilio. Entregar/confirmar `TWILIO_STATUS_CALLBACK_URL`.

## Riesgos y mitigaciones
- **Doble envío** si el worker no es idempotente → estado `enviando` + lock; nunca reenviar filas ya `enviado`.
- **Firma del webhook** → validar `X-Twilio-Signature`; rechazar si no valida.
- **Migración con datos** → tabla nueva, sin datos previos; riesgo bajo.
- **Pérdida durante ventana de crash** → al reiniciar, el worker retoma `pendiente`/`enviando` colgados.

## Criterios de aceptación (Done)
- Reiniciar el proceso **no pierde** mensajes pendientes (se reanudan).
- Cada envío deja fila en `mensaje` con ciclo de vida completo y `proveedor_id`.
- El webhook actualiza a `entregado`/`fallido`.
- Métricas incrementan por canal/estado.

## Pruebas
- Integración: encolar → matar worker → reiniciar → se envía.
- Idempotencia del webhook (mismo evento dos veces).
- Reintentos con fallo transitorio simulado; no-reintento en error permanente.
- Validación de firma (rechaza firma inválida).

## Trazabilidad
ADR-007 (cola/no bloquear, RNF-002), Parte II y VI del plan.

## Resultado esperado
Envíos durables, auditables y con estado de entrega real. Base para límites (FASE-03) y para la UI de registro de mensajes.
