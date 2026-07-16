# _MAPA-PANTALLA-API · Prototipo → API real (FASE-00)

> Producido en FASE-00. **No se construye UI aquí.** Cada pantalla del prototipo se mapea a
> el/los endpoint(s) reales de `apps/api` que la alimentan, con su estado de cobertura:
>
> - ✅ **cubierta** — el endpoint existe y devuelve lo necesario.
> - 🟡 **parcial** — existe pero falta un campo, filtro o forma → ampliar (ver `_HUECOS-BACKEND.md`).
> - 🔴 **hueco** — no hay endpoint → crear (ver `_HUECOS-BACKEND.md`).
>
> La superficie de la API se verificó leyendo los controladores reales (junio 2026). Convención de
> rutas: el prefijo global es `/api` (cliente `lib/api.ts`). Aquí se omite el prefijo.

## Superficie de la API verificada (controladores reales)

| Módulo | Controlador | Rutas |
|---|---|---|
| auth | `auth.controller.ts` | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| config | `config.controller.ts` | `GET /config` · `PUT /config/reparticion/:nivel/:ambitoId` · `PUT /config/:nivel/:ambitoId/:clave` · `DELETE /config/:nivel/:ambitoId/:clave` · `POST /config/clonar` |
| negocios | `negocio.controller.ts` | `POST /negocios` · `PATCH /negocios/:id/perfil` |
| sucursales | `sucursal.controller.ts` | `GET /sucursales` · `POST /sucursales` · `PATCH /sucursales/:id` · `PATCH /sucursales/:id/estado` |
| equipo | `equipo.controller.ts` | `GET /especialistas` · `POST /especialistas` · `PATCH /especialistas/:id` · `PUT /especialistas/:id/sucursales` · `DELETE /especialistas/:id` · `POST /especialistas/:id/reactivar` |
| suscripción | `suscripcion.controller.ts` | `GET /suscripcion` · `PATCH /suscripcion/plan` |
| citas | `agendamiento.controller.ts` | `GET /citas?sucursalId&especialistaId&desde&hasta` · `POST /citas/:id/{aprobar,iniciar,completar,revertir,cancelar,no-asistio}` · `POST /citas/walk-in` · `POST /citas/walk-in/retroactivo` |
| público | `public-agendamiento.controller.ts` | `GET /public/:sucursalId/{info,especialistas,servicios,disponibilidad}` · `POST /public/:sucursalId/{retener,otp/enviar,confirmar}` · `POST /public/:sucursalId/cita/:id/cancelar` |
| clientes | `operacion.controllers.ts` | `GET /clientes` · `GET /clientes/:id/historial` · `POST /clientes` · `PATCH /clientes/:id` · `DELETE /clientes/:id` |
| servicios | `operacion.controllers.ts` | `GET /servicios` · `POST /servicios` · `PATCH /servicios/:id` · `DELETE /servicios/:id` |
| inventario | `operacion.controllers.ts` | `GET /inventario/productos?sucursalId` · `POST /inventario/productos` · `POST /inventario/movimientos` · `POST /inventario/ventas` · `GET /inventario/alertas?sucursalId` · `GET /inventario/valoracion?sucursalId` |
| gastos | `operacion.controllers.ts` | `GET /gastos?sucursalId` · `POST /gastos` · `DELETE /gastos/:id` |
| liquidaciones | `operacion.controllers.ts` | `POST /liquidaciones/generar` · `POST /liquidaciones/csv` |
| reportes | `operacion.controllers.ts` | `GET /reportes/financiero?desde&hasta&sucursalId` |
| cierres | `operacion.controllers.ts` | `GET /cierres` · `POST /cierres` |
| pagos/wompi | `pagos.controllers.ts` | `POST /pagos/wompi/webhook` |
| plataforma | `pagos.controllers.ts` | `GET /plataforma/suscripciones` · `POST /plataforma/negocios/:id/cobro` · `POST /plataforma/negocios/:id/suspender` · `POST /plataforma/negocios/:id/reactivar` |
| salud/métricas | `health.controller.ts`, `metrics.controller.ts` | `GET /health` · `GET /health/ready` · `GET /metrics` |

> **No existe controlador HTTP de notificaciones** (`notificaciones.module.ts` solo expone
> servicios internos: `NotificacionesService`, `JobQueue`, `CuposService`). La pantalla de
> Notificaciones de Config y la exposición de cupos de mensajería son **huecos**.

---

## FASE-01 · Design System (sin datos)
No consume API. Componentes primitivos. — **N/A**

## FASE-02 · Login / Shell / Navegación

| Pantalla (prototipo) | Endpoint(s) | Estado |
|---|---|---|
| Login (`login-app.jsx`) | `POST /auth/login` → tokens; `GET /auth/me` (rol→ruta) | ✅ |
| Sesión / refresh silencioso | `POST /auth/refresh`, `POST /auth/logout` | ✅ |
| Cuenta **suspendida** | `negocio.estadoSuscripcion='suspendida'` vía `GET /auth/me` o 4xx de login con motivo | 🟡 (confirmar que login/me señala el estado suspendido del negocio → FASE-02) |
| Cuenta **bloqueada** (rate-limit/credenciales) | respuesta 401/429 de `POST /auth/login` (Throttler activo) | ✅ |
| Selector sucursal / consolidado | `GET /sucursales` (alcance del usuario) | ✅ |

## FASE-03 · Reserva pública del cliente (móvil)

| Pantalla | Endpoint(s) | Estado |
|---|---|---|
| Inicio (info del negocio/sucursal) | `GET /public/:sucursalId/info` | ✅ |
| Servicios | `GET /public/:sucursalId/servicios` | ✅ |
| Especialista (incl. "cualquiera disponible") | `GET /public/:sucursalId/especialistas` | 🟡 listar ✅, pero **"any"** no soportado en disponibilidad (ver abajo) |
| Horario / slots AM-PM | `GET /public/:sucursalId/disponibilidad?especialista&servicio&fecha` | 🔴 **no acepta `especialista=any`** (el service hace `eq(especialistaId)`). Agregación sin especialista → FASE-03 |
| Identificación + OTP | `POST /public/:sucursalId/otp/enviar`, retención `POST /public/:sucursalId/retener` | ✅ |
| Confirmación | `POST /public/:sucursalId/confirmar` | ✅ |
| Gestión de la cita (cancelar) | `POST /public/:sucursalId/cita/:id/cancelar` | ✅ |
| Estado **conflicto** (franja tomada) | error de `retener`/`confirmar` (EXCLUDE) | ✅ (la UI debe manejar el 409) |

## FASE-04 · Onboarding del negocio

| Pantalla | Endpoint(s) | Estado |
|---|---|---|
| Vertical (barbería/salón) | `POST /negocios`, `PATCH /negocios/:id/perfil` | ✅ |
| Módulos / restricciones | `PUT /config/:nivel/:ambitoId/:clave` (flags de módulo) | ✅ |
| Equipo inicial | `POST /especialistas`, `PUT /especialistas/:id/sucursales` | ✅ |
| Listo (resumen) | `GET /config`, `GET /sucursales` | ✅ |

> Nota de alcance: el onboarding **autenticado** (negocio ya creado) está cubierto. El alta
> self-service desde el sitio público (signup + Wompi) es **solo visual** en v2 (FASE-12).

## FASE-05 · Admin · Panel y Agenda

| Pantalla | Endpoint(s) | Estado |
|---|---|---|
| Panel · KPIs (ingresos del día, citas, ticket promedio, **deltas** vs período previo) | `GET /reportes/financiero` | 🟡 da ingresos/gastos/ganancia/margen/salud, **falta** nº citas, ticket promedio y deltas → **endpoint resumen de dashboard** (FASE-05) |
| Panel · agenda del día | `GET /citas?desde&hasta` | ✅ |
| Panel · resumen financiero | `GET /reportes/financiero?desde&hasta` | ✅ |
| Agenda · mini-calendario / contadores / leyenda | `GET /citas?desde&hasta&sucursalId&especialistaId` | ✅ (agrupación por día/estado se deriva en el front) |
| Agenda · acciones de cita | `POST /citas/:id/{aprobar,iniciar,completar,cancelar,no-asistio,revertir}` | ✅ |
| Agenda · archivo por período | `GET /cierres` | ✅ |

## FASE-06 · Admin · Clientes (CRM)

| Pantalla | Endpoint(s) | Estado |
|---|---|---|
| Lista de clientes (tarjetas) | `GET /clientes` | ✅ |
| Historial del cliente | `GET /clientes/:id/historial` | ✅ |
| Alta / edición | `POST /clientes`, `PATCH /clientes/:id` | ✅ |
| Borrado (desactivar) | `DELETE /clientes/:id` | ✅ |

## FASE-07 · Admin · Gestión

| Pantalla | Endpoint(s) | Estado |
|---|---|---|
| Equipo (lista, alta, edición, estado, sucursales) | `GET/POST/PATCH /especialistas`, `PATCH /especialistas/:id` *(estado vía PATCH)*, `PUT /especialistas/:id/sucursales`, `DELETE`, `POST /:id/reactivar` | ✅ |
| Equipo · liquidación | `POST /liquidaciones/generar`, `POST /liquidaciones/csv` | ✅ |
| Servicios (lista, alta, edición, borrado) | `GET/POST/PATCH/DELETE /servicios` | ✅ |
| Servicios · editor de repartición (split) | `PUT /config/reparticion/:nivel/:ambitoId` + `splitType`/`splitValor` en `servicio` | ✅ |
| Inventario (productos, stock) | `GET /inventario/productos`, `POST /inventario/productos` | ✅ |
| Inventario · movimientos | `POST /inventario/movimientos` | ✅ |
| Inventario · alertas stock bajo / valoración | `GET /inventario/alertas`, `GET /inventario/valoracion` | ✅ |

## FASE-08 · Admin · Finanzas

| Pantalla | Endpoint(s) | Estado |
|---|---|---|
| Quincenal (liquidación por período) | `POST /liquidaciones/generar`, `GET /cierres` | ✅ |
| Reportes (financiero) | `GET /reportes/financiero?desde&hasta&sucursalId` | ✅ |
| Análisis (series/gráficas recharts) | `GET /reportes/financiero` (varias llamadas por período) | 🟡 hoy hay que llamar N veces por período; un endpoint de **serie temporal** simplificaría → opcional FASE-08 |
| Registrar venta de producto | `POST /inventario/ventas` | ✅ |
| Registrar gasto | `POST /gastos`, `GET /gastos`, `DELETE /gastos/:id` | ✅ |
| Cierre de período | `POST /cierres`, `GET /cierres` | ✅ |

## FASE-09 · Admin · Configuración

| Pantalla | Endpoint(s) | Estado |
|---|---|---|
| Módulos | `GET /config`, `PUT/DELETE /config/:nivel/:ambitoId/:clave` | ✅ |
| Agenda (horarios/reglas) | `GET /config`, `PUT /config/...` | ✅ (la disponibilidad por especialista se modela en `disponibilidad`; ver hueco si se edita por UI) |
| **Notificaciones** (plantillas, canales, **cupos**) | — | 🔴 **no hay controlador**; `CuposService` y `NotificacionesService` son internos → exponer config + consumo de cupos (FASE-09) |
| Sucursales | `GET/POST/PATCH /sucursales`, `PATCH /sucursales/:id/estado` | ✅ |
| Usuarios (internos) | `POST /negocios` crea admin; alta/edición de **usuarios internos** (recepción/especialista con login) | 🟡 hay `equipo` (especialistas) pero **no CRUD de `usuario`** genérico por rol → confirmar/crear (FASE-09) |
| Financieros (parámetros) | `GET /config`, `PUT /config/...` | ✅ |
| Suscripción (plan, nº especialistas, cupos) | `GET /suscripcion`, `PATCH /suscripcion/plan` | 🟡 plan/nº ✅; **cupos de mensajería** del plan no expuestos → ligado al hueco de notificaciones |
| Developer (info técnica) | `GET /health`, `GET /metrics` | ✅ |

## FASE-10 · App del Especialista (responsive)

| Pantalla | Endpoint(s) | Estado |
|---|---|---|
| Mi día | `GET /citas?especialistaId&desde&hasta` | ✅ |
| Agenda (día/semana) | `GET /citas?desde&hasta` (rango soportado) | ✅ agrupación semana en el front |
| Detalle de turno | `GET /citas` (item) + acciones de estado | ✅ |
| Cobro (completar atención) | `POST /citas/:id/completar` | ✅ |
| Walk-in | `POST /citas/walk-in`, `POST /citas/walk-in/retroactivo` | ✅ |
| **Ganancias** (hoy/semana/mes por especialista) | — | 🔴 **no hay endpoint de resumen por especialista**; derivar de `liquidaciones`/`reportes` o crear `GET /especialistas/:id/ganancias` (FASE-10) |
| Perfil | `GET /auth/me`, `PATCH /especialistas/:id` | ✅ |

## FASE-11 · Recepción

| Pantalla | Endpoint(s) | Estado |
|---|---|---|
| Tablero por especialista | `GET /citas?sucursalId&desde&hasta` | ✅ |
| **Reasignar cita** (cambiar especialista) | — | 🔴 **no hay transición/endpoint de reasignación** → crear (editar cita o `POST /citas/:id/reasignar`) (FASE-11) |
| Walk-in | `POST /citas/walk-in` | ✅ |
| Cobro | `POST /citas/:id/completar` | ✅ |
| Resumen diario | `GET /reportes/financiero?desde=hoy&hasta=hoy` | ✅ |

## FASE-12 · Sitio web y alta (SOLO VISUAL en v2)

| Pantalla | Endpoint(s) | Estado |
|---|---|---|
| Landing / Precios / Comparativa / Calculadora | — | N/A (estático; precios desde registry de planes en front) |
| Alta (signup) | (diferido) `POST /negocios` existe pero **no se cablea** en v2 | 🟡 maqueta sin funcionalidad (decisión de alcance #1) |
| Checkout Wompi | `POST /pagos/wompi/webhook` (server-side); creación de transacción | 🔴/diferido — no se cablea en v2 (Wompi diferido) |
| Bienvenida / Soporte | — | N/A (estático) |

## FASE-13 · Panel de plataforma (operador)

| Pantalla | Endpoint(s) | Estado |
|---|---|---|
| Tenants / suscripciones | `GET /plataforma/suscripciones` | ✅ |
| Generar cobro | `POST /plataforma/negocios/:id/cobro` | ✅ |
| Suspender / reactivar tenant | `POST /plataforma/negocios/:id/{suspender,reactivar}` | ✅ |

## FASE-14 · QA / deploy
No consume pantallas nuevas. `GET /health`, `GET /health/ready`, `GET /metrics`. — ✅

---

## Resumen de huecos detectados (detalle en `_HUECOS-BACKEND.md`)

| # | Hueco | Fase | Migración |
|---|---|---|---|
| H1 | Disponibilidad pública con `especialista=any` (agregación sin especialista) | 03 | No |
| H2 | Resumen/KPIs de dashboard admin (nº citas, ticket promedio, deltas) | 05 | No |
| H3 | Endpoint de ganancias por especialista (hoy/semana/mes) | 10 | No (deriva) |
| H4 | Reasignar especialista de una cita | 11 | Posible (estado/auditoría) |
| H5 | Controlador de Notificaciones + exposición de cupos de mensajería | 09 | No (tablas ya existen) |
| H6 | CRUD de usuarios internos por rol (recepción/especialista con login) | 09 | No |
| H7 | (Opcional) Serie temporal para gráficas de Análisis | 08 | No |
| H8 | (Diferido) Alta self-service + creación de transacción Wompi | 12 | No (v2 solo visual) |
</content>
</invoke>
