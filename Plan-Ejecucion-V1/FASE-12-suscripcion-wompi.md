# FASE-12 · Suscripción y pasarela de pagos (Wompi)

## Objetivo
Conectar el **cobro de la suscripción del negocio** (no de las citas) con **Wompi**, calculando el monto **por número de sucursales activas**, y dar al **operador de plataforma** las herramientas para **suspender/reactivar** cuentas según el estado de pago, conservando los datos. (Pagos del servicio al cliente final están **fuera de alcance v1**.)

## Prerrequisitos
- FASE-07 (conteo de sucursales activas + estado de suscripción).
- FASE-05 (rol `operador_plataforma`).

---

## Pasos de Claude

### 1. Módulo `suscripcion` / facturación
- Servicio que, dado un negocio, calcula el **cargo** = f(nº sucursales activas, plan) (RF-006). Definir el/los planes (al menos uno) y el precio por sucursal.
- Registrar el ciclo de cobro (mensual) y el estado de pago.

### 2. Integración Wompi (sandbox primero)
- Cliente de Wompi en `apps/api/src/pagos/wompi.client.ts` usando `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_ENV=sandbox`.
- Generar el **link/checkout de pago** o el cobro recurrente para la suscripción del negocio (según lo que Wompi soporte: usar checkout web o transacciones; documentar el método elegido).
- Soportar medios colombianos (PSE, tarjeta, Nequi) que ofrezca Wompi.

### 3. Webhook de eventos de Wompi (RNF-012)
- `POST /api/pagos/wompi/webhook` (`@Public()`): recibe eventos de transacción.
- **Verificar la firma** del evento con `WOMPI_EVENTS_SECRET` antes de procesar (no confiar en payload sin validar).
- Al confirmar pago: marcar la suscripción como al día / `negocio.estado_suscripcion = 'activa'`.
- Al fallar/vencer: marcar para suspensión (o suspender según política).

### 4. Operador de plataforma (HU-PLT-001, HU-PLT-002)
- Endpoints solo para rol `operador_plataforma`:
  - Ver suscripciones y nº de sucursales activas por negocio; ajustar cobro al alta/baja de sucursales (RF-006).
  - `POST /api/plataforma/negocios/:id/suspender` → `estado_suscripcion='suspendida'`. Los usuarios ven aviso de cuenta suspendida al iniciar sesión (guard de FASE-05) **pero los datos se conservan íntegros** (RF-007).
  - `POST /api/plataforma/negocios/:id/reactivar` → `estado_suscripcion='activa'`, acceso completo restaurado.

### 5. Aislamiento del rol plataforma
- El operador de plataforma es **transversal** (no pertenece a un solo negocio): sus endpoints operan a nivel plataforma, con su propio guard. Cuidar que esto **no** rompa el aislamiento de los datos operativos de los negocios (solo gestiona suscripción/estado, no entra a los datos internos de cada salón).

---

## ⚠️ ACCIÓN DEL USUARIO
- Entregar las **claves de Wompi sandbox** y pegarlas en `apps/api/.env`:
  - `WOMPI_PUBLIC_KEY=pub_test_...`
  - `WOMPI_PRIVATE_KEY=prv_test_...`
  - `WOMPI_EVENTS_SECRET=...` (secreto de eventos/integridad)
  - `WOMPI_ENV=sandbox`
- En el panel de Wompi, **configurar la URL del webhook** apuntando al endpoint público (en dev, exponer con un túnel tipo ngrok; el USUARIO crea el túnel y pega la URL en Wompi).
- Para **producción** (FASE-14): cambiar a llaves `prod` y `WOMPI_ENV=production` SOLO cuando el negocio esté listo para cobrar de verdad. No usar llaves de producción en pruebas.

> Claude NO inventa claves Wompi. Sin ellas, deja el flujo conectado pero inactivo y lo anota en `CREDENCIALES-PENDIENTES.md`.

---

## Verificación / Done
- En sandbox, un pago de prueba dispara el webhook, la firma se valida y la suscripción queda al día.
- Suspender un negocio bloquea el acceso de sus usuarios (aviso claro) pero **conserva** todos sus datos; reactivar restaura el acceso intacto.
- Alta/baja de sucursal ajusta el cobro al nuevo nº de sucursales activas.
- El operador de plataforma no puede ver datos operativos internos de los negocios (solo suscripción/estado).
- Pruebas: verificación de firma del webhook, suspensión/reactivación no destructiva, recálculo por sucursales.

## Trazabilidad
- RF-006, RF-007, RNF-012. HU-PLT-001, HU-PLT-002. ADR-001 (aislamiento), decisión de pasarela (Wompi). Definición §5 (pago del servicio fuera de alcance; Orkalis cobra la suscripción).
