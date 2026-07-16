# FASE-03 · Reserva pública del cliente (end-to-end y funcional)

## Objetivo
Reconstruir el **enlace público de reservas** para que sea un calco del prototipo y **funcione de verdad** contra la API pública (hoy está roto). Flujo completo, móvil-first, sin login: **Inicio → Servicios → Especialista → Horario → Identificación+OTP → Confirmación → Gestión de la cita**, con manejo de concurrencia ("franja ya tomada") y todos los estados (datos/cargando/vacío/error/conflicto). Esta es la **prioridad declarada por el USUARIO**.

## Prerrequisitos
- FASE-01 (primitivos) y FASE-02 (contenedor móvil + rutas públicas) cerradas.

## Fuente visual (prototipo)
- `app.jsx` (orquestador: máquina de pasos, resumen calculado, manejo de conflicto, reagendar/cancelar).
- `screens-flow-a.jsx` (Inicio, Servicios con chips de categoría, Especialista con "Cualquiera disponible").
- `screens-flow-b.jsx` (Horario: tira de días, slots AM/PM, gris=ocupado; Identificación + OTP de 4 dígitos con reenvío).
- `screens-flow-c.jsx` (Confirmación: review→result, código de cita; Gestión: reagendar/cancelar).
- `screens-common.jsx` (`AppHeader`, `ProgressBar`, `ScrollArea`, `FooterBar`, `PriceCta`, `EmptyState`, `ErrorState`, `LoadingList`).

## Pasos de Claude

> **Regla:** el prototipo simula datos con `OrkData`/`data.js` y guarda la reserva en `localStorage` (`orkalis_public_booking`). En la v2 **todo** sale de la API pública real; se elimina el mock y el puente por `localStorage`.

### 1. Orquestador y rutas
- `pages/public/BookingPage.tsx` (reescribir): máquina de pasos `inicio | servicios | especialista | horario | identificacion | confirmacion | gestion` (como `app.jsx`). Ruta `/reservar/:sucursalId`. Sin token (`auth=false` en `lib/api`).
- Estado del flujo: `services[]`, `specialistId` (incluye `"any"` = cualquiera disponible), `date`, `time`, `contact{name,phone}`, `retencionId`, `appointment`. **Resumen** calculado (servicios elegidos, total COP, duración total, nombre del especialista, etiqueta de fecha es-CO, hora).

### 2. Inicio
- `GET /public/:sucursalId/info`: nombre/branding del negocio, vertical (barbería/salón), y si es multi-sede mostrar selector de sucursal. CTA "Reservar" y "Gestionar mi cita".

### 3. Servicios
- `GET /public/:sucursalId/servicios`: lista con **chips de categoría**, precio COP y duración. Selección múltiple (toggle). Footer `PriceCta` con total acumulado. Estados: cargando (skeleton grid), vacío, error.

### 4. Especialista
- `GET /public/:sucursalId/especialistas`: tarjetas con avatar/nombre/rol, opción **"Cualquiera disponible"** (`any`). Radio selection. Continuar habilita Horario.

### 5. Horario (el punto donde más falla hoy)
- **Tira de días** horizontal (hoy + próximos), días cerrados deshabilitados.
- `GET /public/:sucursalId/disponibilidad?fecha&especialistaId&servicioIds`: devuelve franjas libres. Agrupar en **Mañana (<13h)** y **Tarde (≥13h)**; franjas ocupadas en gris/tachadas. Si `specialistId === "any"`, la disponibilidad agrega sobre todos los especialistas.
- Estados: cargando (skeleton de 9 slots), **vacío** ("No quedan horas libres este día" + "Ver otro día"), error (reintento). Footer CTA "Continuar · HH:MM".

### 6. Identificación + OTP
- Datos: nombre + teléfono (validación de dígitos CO). `POST /public/:sucursalId/retener` para **retener la franja con TTL** justo antes de pedir OTP (evita que se la quiten mientras confirma) → guardar `retencionId`.
- `POST /public/:sucursalId/otp/enviar` (SMS, Twilio). Pantalla OTP de **4 dígitos** con auto-avance entre casillas, **reenvío con cuenta atrás**, y error de código inválido (como el prototipo). El backend valida el OTP en el paso de confirmar.

### 7. Confirmación
- Fase **review**: muestra el resumen completo (servicios, especialista, fecha/hora, total, contacto) y botón confirmar.
- `POST /public/:sucursalId/confirmar` (con retención + OTP + datos). Según config del negocio, la cita entra **Confirmada** (auto) o **Solicitada** (aprobación manual) — reflejar el estado devuelto, no asumir.
- **Manejo de conflicto:** si el backend responde que la franja ya fue tomada (concurrencia / retención expirada), mostrar toast "Esa hora la acaban de reservar. Elige otra." y devolver al paso **Horario** (como `onConfirm` del prototipo). **Sin doble reserva** (RF-020).
- Fase **result**: pantalla de éxito con el **código de cita** real (lo da el backend), estado, y accesos a "Gestionar" / "Nueva reserva".

### 8. Gestión de la cita
- Permitir recuperar/gestionar una cita existente (por código + teléfono o el id devuelto). **Reagendar** (vuelve a Horario, mantiene servicios) y **Cancelar** vía `POST /public/:sucursalId/cita/:id/cancelar`, respetando reglas de antelación (RF-022). Estados vacío (sin cita) y confirmaciones por toast.

### 9. Limpieza
- Eliminar cualquier dependencia de `OrkData`/`data.js`/`localStorage` para datos de dominio. Tipos desde `@orkalis/shared` (añadir DTOs públicos si faltan).

## Backend: huecos a cubrir
- Confirmar que `disponibilidad` acepta **`servicioIds`** (para calcular duración total) y **`especialistaId=any`** (agregación). Si no, ampliar el endpoint (query params + lógica de agregación) — respetando la estrategia de validación por origen `agendamiento_publico` (ADR-005).
- Confirmar que `confirmar` consume la **retención** y devuelve **código + estado** de la cita; si el código no se expone, añadirlo al DTO.
- Confirmar respuesta de **conflicto** distinguible (HTTP 409 o flag) para que el front vuelva a Horario. Si no, normalizarla.
- Endpoint para **recuperar cita por código** en Gestión, si no existe.

## ⚠️ ACCIÓN DEL USUARIO
- Confirmar que **Twilio** (OTP SMS) está operativo en el entorno de prueba (claves de FASE-11 v1). Si está en modo trial, indicar a qué número se puede enviar.
- Indicar un `sucursalId` real de prueba con servicios/especialistas/disponibilidad sembrados.

## Verificación / Done
- Flujo completo end-to-end contra la API: info → servicios → especialista → disponibilidad real → retención → OTP por SMS → confirmar → código real → gestión.
- "Cualquiera disponible" devuelve disponibilidad agregada y reserva correctamente.
- Caso de **concurrencia**: dos confirmaciones simultáneas sobre la misma franja → solo una gana; la otra ve el toast y vuelve a Horario; **sin doble reserva**.
- Cancelar/reagendar funcionan y respetan la antelación.
- Todos los estados (datos/cargando/vacío/error/conflicto) presentes y fieles al prototipo; móvil con safe-area.
- Cero `localStorage`/mock de dominio; cero `fetch` suelto.

## Trazabilidad
- RF-015..RF-024 (agendamiento público, OTP, disponibilidad, retención, gestión), RF-020 (no doble reserva), RF-022 (cancelar/reagendar con antelación), ADR-005 (máquina de estados, `EXCLUDE`, retención TTL, validación por origen), ADR-007 (SMS/OTP), RNF-003 (móvil/safe-area), RNF-005 (fiel al prototipo).
