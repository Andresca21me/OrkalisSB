# FASE-11 · Notificaciones (puerto + Twilio SMS + email + colas)

## Objetivo
Implementar el canal de notificaciones con una **abstracción (puerto `NotificationSender`)** y **SMS (Twilio)** como proveedor inicial para **OTP, confirmaciones y recordatorios**, con **email (SendGrid)** como complemento y WhatsApp como futuro enchufable. Todo el envío va por **cola/worker** para no bloquear peticiones (ADR-007, RNF-002).

## Prerrequisitos
- FASE-08 (genera eventos: OTP a enviar, confirmación, recordatorio).
- FASE-09/10 (la cola también la usan exportaciones pesadas).

---

## Pasos de Claude

### 1. Puerto (patrón hexagonal)
Crear `notificaciones/notification-sender.port.ts`:
```ts
export interface NotificationSender {
  enviarSms(to: string, mensaje: string): Promise<void>;
  enviarEmail?(to: string, asunto: string, cuerpo: string): Promise<void>;
}
```
El dominio depende SOLO de esta interfaz, nunca de Twilio directamente.

### 2. Adaptadores
- `adapters/twilio.adapter.ts` — implementa `enviarSms` con el SDK de Twilio usando `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
- `adapters/sendgrid.adapter.ts` (opcional) — implementa `enviarEmail` con `SENDGRID_API_KEY`/`MAIL_FROM`.
- `adapters/mock.adapter.ts` — en `NODE_ENV=development`, **loguea** el SMS/OTP en consola en vez de enviar (para no gastar saldo ni depender de claves en dev).
- Seleccionar el adaptador por entorno/config.

### 3. Cola y workers
- Introducir una **cola** (en Railway será gestionada; en local usar Redis vía Docker + BullMQ, o una cola simple). Definir `docker-compose` con Redis si se usa BullMQ.
- Procesos worker que consumen jobs: `enviar-otp`, `enviar-confirmacion`, `enviar-recordatorio`, `limpiar-retenciones` (de FASE-08), `exportacion-pesada` (de FASE-10).
- Encolar, no enviar inline (RNF-002).

### 4. Tipos de notificación (RF-047, RF-048)
- **OTP** (FASE-08): SMS con el código.
- **Confirmación** de reserva: al confirmar la cita.
- **Recordatorio**: programado según `agendamiento.ventana_recordatorio_horas` (config). Un job programado revisa citas próximas y encola recordatorios.
- **Aviso de cambios**: cancelación/modificación de la cita por el negocio (RF-048, HU-CLI-005 escenario 2).
- El **canal por tipo de evento** es configurable vía ConfigResolver (ADR-007 enlaza con ADR-002).

### 5. Plantillas
- Plantillas de mensaje en **español**, con datos del turno (sucursal, especialista, servicio, fecha/hora) formateados `es-CO`.

### 6. Cupos de mensajería por plan (ADR-009)
- Cada plan define **cupos mensuales por canal** (WhatsApp Utility, WhatsApp Marketing, SMS, Email), con un **cupo base** + **adicional por cada especialista extra**. Catálogo canónico en ADR-009 (registry de planes, FASE-07).
- **Contabilizar el consumo** por negocio y canal en el período de facturación (tabla de consumo o contador) y compararlo contra el cupo resuelto = `base(plan, canal) + (nº_especialistas − incluidos) × adicional(plan, canal)`.
- Al **agotar el cupo** de un canal: degradar con gracia (p. ej. usar canal de respaldo más barato o detener marketing) y avisar al admin; **utility/confirmaciones/recordatorios** no deben cortarse abruptamente (afectan al cliente final). Política de exceso documentada.
- El **marketing** se vende como **paquetes de créditos adicionales** (no se regala el canal más costoso).

---

## ⚠️ ACCIÓN DEL USUARIO
- Entregar las claves de **Twilio** y pegarlas en `apps/api/.env`:
  - `TWILIO_ACCOUNT_SID=...`
  - `TWILIO_AUTH_TOKEN=...`
  - `TWILIO_FROM_NUMBER=+1...` (el número de prueba de Twilio)
- (Opcional, email) `SENDGRID_API_KEY=...` y `MAIL_FROM=...`.
- En cuenta **trial de Twilio**, solo se puede enviar SMS a números **verificados**: el USUARIO debe verificar su propio número en el panel de Twilio para probar el OTP real. Avísale.

> Claude NO inventa estas claves. Si no están en `.env`, Claude usa el `mock.adapter` y deja una nota en `CREDENCIALES-PENDIENTES.md`.

---

## Verificación / Done
- Con claves Twilio reales, el OTP llega por SMS a un número verificado; sin claves, el `mock.adapter` loguea el código en dev.
- Confirmación y recordatorio se **encolan** y un worker los procesa (no bloquean la petición de reserva).
- El recordatorio respeta `ventana_recordatorio_horas` del config.
- Cancelación por el negocio dispara aviso al cliente.
- Cambiar de proveedor (mock↔twilio) no toca el código de dominio (solo el adaptador).
- El consumo por canal se contabiliza y, al alcanzar el cupo del plan, se aplica la política de exceso (degradación/aviso) sin cortar recordatorios/confirmaciones.

## Trazabilidad
- ADR-007 completo, ADR-002 (canal configurable), ADR-003 (OTP), **ADR-009 (cupos de mensajería por plan)**, RNF-002, RNF-011. RF-047, RF-048, HU-CLI-005.
