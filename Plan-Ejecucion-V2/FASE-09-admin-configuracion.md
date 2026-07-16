# FASE-09 · Admin · Configuración

## Objetivo
Construir la sección **Configuración** del panel admin tal como el prototipo, con todas sus sub-secciones: **Módulos**, **Agenda**, **Notificaciones**, **Sucursales**, **Usuarios**, **Financieros**, **Suscripción** y **Developer/Cuenta**. Conectada al sistema de configurabilidad en cascada (`sistema→negocio→sucursal`), mostrando **procedencia** (heredado/sobrescrito) y permitiendo clonar config entre sucursales.

## Prerrequisitos
- FASE-01, FASE-02 cerradas.
- Entender el `ConfigResolver` y el registry de claves del backend (FASE-06 v1).

## Fuente visual (prototipo)
- `admin-screens-config.jsx` (`ScreenConfig`, `ConfigModulos`, `ConfigAgenda`, `ConfigNotif`).
- `admin-screens-config-org.jsx` (`ConfigSucursales`, `ConfigUsuarios`).
- `admin-screens-config-finanzas.jsx` (`ConfigFinancieros`, `PctInput`).
- `admin-screens-config-cuenta.jsx` (`ScreenSuscripcion`, `ScreenDeveloper`, `DangerConfirm`).
- `admin-config-ui.jsx`, `admin-data-config.js` (referencia).

## Pasos de Claude

### 1. Contenedor de Configuración
- `pages/admin/ConfigScreen.tsx`: navegación lateral/segmentada entre las sub-secciones. Cada valor muestra su **procedencia** (badge "heredado" vs. "sobrescrito") devuelta por el `ConfigResolver`. Ámbito editable: negocio o sucursal seleccionada.

### 2. Módulos
- `ConfigModulos`: toggles de módulos on/off (inventario, partición, cierre, notificaciones, etc.) con `Switch`. `GET /config` + `PUT /config/:nivel/:ambitoId/:clave` / `DELETE` (para volver a heredado). Cambiar un módulo refleja al instante en la navegación (ocultar/mostrar secciones).

### 3. Agenda
- `ConfigAgenda`: parámetros de agenda (horarios de atención, antelación mínima, duración de retención/TTL, aprobación automática vs. manual, walk-ins). Escribe vía config.

### 4. Notificaciones
- `ConfigNotif`: plantillas/canales (SMS/email), recordatorios, y **cupos de mensajería** del plan (mostrar consumo/restante — ver `[[modelo-cobro-suscripcion]]`). Datos de config + suscripción.

### 5. Sucursales
- `ConfigSucursales`: CRUD de sucursales (`GET/POST/PATCH/DELETE /sucursales`, `POST /:id/reactivar`), activar/desactivar, y **clonar configuración** desde otra sucursal (`POST /config/clonar`).

### 6. Usuarios
- `ConfigUsuarios`: gestión de usuarios internos y roles (admin/recepcionista/especialista). Alta/edición/estado. (Reusa equipo donde aplique; usuarios = cuentas con rol.)

### 7. Financieros
- `ConfigFinancieros` + `PctInput`: parámetros financieros (repartición por defecto, comisiones, impuestos, métodos de pago habilitados). `PUT /config/reparticion/:nivel/:ambitoId` y claves financieras. Validación 0–100 y suma 100%.

### 8. Suscripción
- `ScreenSuscripcion`: plan actual, nº de especialistas, cupos de mensajería, estado (`EstadoSuscripcion`), próximo cobro. `GET /suscripcion`, `PATCH /suscripcion/plan`. Mostrar el modelo de cobro **plan + nº especialistas + cupos** (NO por sucursal — `[[modelo-cobro-suscripcion]]`, ADR-009). El cambio de plan (`PATCH /suscripcion/plan`) puede operar, pero el **enlace a checkout/pago Wompi queda como maqueta** en v2 (FASE-12 solo visual); marcar con `TODO(v-next)` el flujo de cobro real.

### 9. Developer / Cuenta
- `ScreenDeveloper`: datos técnicos de la cuenta, y **acciones peligrosas** (`DangerConfirm`): cerrar/suspender cuenta, borrar datos, etc., con confirmación destructiva.

### 10. Datos
- Hook `useConfig` que resuelve valores con su procedencia y maneja override/reset (`PUT`/`DELETE`). Caché + invalidación al guardar.

## Backend: huecos a cubrir
- Confirmar que `GET /config` devuelve **procedencia** (heredado/sobrescrito + valor efectivo) por clave; si no, ampliar la respuesta del `ConfigResolver`.
- Confirmar exposición de **cupos de mensajería** (consumo/restante) para la sub-sección Notificaciones/Suscripción.
- Confirmar endpoints de **usuarios internos** (alta/rol/estado) separados de especialistas si el prototipo los trata distinto.

## ⚠️ ACCIÓN DEL USUARIO
- Confirmar qué claves de config son editables por el admin vs. solo-lectura (gobernadas por plan).

## Verificación / Done
- Todas las sub-secciones existen y se ven como el prototipo.
- Cada valor muestra procedencia; override y "volver a heredado" funcionan; clonar entre sucursales opera.
- Cambiar un módulo reconfigura la navegación al instante.
- Suscripción muestra el modelo de cobro correcto (plan + especialistas + cupos); acciones peligrosas piden confirmación.

## Trazabilidad
- RF-008..RF-012 (configurabilidad, módulos, herencia, clonado), ADR-002 (cascada de config), ADR-009 (modelo de cobro/plan), RNF-005.
