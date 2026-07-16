# Plan de pruebas profundas — Suscripción · Pagos · Límites

> Objetivo: dejar la funcionalidad más sensible (cobro, acceso, límites) **sin el
> menor bug**, probada de punta a punta y al detalle. Cada bloque se ejecuta,
> se anotan hallazgos y **se corrige en el momento**; al final, gate verde.

## Método
- **Capas**: unitario (lógica pura) → integración (servicios + DB + mock MP) → E2E (UI Playwright) → smoke en vivo (API real + sandbox MP).
- **Mock MP determinista**: doble del `MercadoPagoClient` que aprueba/rechaza por nombre del titular (`APRO`/`OTHE`/`FUND`), reutilizable.
- **Reloj inyectable** (`ejecutarCiclo(ahora)`) para "viajar en el tiempo".
- Regla: **un hallazgo = se corrige + se añade test de regresión** antes de avanzar.

## Bloques (checklist)

### B0 · Auditoría y utilidades de prueba
- [ ] Mapa cobertura actual vs superficie; identificar huecos.
- [ ] Mock MP por titular + fixtures de estado (poner cuenta en activa/gracia/…); reloj.

### B1 · Cálculos de facturación (unitario, exhaustivo)
- [ ] `calcularCargo`: 4 planes × {0, incluidos−1, incluidos, +1, grande}. Empresarial (incluidos=15).
- [ ] `cupoEspecialistas` = max(pagados, incluidos); `puedeAgregarEspecialista`.
- [ ] `cuposMensajeria`: base + extra por especialista (email no escala).
- [ ] `maxSucursales`/`permiteSucursales` (incl. Empresarial = Infinity).
- [ ] `moduloPermitido`/`modulosPermitidos` por plan; operativos siempre.
- [ ] **Proración** (la zona de mayor riesgo de dinero): días restantes {0, 1, mitad, todos}; `proximoCobro` nulo, pasado, hoy; cruces de mes (28/29/30/31), febrero/bisiesto; redondeo COP; diferencia ≤ diferencia mensual; nunca negativa.

### B2 · Máquina de estados y acceso (unitario)
- [ ] `transicionar`: todas las válidas + inválidas (ya exhaustivo; revisar gaps).
- [ ] `tieneAcceso`; `evaluarAcceso`/corte en caliente de prueba vencida (idempotente ante carrera).

### B3 · Pagos y cobro (integración, mock MP)
- [ ] `registrarMetodo`; `pagar` (aprobado→activa+aniversario, rechazado→falla+mensaje, idempotente por período).
- [ ] Cron `ejecutarCiclo`: cobro activa vencida → +1 mes anclado; cortesía/suspendida/prueba excluidas; idempotente; gracia (reintento ok/falla), corte ≥7d → suspendida, reactivación.
- [ ] `previewCambio`/`cambiar`: upgrade (con/sin tarjeta, prorrateo, no mueve fecha), downgrade/lateral (aplica sin cobro), prueba/cortesía (sin cobro), validaciones (sucursales, cupo≥activos), tarjeta rechazada no aplica.
- [ ] Webhook: firma válida/inválida, idempotencia (referencia/mp_payment_id), `external_reference`.

### B4 · Límites por plan (integración)
- [ ] `ModuloGate` config ∧ plan (403 claro si el plan no lo incluye).
- [ ] Cupo especialistas: crear hasta cupo, +1 → 403; baja libera; subir cupo habilita.
- [ ] Sucursales por plan (crear 2ª en Básico → 400; Premium permite 2 no 3).
- [ ] Cambio de plan reajusta límites de inmediato.

### B5 · Control de acceso / sesión limitada (integración)
- [ ] Matriz **estado × endpoint × rol**: bloqueado da 403 `SUSCRIPCION_BLOQUEADA` salvo `@AccesoFacturacion`.
- [ ] Operador nunca bloqueado; login/refresh emiten token a cuenta bloqueada.
- [ ] `GET /suscripcion` expone método, próximo cobro, historial, bloqueo, catálogo.

### B6 · Operador (integración)
- [ ] Cortesía (sin cobro, fuera del cron) / quitar; suspender/reactivar desde cualquier estado; transición inválida → 400.

### B7 · E2E frontend (Playwright)
- [ ] `SuscripcionScreen`: comparación de planes, cambio con preview (subida/bajada/lateral), banners (prueba/gracia), facturación + historial.
- [ ] `RecuperarAcceso` (prueba vencida / suspendida → pagar).
- [ ] Consola operador (cortesía, suspender/reactivar, detalle).
- [ ] `ConfigScreen` candados de módulo (avanzados gateados, operativos no).

### B8 · Smoke en vivo (API + sandbox MP)
- [ ] Flujos clave contra `:3000` con credenciales de prueba reales.

### B9 · Cierre
- [ ] Gate completo verde (Jest + tsc + lint + Playwright Pagos). Hallazgos documentados.

## Registro de hallazgos / progreso

**B1 · Facturación (unitario) — ✅**
- Mejora: proración extraída a función **pura y determinista** `pagos/prorrateo.ts` (recibe `ahora`) + **15 tests exhaustivos** (bordes de ciclo 0/1/mitad/todos, cruce de mes, febrero, **año bisiesto**, redondeo COP, sin ciclo, cobro vencido, invariante "nunca > diferencia mensual", monotonía).
- `plan.service.spec` profundizado: validación de `catalogo()` + **matriz cruzada** `calcularCargo` vs fórmula del catálogo (4 planes × 8 conteos) + monotonía del cargo.

**B2 · Máquina de estados — ✅** (ya exhaustivo: todas las transiciones válidas + inválidas + `tieneAcceso`).

**B3 · Pagos y cambio (integración) — ✅**
- **Seguridad de dinero (BLINDADO)**: una **subida con tarjeta RECHAZADA lanza y NO aplica el plan** (deja el cobro fallido).
- `en_gracia` se trata como activa (subida cobra prorrateo); **cambio lateral** aplica sin cobro.
- **Webhook re-entregado** (MP reenvía) es **idempotente**: no duplica ni recambia.

**B5 · Control de acceso / sesión limitada (integración) — ✅**
- Matriz: bloqueada → **pagar/metodo-pago alcanzables** (400, no 403) pero **cambiar plan 403**; endpoint normal 403; `GET /suscripcion` accesible.
- `en_gracia` y `cortesía` **entran al panel** con normalidad (me 200, especialistas 200).

**B7 · E2E frontend — ✅**
- **BUG UX corregido**: en `SuscripcionScreen`, una **subida sin cobro** (cuenta en prueba/cortesía) mostraba el mensaje de "lateral" ("manteniendo tu cargo") aunque el cargo sube. Añadidos casos explícitos (cortesía + subida-sin-cobro).
- E2E `15-suscripcion/cambio-plan`: comparación de planes, **subida en cortesía** (preview → confirmar, sin brick), y **negativo** (bajar con 2 sucursales → error claro, no aplica).

**B4/B6** cubiertos por `negocio.e2e` (cupo/sucursales/módulos), `operacion.spec` (ModuloGate) y `pagos.spec` (operador/cortesía).

**B8 · Smoke en vivo — ✅** ciclo registro→resumen→catálogo→preview→cambio verificado contra `:3000`.

**Estado del gate**: API **194/194** verde, tsc+lint limpios, E2E de Pagos verde.
