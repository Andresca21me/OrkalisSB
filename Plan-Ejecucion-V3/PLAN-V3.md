# PLAN-V3 · Índice maestro de pruebas E2E de Orkalis (v3 — Verificación funcional extremo a extremo)

> **Para quién es este documento.** Para una IA que escribe pruebas (en adelante "Claude ejecutor") y para el dueño del producto ("EL USUARIO"). La **v1** entregó el backend completo; la **v2** dejó el frontend fiel al prototipo y conectado al backend real, con una primera tanda de E2E por rol (FASE-14). La **v3 tiene como objetivo principal: probar** — escribir **pruebas extremo a extremo, profundas y detalladas, desde el frontend**, de **cada funcionalidad** y de **cada flujo exacto entre pantallas y entre roles** (por ejemplo: que una reserva del cliente se refleje correctamente en las vistas del especialista, del administrador y del recepcionista). No se construye funcionalidad nueva ni se rediseña nada. **Política de la v3: corrección sobre la marcha (fix-forward).** Cuando una prueba revela un **defecto**, se **corrige el código real en la misma sesión**, se documenta el hallazgo y su fix en `_MATRIZ-TRAZABILIDAD`, y la prueba debe quedar **en verde**. Lo que **nunca** se hace es ablandar la prueba para que pase: la prueba es el juez y el código se ajusta a ella, no al revés.

---

## 0. Cómo usar este plan (LEER SIEMPRE PRIMERO)

1. El trabajo está partido en **fases** (`FASE-00` … `FASE-14`). Cada fase vive en su propio `.md` dentro de esta carpeta y cubre un grupo coherente de funcionalidades/flujos.
2. **Una sesión de Claude = una fase** (o parte). Al empezar, abre **solo**: este `PLAN-V3.md`, los tres documentos de apoyo (`_ESTRATEGIA-Y-CONVENCIONES`, `_DATOS-Y-CREDENCIALES`, `_MATRIZ-TRAZABILIDAD`) y el archivo de la fase. Abre el código de `apps/web/src/pages/...` de la pantalla bajo prueba **solo si necesitas el selector exacto**.
3. Cada archivo de fase tiene SIEMPRE esta estructura fija:
   - **Objetivo** — qué funcionalidades/flujos quedan cubiertos por pruebas.
   - **Prerrequisitos** — qué fases y qué estado del entorno (seed, servicios) deben estar listos.
   - **Pantallas / rutas bajo prueba** — qué vistas toca, por ruta y archivo.
   - **Casos de prueba** — lista numerada en Gherkin (Dado/Cuando/Entonces), incluyendo **aserciones cruzadas entre pantallas/roles** y los caminos de error/borde.
   - **Datos de prueba** — qué del seed se usa, qué se crea y cómo se aísla/limpia.
   - **Huecos de testabilidad** — `data-testid`, endpoints de apoyo o utilidades que falten para una prueba estable (con su propuesta mínima).
   - **Verificación / Done** — checklist para dar la fase por cerrada.
   - **Trazabilidad** — HU/RF/ADR que la fase verifica.
4. **No avances de fase** hasta que la suite de esa fase pase en verde de forma **estable** (sin flakes). Bajo fix-forward, eso implica que **los defectos detectados ya quedaron corregidos** y registrados en `_MATRIZ-TRAZABILIDAD §3`. La única excepción para cerrar una fase con un caso no-verde es un defecto **escalado al USUARIO** por requerir un cambio mayor (feature/rediseño/migración): se deja como `test.fixme` con su hallazgo. "Probado" es literal: el caso corre contra la **API real** con datos del seed y afirma sobre la **UI real**.
5. Marca el progreso en la tabla de la sección 6 (⬜ → ✅) al terminar cada fase.

---

## 1. Qué cambia respecto a la v2

| | v2 | v3 |
|---|---|---|
| Objetivo | Construir el frontend fiel al prototipo y cablearlo | **Probar** que todo funciona extremo a extremo |
| Entregable | Pantallas y endpoints | **Specs de Playwright** (`apps/web/e2e/`) + hallazgos |
| Código de producción | Se escribe (features) | **No se escriben features nuevas**, pero **sí se corrigen defectos** que las pruebas revelen (fix-forward), además de añadir `data-testid`/utilidades de prueba |
| Cobertura E2E | 3 specs base (auth, booking, isolation — FASE-14) | **Suite completa por funcionalidad y por flujo entre pantallas** |

La v3 **reutiliza y expande** el harness de Playwright montado en `apps/web` (FASE-14): `playwright.config.ts`, `apps/web/e2e/helpers.ts`, los specs `auth/booking/isolation`. Estos se refactorizan dentro de la nueva estructura de carpetas (ver `_ESTRATEGIA-Y-CONVENCIONES`).

---

## 2. Principios de prueba (reglas de oro de la v3)

- **Desde el frontend, siempre.** El sujeto de prueba es la **UI real** en un navegador (Playwright/Chromium). Se interactúa como un humano: clics, formularios, navegación. La API se usa solo como **oráculo/atajo** para sembrar o leer estado (p. ej. obtener un `sucursalId`), nunca para sustituir la verificación visual del flujo.
- **Contra datos reales.** Todo corre contra la **API real** + el **seed de desarrollo** (`pnpm --filter api db:seed`). Cero mocks de red para los caminos felices. Se permite interceptar respuestas solo para forzar **errores** (5xx, timeouts) que no se pueden reproducir de otro modo.
- **Flujos cruzados de primera clase.** El núcleo de la v3 es probar que **un cambio hecho en una pantalla se refleja en las demás**. Para roles simultáneos se usan **varios `BrowserContext`** (uno por rol) en la misma prueba. Como la app **no** tiene push en vivo (los datos se cargan con `useApi`/`recargar`), la prueba debe **re-navegar o recargar** la vista observadora y entonces afirmar — y este comportamiento (refresh para ver cambios) queda **documentado** como característica conocida.
- **Aislamiento y repetibilidad.** El seed es idempotente. Cada prueba que **crea** datos usa valores únicos (teléfono con timestamp, nombre con sufijo aleatorio) para no chocar con otras. No se asume orden entre pruebas. Una prueba debe poder correr sola y mil veces.
- **Sin flakes.** Nada de `waitForTimeout` arbitrarios; solo esperas por condición (`expect(...).toBeVisible`, respuestas de red). Toda espera tiene un porqué.
- **Los defectos se corrigen sobre la marcha, no se ocultan.** Si la UI no refleja lo que debería, la prueba **falla**; se registra el hallazgo en `_MATRIZ-TRAZABILIDAD` (severidad + pantalla + HU), se **corrige el código** que lo causa, y se deja la prueba **en verde** con una nota del fix. Nunca se relaja la aserción para "pasar". Si un defecto excede el alcance razonable de una corrección puntual (requiere rediseño o migración de esquema mayor), se documenta el hallazgo, se deja la prueba marcada (`test.fixme` con referencia al hallazgo) y se **escala al USUARIO** antes de emprender el cambio grande.

---

## 3. Herramientas y stack de prueba (no cambian salvo acuerdo)

| Capa | Decisión | Nota |
|---|---|---|
| Runner E2E | **Playwright** (`@playwright/test`, Chromium) | Ya instalado en `apps/web` (FASE-14) |
| Servidor web | Vite dev `:5173` (lo arranca el `webServer` de Playwright) | proxy `/api` → `:3000` |
| API | NestJS real en `:3000` + Postgres (docker) + seed | `NODE_ENV` ≠ production (devuelve `devCode` de OTP) |
| Datos | Seed idempotente (`apps/api/src/db/seed.ts`) | ver `_DATOS-Y-CREDENCIALES` |
| Selectores | Roles ARIA y texto visible primero; **`data-testid`** donde el texto sea ambiguo/volátil | ver `_ESTRATEGIA-Y-CONVENCIONES` |
| Multi-rol | un `BrowserContext` por rol dentro de una prueba | para flujos cruzados |
| Reporte | `list` en local, `github` + traza en CI | gate de CI ya existe |

**Alcance de los cambios de código en la v3:**
- **Permitido (fix-forward):** corregir **defectos** que las pruebas revelen (bugs de lógica de UI, cableado a la API, estados, reflejos entre pantallas, validaciones), y añadir atributos **`data-testid`** (cambio inerte) cuando un selector estable lo exija. Todo cambio de código va acompañado de la prueba que lo justifica (queda en verde) y de la nota del hallazgo en `_MATRIZ-TRAZABILIDAD`.
- **No permitido sin acuerdo del USUARIO:** añadir **features nuevas**, rediseñar la UI, **migrar el esquema** de base de datos, o cambios de gran superficie. Si la corrección de un defecto exige algo de esto, se escala primero (ver regla de oro de fix-forward arriba).
- **Disciplina:** las correcciones se hacen **mínimas y localizadas**, sin aprovechar para refactors oportunistas, y respetando las convenciones del código existente.

---

## 4. Mapa de fases

| Fase | Archivo | Qué prueba | Foco cruzado |
|---|---|---|---|
| 00 | `FASE-00-cimientos-de-testing.md` | Harness, fixtures, helpers multi-rol, estrategia de datos/selectores, refactor de los specs de la v2 | — (cimiento) |
| 01 | `FASE-01-auth-sesion-rbac.md` | Login por rol, credenciales inválidas, refresh/expiración, logout, cuenta suspendida/bloqueada, guardas de ruta por rol | sesión ↔ todas las apps |
| 02 | `FASE-02-reserva-publica-cliente.md` | Reserva del cliente E2E (sucursal→servicio→especialista→franja→OTP→confirmación), gestión/cancelar/reagendar, concurrencia, errores | CLI interno |
| 03 | `FASE-03-flujo-cruzado-reserva.md` | **FLUJO INSIGNIA:** la reserva del cliente se refleja en ESP, ADM y REC; y cada transición de estado se propaga a todas las vistas | CLI → ESP/ADM/REC |
| 04 | `FASE-04-especialista-ciclo-turno.md` | Agenda día/semana, iniciar→cobrar→completar, cancelar/no asistió, walk-in, atención retroactiva, ganancias, disponibilidad/sucursal | ESP → ADM/REC |
| 05 | `FASE-05-recepcion.md` | Tablero del día, crear cita, reasignar especialista, walk-in, cobro, resumen diario | REC → ESP/ADM |
| 06 | `FASE-06-admin-agenda-supervision.md` | Panel/KPIs, agenda admin, crear turno en cualquier sucursal, walk-in retroactivo, supervisión consolidada | ADM → ESP/REC |
| 07 | `FASE-07-admin-clientes-crm.md` | Alta/edición/baja lógica de clientes, historial que refleja atenciones completadas, métricas del cliente | atención → historial CRM |
| 08 | `FASE-08-admin-gestion.md` | Equipo (alta/baja, asignación a sucursales), Servicios (repartición % y fija), Inventario (stock, alertas, venta→gasto) | equipo/servicio → reserva y finanzas |
| 09 | `FASE-09-admin-finanzas-liquidaciones.md` | Análisis, Reportes (CSV/PDF), Quincenal/cierre, Gastos, Liquidaciones (descuento 2%), período sin datos | atención/venta/gasto → finanzas |
| 10 | `FASE-10-admin-config-modularidad.md` | Módulos on/off (inventario, partición, cierre) por negocio/sucursal y su efecto en la UI; herencia financiera; usuarios; perfil del negocio | config → toda la app |
| 11 | `FASE-11-multitenant-sucursales-consolidado.md` | Aislamiento multi-tenant desde el front; filtro por sucursal vs consolidado; especialista en varias sedes | tenant/sucursal ↔ todas las vistas |
| 12 | `FASE-12-onboarding-negocio.md` | Onboarding completo (perfil, módulos, restricciones, equipo, listo) → aterriza en admin con los defaults del perfil | onboarding → admin |
| 13 | `FASE-13-operador-plataforma.md` | Lista/detalle de tenants, cobro, suspender/reactivar; efecto cruzado: el tenant suspendido ve el aviso al iniciar sesión | PLT → login del tenant |
| 14 | `FASE-14-sitio-regresion-cierre.md` | Sitio marketing (nav, precios, calculadora), no-regresión visual/responsive/a11y, suite completa como gate, informe de hallazgos y cierre | — (gate global) |

**Orden recomendado:** 00 es cimiento obligatorio. 01 y 02 habilitan el resto (sesión + reserva). **03 es la prioridad declarada por el USUARIO** (flujo cruzado de la reserva) y depende de 01/02/04/05/06 para las vistas observadoras — puede escribirse incrementalmente. 04–10 cubren cada rol/área a profundidad; 11 es transversal; 12–13 cierran flujos de alta y plataforma; 14 es el gate final y el informe.

---

## 5. Qué significa "probar un flujo entre pantallas" (patrón de referencia)

El caso que pidió el USUARIO, generalizado, es el **patrón maestro** de la v3:

```gherkin
Escenario (patrón): un cambio se refleja en todas las vistas
  Dado un actor A en su pantalla (p. ej. Cliente en la reserva pública)
  Y observadores O1..On en sus pantallas (Especialista, Admin, Recepción)
  Cuando A ejecuta una acción que cambia el estado (p. ej. confirma una reserva)
  Entonces el cambio queda persistido (oráculo opcional vía API)
  Y al recargar/re-navegar la vista de cada observador
  Entonces O1..On ven el cambio con los datos correctos (cliente, servicio, hora, estado)
  Y NINGÚN observador de otro tenant lo ve (aislamiento)
```

Cada fase aplica este patrón a sus flujos. La **FASE-03** lo ejecuta de forma exhaustiva para la reserva; las demás lo aplican a sus propias acciones (completar turno, reasignar, registrar gasto, suspender tenant, etc.).

---

## 6. Tablero de progreso (actualizar al terminar cada fase)

- ✅ FASE-00 Cimientos de testing (harness, helpers, datos)
- ✅ FASE-01 Auth, sesión y RBAC
- ✅ FASE-02 Reserva pública del cliente (1 hallazgo corregido: H-001)
- ✅ FASE-03 Flujo cruzado de la reserva (CLI → ESP/ADM/REC)
- ✅ FASE-04 Especialista · ciclo del turno (+ verificación del bug reportado: H-002 corregido)
- ✅ FASE-05 Recepción (crear cita, reasignar cruzado, walk-in + cobro, estados; H-003 rate-limit corregido, H-004 export escalado)
- ✅ FASE-06 Admin · agenda y supervisión (panel/KPIs, filtro consolidado/sede, crear turno por sede + anti-solape, ciclo iniciar→cobrar; H-005 filtro de especialista por sede corregido)
- ✅ FASE-07 Admin · clientes (CRM) (listado/búsqueda/aislamiento, alta+validación+edición, baja lógica conserva histórico, historial atención→CRM; H-006 reactivar escalado)
- ✅ FASE-08 Admin · gestión (equipo alta/2-sedes/baja→público; servicios CRUD + payout valor fijo y porcentaje; inventario stock/alertas/movimientos + gate de módulo; **H-007 reparto % por servicio corregido**)
- ✅ FASE-09 Admin · finanzas y liquidaciones (análisis + período sin datos + CSV; gastos fijo/variable→neta; reportes con gráficos lazy; cierre quincenal archiva; liquidación 2% electrónico + partición off; **H-008 exportar PDF escalado**)
- ✅ FASE-10 Admin · configuración y modularidad (módulos inventario/partición/aprobación-manual → efecto en toda la app; herencia financiera negocio→sucursal + autobalance 100%; usuarios alta/baja → login real; suscripción + estado de error; parciales no-bloqueantes: cierre por sucursal, vertical, cupos)
- ✅ FASE-11 Multi-tenant, sucursales y consolidado (aislamiento clientes/equipo/agenda/enlace público + negativo RLS por id ajeno; consolidado = suma de sedes)
- ✅ FASE-12 Onboarding del negocio (asistente 5 pasos → /admin con el módulo elegido activo; validación por paso; atrás/adelante conserva estado; terminología por perfil salón/barbería; reseed al cerrar)
- ✅ FASE-13 Operador de plataforma (consola: lista+KPIs, buscar/filtrar, detalle cupos+cobros, generar cobro; suspender→login bloqueado aislado del salón→reactivar restaura; solo operador accede. + fix de robustez: seed disponibilidad 7d/00–24h para estabilidad horaria en CI)
- ✅ FASE-14 Sitio, no-regresión y cierre (sitio marketing: nav/precios/calculadora con fórmula/comparativa/funnel-maqueta; responsive sin scroll horizontal + hamburguesa móvil; a11y de diálogos role/aria-modal+Esc; **gate: suite completa 122 verde + 3 skips**, tsc+lint limpios; informe de hallazgos y cobertura cerrados)

---

## ✅ V3 CERRADA
Las 14 fases (00–14) completas. **32/32 HU** y **11/11 flujos cruzados** cubiertos. Gate verde (122 pruebas + 3 skips). **5 hallazgos corregidos** (H-001 bloqueante, H-002 alto, H-003/H-005/H-007 medios) y **3 escalados** (H-004/H-006/H-008, features ausentes) + deudas/decisiones documentadas en `_MATRIZ-TRAZABILIDAD §3-4`.

---

## 7. Documentos de apoyo (leer junto a este índice)

- `_ESTRATEGIA-Y-CONVENCIONES.md` — pirámide de prueba, estructura de carpetas `e2e/`, fixtures, helpers multi-rol, política de selectores (`data-testid`), manejo de esperas y anti-flake, cómo levantar el entorno.
- `_DATOS-Y-CREDENCIALES.md` — usuarios y datos del seed para las pruebas, ids útiles, cómo obtenerlos, estrategia de datos únicos y limpieza.
- `_MATRIZ-TRAZABILIDAD.md` — mapa HU → fase → spec, para auditar cobertura, y registro de hallazgos (defectos) detectados.

---

## 8. ⚠️ Acción del USUARIO

- Confirmar el **alcance de tooling** (Playwright como runner único; sin Cypress/otros).
- **Destino de los hallazgos: DEFINIDO → corrección sobre la marcha (fix-forward).** Los defectos se corrigen en la misma sesión de la fase que los detecta, con su prueba en verde y su registro en `_MATRIZ-TRAZABILIDAD §3`. El USUARIO solo interviene cuando un defecto requiere un cambio mayor (feature, rediseño o migración de esquema), que se le escala antes de ejecutarlo.
- Proveer entorno para correr la suite (Docker + seed) si se quiere ejecutar en una máquina distinta a la de desarrollo.
