# PLAN-V2 · Índice maestro de ejecución de Orkalis (v2 — Frontend fiel al prototipo)

> **Para quién es este documento.** Para una IA que escribe código (en adelante "Claude ejecutor") y para el dueño del producto ("EL USUARIO"). La **v1 ya está construida y funcional** (backend completo + un frontend mínimo de andamiaje). La **v2 tiene un único objetivo**: que la aplicación web se vea y se comporte **exactamente como el prototipo** de `/Prototipo Interfaz Orkalis`, y que cada pantalla esté **conectada de verdad** al backend existente (`apps/api`), expandiéndolo solo donde falte. No se inventa diseño ni alcance: **el prototipo es la fuente de verdad visual y funcional**; la documentación de `/Documentacion` es la fuente de verdad de reglas de negocio. Si algo del prototipo choca con la documentación, **gana la documentación** y debes avisar al USUARIO.

---

## 0. Cómo usar este plan (LEER SIEMPRE PRIMERO)

1. El trabajo está partido en **fases** (`FASE-00` … `FASE-14`). Cada fase vive en su propio `.md` dentro de esta carpeta.
2. **Una sesión de Claude = una fase** (o parte de una fase). Al empezar, abre **solo**: este `PLAN-V2.md` (contexto global), el archivo de la fase, y **los archivos del prototipo que esa fase indique** (cada fase lista exactamente cuáles). No abras prototipo de más: gasta tokens.
3. Cada archivo de fase tiene SIEMPRE esta estructura fija:
   - **Objetivo** — qué pantallas/flujos quedan terminados.
   - **Prerrequisitos** — qué fases deben estar 100% listas antes.
   - **Fuente visual (prototipo)** — los `.jsx`/`.css` del prototipo que esta fase replica, por nombre.
   - **Pasos de Claude** — qué construir, pantalla por pantalla, con su cableado a la API.
   - **Backend: huecos a cubrir** — endpoints/campos que falten en `apps/api` y deban añadirse (con migración Drizzle si toca esquema).
   - **⚠️ ACCIÓN DEL USUARIO** — lo que el humano debe hacer fuera del código. Si falta, **detente y pídela**.
   - **Verificación / Done** — checklist para dar la fase por cerrada.
   - **Trazabilidad** — RF/RNF/ADR cubiertos.
4. **No avances de fase** si la verificación no pasa. "Parecerse al prototipo" es un criterio **literal**: mismos componentes, mismo layout, mismos estados (con datos / cargando / vacío / error / conflicto), misma jerarquía tipográfica y de color del design system.
5. Marca el progreso en la tabla de la sección 5 (⬜ → ✅) al terminar cada fase.

---

## 1. Qué cambia respecto a la v1

La v1 entregó:
- **Backend NestJS completo** (`apps/api`): auth/RBAC, multi-tenant + RLS, configurabilidad, agendamiento con máquina de estados y `EXCLUDE`, motor financiero, operación interna (clientes, servicios, inventario, gastos, liquidaciones, reportes, cierres), notificaciones (Twilio), suscripción Wompi, observabilidad.
- **Un frontend mínimo de andamiaje** (`apps/web`): login, paneles admin/especialista/recepción/plataforma y reserva pública, pero **no se parecen al prototipo**, faltan componentes, hay vistas mal acomodadas y flujos que no funcionan (p. ej. **la reserva del cliente**).
- **Los tokens del design system ya están copiados** a `apps/web/src/styles` (colors, typography, spacing, radius-elevation, fonts) — ver `[[frontend-y-shared-dual]]`.

La v2 **reescribe la capa de UI** de `apps/web` para que sea un calco fiel y funcional del prototipo. Se **conserva** lo que ya sirve del andamiaje (cliente HTTP `lib/api.ts`, `lib/auth.tsx`, `lib/format.ts`, los tokens CSS, `@orkalis/shared`) y se **reconstruye** todo lo visual (componentes, layouts, pantallas) sobre el design system real del prototipo.

---

## 2. Inventario del prototipo (mapa de pantallas → fase)

El prototipo son varias "apps" independientes (cada una con su `.html` de entrada). Mapa de cobertura:

| App del prototipo | Archivos `.jsx` clave | Pantallas | Fase v2 |
|---|---|---|---|
| **Design System** | `_ds/.../tokens/*`, `_ds/.../styles.css`, `ork-ui.jsx`, `admin-ui.jsx`, `tokens.css` | Botón, Input, Select, Checkbox, Switch, Badge, Tag, Avatar, Card, KpiCard, Tabs, Alert, Tooltip, Dialog, Toast, Skeleton, Icon (Lucide) | **01** |
| **Login Admin** | `login-app.jsx` | Login, cuenta suspendida, cuenta bloqueada | **02** |
| **Reserva en línea** (cliente) | `app.jsx`, `screens-flow-a/b/c.jsx`, `screens-common.jsx`, `data.js` | Inicio, Servicios, Especialista, Horario (slots AM/PM), Identificación+OTP, Confirmación, Gestión de la cita | **03** |
| **Onboarding del negocio** | `onboarding-app.jsx` | Vertical, módulos, restricciones, equipo, listo | **04** |
| **Panel Admin** | `admin-app.jsx`, `admin-ui.jsx`, `admin-screens-dashboard.jsx`, `admin-screens-agenda.jsx` | Panel (dashboard + KPIs + agenda del día + resumen financiero), Agenda (mini-calendario, leyenda, contadores, archivo por período) | **05** |
| | `admin-screens-clientes.jsx` | Clientes (CRM): tarjetas, historial, alta/edición, borrado | **06** |
| | `admin-screens-gestion*.jsx`, `admin-gestion-ui.jsx`, `admin-data-gestion.js` | Gestión: Equipo (+liquidación), Servicios (+editor de repartición), Inventario (+movimientos) | **07** |
| | `admin-screens-finanzas*.jsx`, `admin-finanzas-ui.jsx`, `admin-data-finanzas.js`, `admin-modals-ventas.jsx` | Finanzas: Quincenal, Reportes, Análisis | **08** |
| | `admin-screens-config*.jsx`, `admin-config-ui.jsx`, `admin-data-config.js` | Config: Módulos, Agenda, Notificaciones, Sucursales, Usuarios, Financieros, Suscripción, Developer | **09** |
| **App del Especialista** | `spec-app.jsx`, `spec-ui.jsx`, `spec-screens-a..e.jsx`, `specialist-data.js` | Mi día, Agenda (día/semana), Detalle de turno, Cobro, Walk-in, Ganancias, Perfil | **10** |
| **Recepción** | `recepcion-app.jsx`, `admin-data-recepcion.js` | Tablero por especialista, reasignar, walk-in, cobro | **11** |
| **Orkalis — Sitio web** | `site-app.jsx`, `site-pages.jsx`, `site-funnel.jsx`, `site-support.jsx`, `site-ui.jsx`, `site-data.js` | Landing, Precios, Comparativa, Calculadora, Alta (signup), Checkout (Wompi), Bienvenida, Soporte | **12** |
| **Panel de plataforma** | (no hay pantalla dedicada en el prototipo; se infiere del backend `plataforma`) | Operador: tenants, suscripciones, suspensión | **13** |

> **Nota sobre `ios-frame.jsx` / `tweaks-panel.jsx` / `EDITMODE`:** son andamiaje del prototipo (marco de iPhone, panel de ajustes en vivo, bloques `EDITMODE-BEGIN`). **No se portan** a producción. Sirven solo como referencia de los estados que cada pantalla debe soportar.

---

## 3. Stack y reglas que NO cambian (heredadas de v1)

| Capa | Decisión | Fuente |
|---|---|---|
| Frontend | **React + TypeScript + Vite** en `apps/web` | ADR-000 / ADR-008 |
| Tipos compartidos | **`@orkalis/shared`** (enums/DTOs), dual CJS+ESM — ver `[[frontend-y-shared-dual]]` | ADR-008 |
| Estilo | **Orkalis Design System** del prototipo (`_ds`) = fuente de verdad visual | Definición §6 / RNF-005 |
| Iconos | **Lucide** exclusivamente (2px stroke, `currentColor`) | DS readme |
| Tipografías | **Plus Jakarta Sans** (display/KPIs), **DM Sans** (UI), **JetBrains Mono** (datos/IDs) | DS readme |
| Color | Navy `#0F1923` (superficie autoridad), azul eléctrico `#1A73E8` (única acción/marca), teal `#00D4AA` (solo +datos) | DS readme |
| Localización | **COP**, formato **`es-CO`**, español; tratar al cliente de **"tú"** | Definición §7 / RNF-004 / DS voz |
| Auth front | JWT (access corto + refresh en `lib/api.ts`); cliente final por **OTP sin sesión** | ADR-003 |
| Cobro | plan + nº especialistas + cupos de mensajería (sucursal NO cobra) — ver `[[modelo-cobro-suscripcion]]` | ADR-009 |
| Backend | **NestJS** existente; expandir solo con migración Drizzle versionada si toca esquema | ADR-004 / ADR-008 |

**Reglas de oro de la v2:**
- **Cero diseño inventado.** Cada pixel sale del prototipo o del design system. Si una pantalla del prototipo no especifica algo, se usa el componente/patrón equivalente del DS, nunca una invención.
- **Cero mock en producción.** El prototipo usa datos falsos (`*-data.js`, `localStorage`). En la v2 **todo** sale de la API real. Donde el prototipo simula (p. ej. el puente `orkalis_public_booking` por `localStorage`), se reemplaza por el endpoint real.
- **Todos los estados.** Cada lista/pantalla soporta: **con datos · cargando (skeleton shimmer) · vacío (empty state con copy del DS) · error (con reintento)**. El flujo de reserva añade **conflicto** (franja tomada).
- **Móvil donde el prototipo es móvil.** Reserva pública y App del Especialista son **móvil-first con safe-area** (RNF-003). Admin/Recepción son escritorio/tablet con sidebar navy de 240px.
- **Nada de `float` para dinero.** Formateo `es-CO`/COP centralizado en `lib/format.ts`.

---

## 4. Mapa de fases

| Fase | Archivo | Qué hace | Acción usuario |
|---|---|---|---|
| 00 | `FASE-00-auditoria-y-cimientos.md` | Gap analysis prototipo↔web actual; inventario de pantallas; arquitectura de carpetas; lista consolidada de huecos de backend; convenciones de cableado | **SÍ (decisiones de alcance)** |
| 01 | `FASE-01-design-system-componentes.md` | Portar tokens `_ds` + librería de **componentes primitivos** React/TS (Button…Dialog, Toast, Skeleton, Icon Lucide) fiel al prototipo | No |
| 02 | `FASE-02-shell-auth-navegacion.md` | Shell (sidebar navy / topbar), routing por rol, **Login** + estados suspendida/bloqueada, selector sucursal/consolidado, localización | No |
| 03 | `FASE-03-reserva-publica-cliente.md` | **Reserva del cliente** end-to-end y funcional (Inicio→…→OTP→Confirmación→Gestión) contra la API pública | No |
| 04 | `FASE-04-onboarding-negocio.md` | Onboarding del negocio (vertical, módulos, restricciones, equipo, listo) | No |
| 05 | `FASE-05-admin-panel-agenda.md` | Admin · Panel (dashboard/KPIs/agenda del día/resumen) + Agenda (calendario, contadores, archivo) | No |
| 06 | `FASE-06-admin-clientes.md` | Admin · Clientes (CRM): tarjetas, historial, alta/edición/borrado | No |
| 07 | `FASE-07-admin-gestion.md` | Admin · Gestión: Equipo (+liquidación), Servicios (+repartición), Inventario | No |
| 08 | `FASE-08-admin-finanzas.md` | Admin · Finanzas: Quincenal, Reportes, Análisis, registrar venta/gasto | No |
| 09 | `FASE-09-admin-configuracion.md` | Admin · Config: Módulos, Agenda, Notif, Sucursales, Usuarios, Financieros, Suscripción, Developer | No |
| 10 | `FASE-10-app-especialista.md` | App del Especialista (móvil): Mi día, Agenda, Detalle, Cobro, Walk-in, Ganancias, Perfil | No |
| 11 | `FASE-11-recepcion.md` | Recepción: tablero por especialista, reasignar, walk-in, cobro, resumen diario | No |
| 12 | `FASE-12-sitio-web-y-alta.md` | Sitio marketing + maqueta de alta/checkout Wompi (**solo visual** en v2; sin funcionalidad) + bienvenida + soporte | No (Wompi diferido) |
| 13 | `FASE-13-panel-plataforma.md` | Panel del Operador de Plataforma (tenants, suscripciones, suspensión) | No |
| 14 | `FASE-14-qa-responsive-accesibilidad-deploy.md` | Responsive, accesibilidad (focus/safe-area), E2E por rol, performance, despliegue | **SÍ (entornos)** |

**Orden recomendado:** 00 → 01 → 02 son cimiento obligatorio. Después **03 (reserva)** es la prioridad declarada por el USUARIO. 05–09 (admin) pueden ir en serie; 10 (especialista) y 11 (recepción) reutilizan componentes de admin. 12 es solo maqueta visual (sin Wompi funcional en v2); 13 es pequeño; 14 cierra.

---

## 5. Tablero de progreso (actualizar al terminar cada fase)

- ✅ FASE-00 Auditoría y cimientos
- ✅ FASE-01 Design System y componentes
- ✅ FASE-02 Shell, auth y navegación
- ✅ FASE-03 Reserva pública del cliente
- ✅ FASE-04 Onboarding del negocio
- ✅ FASE-05 Admin · Panel y Agenda
- ✅ FASE-06 Admin · Clientes
- ✅ FASE-07 Admin · Gestión
- ✅ FASE-08 Admin · Finanzas
- ✅ FASE-09 Admin · Configuración
- ✅ FASE-10 App del Especialista
- ✅ FASE-11 Recepción
- ✅ FASE-12 Sitio web y alta self-service
- ✅ FASE-13 Panel de plataforma
- ✅ FASE-14 QA, responsive, accesibilidad y despliegue (ver [CIERRE-V2.md](CIERRE-V2.md); deploy a prod pendiente de entornos del USUARIO)

---

## 6. Convenciones globales de la v2 (aplican a TODAS las fases)

- **Carpeta única de UI:** componentes primitivos en `apps/web/src/ui/`, una carpeta por app/rol en `apps/web/src/pages/` (`public`, `admin`, `spec`, `recepcion`, `plataforma`, `site`, `onboarding`). Hooks de datos en `apps/web/src/lib/` (un hook por recurso: `useCitas`, `useClientes`, …).
- **Datos por React Query** (o un hook propio de fetch+cache equivalente sobre `lib/api.ts`): nada de `fetch` suelto en componentes; nada de `localStorage` para datos de dominio.
- **Tipos desde `@orkalis/shared`**: si un endpoint devuelve una forma no tipada, añadir el DTO en `packages/shared` (no duplicar tipos en el front).
- **Estados obligatorios** (datos/cargando/vacío/error) con los componentes `Skeleton`, `EmptyState`, `ErrorState` del DS. Toasts para feedback de acciones.
- **Accesibilidad:** focus visible 2px `#1A73E8` siempre; navegación por teclado en diálogos; `safe-area-inset` en móvil.
- **Sin secretos en el front** (RNF-012). Solo `VITE_*` públicas (`VITE_API_URL`, llave pública de Wompi).
- **Backend:** todo hueco se cubre en `apps/api` con su servicio + controlador + (si toca esquema) **migración Drizzle versionada**, respetando scope multi-tenant y RLS (nunca consultar saltándose el repositorio base).
- **Verificación viva:** cada fase se prueba contra la API real corriendo (`pnpm --filter api dev` + `pnpm --filter web dev`), no solo "compila".

---

## 7. Decisiones de alcance (cerradas con el USUARIO en FASE-00)

1. **Sitio marketing + alta Wompi (FASE-12): SOLO VISUAL en v2.** Se construyen todas las páginas (landing, precios, comparativa, calculadora, alta, checkout, bienvenida, soporte) fieles al prototipo, pero **sin funcionalidad real**: el signup no crea cuenta y el checkout Wompi no procesa pagos en esta versión (se difiere a una versión posterior). Se montan como rutas públicas dentro de `apps/web`, con los CTAs/flujos maquetados (estados visuales) pero sin cableado a la pasarela ni alta de negocio.
2. **App del Especialista (FASE-10): web responsive para todos los dispositivos.** Se entrega dentro de `apps/web` como UI responsive (móvil, tablet y escritorio), no como app nativa. Móvil-first con safe-area, pero adaptándose con gracia a pantallas grandes.
3. **Datos para validar (decisión delegada a Claude → resuelta):** se crea un **script de seed** en `apps/api` (Drizzle) que siembra un tenant de **barbería** y uno de **salón** con servicios, especialistas, clientes, citas en varios estados, inventario y gastos de ejemplo. Razón: la plataforma es multi-tenant con RLS; para verificar cada pantalla 1:1 contra la **API real** (regla de oro: cero mock en producción) hace falta un negocio con datos realistas. El seed es idempotente, solo para entornos de desarrollo, y reemplaza por completo a los `*-data.js` del prototipo. (Ver FASE-00, paso de seed.)
4. **Gráficas:** se usa **recharts** (default acordado por falta de objeción), envuelto en wrappers del DS en FASE-01 y reusado en todo admin/finanzas.

---

*Fin del índice maestro. Abre ahora el archivo de la fase que corresponda y, junto a él, solo los archivos del prototipo que esa fase liste.*
