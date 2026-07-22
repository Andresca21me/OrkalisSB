# FASE-07 · Avisos por mensajería al especialista

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.
> Implementa **D4**: avisar al especialista en cita confirmada/asignada, cancelada y reagendada.
>
> **Estado: ✅ implementada** (247 tests verdes), con **una salvedad de alcance**:
> el evento *reagendada* **no se cableó porque el producto no tiene flujo de
> reagendamiento** — no existe endpoint ni UI para mover una cita de hora. Lo más
> cercano, **reasignar** (cambio de especialista), sí está cubierto. Cuando se
> añada el reagendamiento, basta una línea más llamando a `AvisosEspecialistaService`.

## Objetivo
Notificar por SMS/WhatsApp al especialista (usando su teléfono verificado) cuando una de sus citas se **confirma/asigna**, se **cancela** o se **reagenda**. Hoy el especialista solo lo ve in-app.

## Prerrequisitos / Dependencias
- FASE-06 (el especialista tiene teléfono verificado).
- FASE-03/05 (cupos por canal + routing).

## Cambios técnicos (Pasos de Claude)
1. **Nuevo tipo de mensaje** `aviso_especialista` (enum de `mensaje.tipo`) — transaccional (utility).
2. **Plantilla** `aviso_especialista` (default en `templates.ts` + configurable en `plantilla_mensaje`, FASE-04). Variables: cliente, fecha, servicio, sucursal.
3. **Productores** en el flujo de citas:
   - **Confirmada/asignada:** en `public-agendamiento.service.ts` (`confirmar`, cuando queda `Confirmada`) y en la creación interna/asignación (`agendamiento.service.ts`, `reasignar`).
   - **Cancelada:** transiciones de cancelación (cliente/admin) en `agendamiento` y `public-agendamiento`.
   - **Reagendada:** flujo de reagendamiento.
   - Cada uno: obtener `especialista.telefono` (+ `telefono_verificado_en`); si existe → `encolarAvisoEspecialista(negocioId, telefono, datos)`; si no → omitir + log.
4. **`NotificacionesService.encolarAvisoEspecialista(...)`** (nuevo método de encolado, mismo patrón que los demás).

## Archivos afectados
- `apps/api/src/notificaciones/notificaciones.service.ts` (nuevo encolado + tipo)
- `apps/api/src/notificaciones/templates.ts` / `plantilla_mensaje`
- `apps/api/src/agendamiento/agendamiento.service.ts`
- `apps/api/src/agendamiento/public-agendamiento.service.ts`
- (transiciones de estado de cita implicadas)

## ⚠️ Acción requerida del desarrollador
- Si se usa WhatsApp para este aviso: la plantilla `aviso_especialista` debe estar aprobada (AM-3).

## Riesgos y mitigaciones
- **Especialista sin teléfono verificado** (altas antiguas) → se omite el aviso y se registra; no falla la operación de la cita.
- **Consumo extra de cupo** → contabilizado en el canal correspondiente; visible en cupos/alertas.
- **Duplicados** → un aviso por evento; idempotencia por el outbox/estado de la cita.
- **Ruido** → no se envía recordatorio de jornada (fuera de alcance por D4).

## Criterios de aceptación (Done)
- Al confirmar/cancelar/reagendar una cita, el especialista con teléfono recibe el aviso.
- Cada aviso queda registrado en `mensaje` (auditoría).
- Si no hay teléfono, la cita opera normal y se loguea la omisión.

## Pruebas
- E2E de los tres eventos (confirmación, cancelación, reagendamiento).
- Omisión correcta si el especialista no tiene teléfono verificado.
- Consumo imputado al canal correcto.

## Cómo quedó implementado
- **`agendamiento/avisos-especialista.service.ts`**: un único punto que carga cita + especialista + cliente + sucursal y encola. Vive aparte porque lo disparan dos flujos (agenda interna y reserva pública) y duplicar la consulta era pedir que se desincronizaran.
- **Nunca tumba la operación**: se llama siempre **post-commit** y captura cualquier error. La cita ya es un hecho; que falle el aviso no puede deshacerla. Hay prueba con una cita inexistente.
- **Sin celular verificado se omite y se registra** (altas anteriores a FASE-06): comprueba `telefono` **y** `telefono_verificado_en`, no basta con que haya número.
- **Productores cableados**: cita interna creada (`crearAgendada`), reserva pública confirmada (solo si queda `Confirmada`; si entra como `Solicitada` el aviso irá al aprobarla), cancelación interna, cancelación desde el enlace público, y reasignación (avisa al nuevo responsable).
- **Variable `{{motivo}}`** añadida a la whitelist de plantillas: distingue "Nueva cita en tu agenda" / "Cita cancelada" / "Te asignaron esta cita" y permite que el negocio personalice el texto sin perder el contexto (FASE-04).
- **Transaccional**: como el resto de avisos operativos, no se corta al agotarse el cupo; se envía marcado `sobre_cupo` y queda auditado en `mensaje`.

## Trazabilidad
D4, RF-047/048 (avisos), Parte VII del plan, HU-ESP-002 (recepción de citas — se complementa con mensajería).

## Resultado esperado
El especialista se entera por mensajería de los cambios en sus citas, además de in-app.
