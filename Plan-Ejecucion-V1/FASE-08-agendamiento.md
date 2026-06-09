# FASE-08 · Agendamiento (núcleo diferenciador)

## Objetivo
Implementar el subsistema de **mayor riesgo y valor**: disponibilidad en tiempo real, **reserva pública sin cuenta con OTP**, **control de concurrencia "0 dobles reservas"** (retención TTL + `EXCLUDE`), la **máquina de estados** de la cita, los **validadores por origen** (Strategy) y los **walk-ins** (en vivo y retroactivo). Lee banderas/reglas del `ConfigResolver` (FASE-06).

## Prerrequisitos
- FASE-06 (config: aprobación manual, antelación, TTL de retención).
- FASE-07 (sucursales, especialistas válidos por sucursal).
- FASE-03 (`cita` con `EXCLUDE`, `retencion_franja`, `disponibilidad`, `otp_codigo`).
- Tener a la vista `Diagramas/estados-cita.svg` y `Diagramas/secuencia-agendamiento-publico.svg`.

---

## Pasos de Claude

### 1. Servicio de disponibilidad (`disponibilidad.service.ts`)
- Dada sucursal + especialista + servicio (duración) + fecha, calcular **franjas libres**: cruzar la `disponibilidad` del especialista contra (a) citas en estado `confirmada`/`en_progreso` y (b) `retencion_franja` **vigentes** (`expira_en > now()`).
- Devolver solo franjas compatibles con la **duración del servicio** (RF-017, HU-CLI-002).
- Si no hay franjas, indicarlo y sugerir otras fechas/especialista (HU-CLI-002 escenario 2).

### 2. Máquina de estados (`cita-state-machine.ts`)
Estados: `solicitada` → `confirmada` → `en_progreso` → `completada`, con ramas `cancelada` y `no_asistio`. Transiciones permitidas (y SOLO esas):
- `solicitada → confirmada` (aprobar) | `solicitada → cancelada` (rechazar) — `solicitada` **solo existe** si `agendamiento.aprobacion_manual = true`.
- `confirmada → en_progreso` (iniciar) | `confirmada → cancelada` | `confirmada → no_asistio`.
- `en_progreso → completada` (**guard de pago**, ver FASE-09) | `en_progreso → cancelada` (incidente).
- `completada → (revertir)` deshace efectos de forma transaccional (FASE-09, HU-ESP-005 escenario 2).
- **Rechazar transiciones inválidas** (p. ej. iniciar una completada → error claro; HU-ESP-003 escenario 2).
- Implementar como objeto que valida `puedeTransicionar(estadoActual, evento)` (SOLID; no `if` dispersos).

### 3. Validadores por origen (patrón Strategy — RF-029, RNF-014)
Crear interfaz `ValidadorCita` y dos implementaciones:
- **`ValidadorPublico`** (origen `agendamiento_publico`): exige **tiempo futuro**, franja **dentro de disponibilidad**, **franja libre**, y respeta **retención + `EXCLUDE`**. Aplica reglas de antelación del config.
- **`ValidadorInterno`** (origen `creacion_interna`): **relajado**. Admite **pasado** (registro retroactivo), **sin candado de concurrencia**, solo **chequeos de sanidad**: `fin ≥ inicio`, dentro del **período contable abierto** (si el módulo de cierre está activo), especialista y sucursal **válidos** (especialista asignado a esa sucursal).
- Seleccionar la estrategia por `origen`. Añadir un nuevo origen = nueva estrategia, sin tocar las existentes (Open-Closed).

### 4. Flujo de reserva pública (sin sesión) — secuencia del diagrama
Endpoints **públicos** (marcados `@Public()`, con **rate limiting** RNF-011) bajo `/api/public/...`, parametrizados por un **slug/identificador de sucursal o negocio**:
1. `GET /api/public/:slug/disponibilidad?especialista=&servicio=&fecha=` → franjas libres.
2. `POST /api/public/:slug/retener` → crea `retencion_franja` con TTL (`agendamiento.duracion_retencion_min`). Si choca con el `EXCLUDE`/otra retención → responde **"franja no disponible" + alternativas** (RF-020, HU-CLI-003 escenario 2). **No** crea cita aún.
3. `POST /api/public/:slug/otp/enviar` → genera OTP, lo guarda hasheado en `otp_codigo` con expiración, y **encola** el SMS (FASE-11). RF-021.
4. `POST /api/public/:slug/confirmar` → recibe `{ retencionId, telefono, codigoOtp, ... }`:
   - Verifica OTP (no consumido, no expirado, intentos < límite).
   - `get_or_create` cliente por teléfono (RF-034).
   - **Dentro de una transacción**: inserta la `cita`. El `EXCLUDE` de la BD es la garantía dura de no solape; si la inserción viola la exclusión → traducir a "franja tomada" + alternativas (RF-020).
   - Estado de entrada: si `aprobacion_manual=false` (default) → `confirmada` directo (RF-018, confirmación automática). Si `true` → `solicitada` (RF-019).
   - Marca `origen = agendamiento_publico`, guarda `precio_est` (estimación de los servicios elegidos).
   - Libera/expira la retención usada.
   - **Encola** confirmación + recordatorio (FASE-11, RF-047).
- **Idempotencia** (RNF-008): confirmar dos veces la misma retención no crea dos citas.

### 5. Cancelar/reagendar desde el enlace (RF-022, HU-CLI-006)
- `POST /api/public/:slug/cita/:id/cancelar` — aplica la **regla de antelación** del config; si está fuera de plazo, informa que no es posible por ese medio.
- Reagendar = cancelar + nueva reserva (o transición controlada) respetando concurrencia.

### 6. App del especialista / agenda interna
- `GET /api/citas?sucursalId=&rango=dia|semana` — agenda del especialista (sus turnos) o de la sucursal (recepción/admin), ordenada por hora, con cliente/servicio/estado (RF-023, RF-032, HU-ESP-001, HU-REC-003).
- **Recepción automática**: las reservas públicas ya aparecen sin aceptación manual (RF-024, HU-ESP-002).
- Transiciones del turno en vivo: `POST /api/citas/:id/iniciar`, `/completar` (guard de pago → FASE-09), `/cancelar`, `/no-asistio` (RF-025, HU-ESP-003/004/005).
- `PATCH /api/especialistas/:id/disponibilidad` y sucursal activa (RF-030, HU-ESP-008): marcarse ocupado retira franjas del enlace público.

### 7. Creación manual de turnos (walk-ins) — origen interno
- `POST /api/citas/walk-in` (admin/especialista/recepción):
  - **En vivo** (HU-ESP-006): crea con `origen=creacion_interna`, valida con `ValidadorInterno`, entra en `en_progreso`. Cliente opcional (permite sin teléfono/nombre pero lo sugiere).
  - **Retroactivo** (HU-ESP-007, RF-028): horas en el pasado, entra **directo en `completada`** con su cobro (dispara FASE-09); solo chequeos de sanidad; **sin** candado de concurrencia.
- Admin puede crear en cualquier sucursal eligiendo especialista **válido** de esa sede (HU-ADM-012).

### 8. Limpieza de retenciones expiradas
- Job/worker periódico que borra `retencion_franja` con `expira_en < now()` (ADR-005 menciona limpieza de franjas expiradas). Va en la cola/worker (FASE-11/14).

---

## ⚠️ ACCIÓN DEL USUARIO
- Las claves de Twilio para el envío real de OTP se piden en **FASE-11**. En esta fase, el OTP puede **mockearse en desarrollo** (loguear el código en consola en `NODE_ENV=development`) para no bloquear el flujo. Avisar al USUARIO que el SMS real llega en FASE-11.

---

## Verificación / Done (CRÍTICO)
- **Concurrencia (0 dobles reservas):** prueba que lanza N confirmaciones simultáneas sobre la **misma** franja → exactamente **una** cita creada; las demás reciben "franja tomada" + alternativas. El `EXCLUDE` debe ser quien lo garantice (probar incluso desactivando la retención).
- **Confirmación automática:** reserva pública con `aprobacion_manual=false` entra como `confirmada` sin intervención.
- **Aprobación manual ON:** la misma reserva entra como `solicitada`.
- **Validación por origen:** una reserva pública con hora pasada es **rechazada**; un walk-in retroactivo con hora pasada es **aceptado** como `completada`; un retroactivo con `fin < inicio` es **rechazado** (HU-ESP-007 escenario 2).
- **Máquina de estados:** transiciones inválidas (iniciar una completada, completar sin pago) son rechazadas.
- **OTP:** código incorrecto/expirado rechaza la reserva y permite reenviar (HU-CLI-004 escenario 2).
- **Rate limiting** activo en endpoints públicos.
- p95 de confirmación < 1.5 s (RNF-001) en condiciones normales.

## Trazabilidad
- ADR-005 completo, ADR-002 (banderas/reglas), ADR-003 (OTP), ADR-004 (transacción/exclusión). RF-015 a RF-032 (agendamiento), RF-034, RNF-001, RNF-008, RNF-011. HU-CLI-001..006, HU-ESP-001..008, HU-REC-001..003, HU-ADM-012.
