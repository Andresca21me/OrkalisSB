# FASE-00 · Auditoría, cimientos y contrato de API

## Objetivo
Antes de escribir UI: dejar por escrito **qué hay**, **qué falta** y **cómo se cablea**. Producir (1) un mapa pantalla-del-prototipo → endpoint(s) de la API, (2) la **lista consolidada de huecos de backend** que las fases siguientes irán cerrando, (3) la arquitectura de carpetas y las convenciones de datos de la v2, y (4) las decisiones de alcance que solo el USUARIO puede tomar. **No se construye ninguna pantalla en esta fase.**

## Prerrequisitos
- v1 terminada (backend + andamiaje web) — está.
- Acceso al prototipo en `/Prototipo Interfaz Orkalis` y a `/Documentacion`.

## Fuente visual (prototipo)
- Todos los `.html` de entrada (para enumerar las apps) y los orquestadores: `app.jsx`, `admin-app.jsx`, `spec-app.jsx`, `recepcion-app.jsx`, `onboarding-app.jsx`, `login-app.jsx`, `site-app.jsx`.
- `_ds/orkalis-design-system-*/readme.md` (reglas de marca y sistema).

## Pasos de Claude

### 1. Inventario y mapa pantalla→API
- Recorrer cada app del prototipo y listar **todas** sus pantallas y sub-pantallas (usar la tabla de la §2 del `PLAN-V2.md` como base y completarla con sub-estados).
- Para cada pantalla, anotar el/los endpoint(s) reales de `apps/api` que la alimentan. Endpoints ya existentes (verificados en v1):
  - **auth:** `POST /auth/login`, `/refresh`, `/logout`, `GET /auth/me`.
  - **config:** `GET /config`, `PUT /config/:nivel/:ambitoId/:clave`, `PUT /config/reparticion/...`, `DELETE`, `POST /config/clonar`.
  - **negocios:** `POST /negocios`, `PATCH /negocios/:id/perfil`.
  - **sucursales:** `GET/POST/PATCH/DELETE`, `POST /:id/reactivar`.
  - **especialistas (equipo):** `GET/POST/PATCH`, `PATCH /:id/estado`, `PUT /:id/sucursales`.
  - **suscripcion:** `GET /suscripcion`, `PATCH /suscripcion/plan`.
  - **citas (agendamiento interno):** `GET`, `POST /:id/aprobar|iniciar|completar|revertir|cancelar|no-asistio`, `POST /walk-in`, `POST /walk-in/retroactivo`.
  - **público:** `GET /public/:sucursalId/info|especialistas|servicios|disponibilidad`, `POST /public/:sucursalId/retener|otp/enviar|confirmar`, `POST /public/:sucursalId/cita/:id/cancelar`.
  - **clientes:** `GET`, `GET /:id/historial`, `POST/PATCH/DELETE`.
  - **servicios:** `GET/POST/PATCH/DELETE`.
  - **inventario:** `GET /productos`, `POST /productos|movimientos|ventas`, `GET /alertas|valoracion`.
  - **gastos:** `GET/POST/DELETE`.
  - **liquidaciones:** `POST /generar`, `POST /csv`.
  - **reportes:** `GET /reportes/financiero`.
  - **cierres:** `GET/POST`.
  - **pagos/wompi:** webhook + creación (ver módulo `pagos`).
  - **plataforma:** operador de tenants/suscripciones.
- Marcar cada pantalla como **✅ cubierta**, **🟡 parcial** (falta un campo/filtro) o **🔴 hueco** (no hay endpoint).

### 2. Lista consolidada de huecos de backend
Producir `Plan-Ejecucion-V2/_HUECOS-BACKEND.md` con cada hueco detectado, su fase destino y si requiere migración. Candidatos esperados a revisar (confirmar contra el código real antes de afirmar que faltan):
- **Ganancias del especialista** (pantalla "Ganancias" de la spec app): ¿hay endpoint de resumen por especialista (hoy/semana/mes) o hay que derivarlo de `reportes`/`liquidaciones`? Si no existe, hueco → FASE-10.
- **Agenda semanal** (spec/admin): ¿`GET /citas` acepta rango de fechas y agrupación por especialista/día? Si no, ampliar query params → FASE-05/10.
- **Dashboard/KPIs admin** (`admin-screens-dashboard`): ¿`reportes/financiero` da los KPIs del Panel (ingresos del día, citas, ticket promedio, deltas vs. período anterior)? Si no, endpoint de resumen → FASE-05.
- **Catálogo público por "cualquiera disponible"**: el prototipo permite `specialistId === "any"`; confirmar que `disponibilidad` soporta agregación sin especialista → FASE-03.
- **Sitio/alta self-service + Wompi**: confirmar endpoint de alta de negocio + creación de transacción Wompi y retorno de estado → FASE-12.
- **Notificaciones (config)**: pantalla de Notificaciones en config — confirmar claves de config y cupos de mensajería expuestos → FASE-09.
- **Reasignar cita** (recepción): confirmar que existe transición de reasignación de especialista o se modela como editar cita → FASE-11.

### 3. Arquitectura de carpetas y convenciones de datos (escribir y dejar fijo)
- Definir capa de datos: instalar **@tanstack/react-query** (o documentar el hook propio equivalente) sobre `lib/api.ts`. Convención: un hook por recurso en `lib/` (`useCitas.ts`, `useClientes.ts`, `useConfig.ts`, …) que tipa con `@orkalis/shared`.
- Estructura de `apps/web/src/`:
  - `ui/` — primitivos del DS (FASE-01).
  - `ui/Shell.tsx`, `ui/Sidebar.tsx`, `ui/Topbar.tsx` — layout (FASE-02).
  - `pages/{public,onboarding,admin,spec,recepcion,plataforma,site}/` — una carpeta por app.
  - `lib/` — `api.ts`, `auth.tsx`, `format.ts`, hooks de datos, `localizacion.ts`.
- Confirmar/extender `packages/shared`: cualquier DTO que el front necesite y no exista, se añade aquí (no en el front).
- Definir el **mapa de rutas** definitivo (rol → ruta base) reusando el `App.tsx` actual como punto de partida.

### 4. Script de seed para validar contra la API real (decisión cerrada #3)
- Crear `apps/api/src/db/seed.ts` (o `apps/api/scripts/seed.ts`) ejecutable por pnpm (`pnpm --filter api seed`), **idempotente** y **solo para desarrollo** (negarse a correr si `NODE_ENV=production`).
- Sembrar **dos tenants**: una **barbería** y un **salón**, cada uno con: 1 negocio + perfil, 1–2 sucursales, especialistas, catálogo de servicios con repartición, clientes, citas en varios estados (solicitada/confirmada/en progreso/completada/cancelada/no asistió), inventario con stock (incl. stock bajo), gastos y al menos un período liquidable. Crear también usuarios de cada rol (admin, recepcionista, especialista, operador de plataforma) con credenciales conocidas.
- Respetar **scope multi-tenant + RLS** (sembrar vía el repositorio base / `SET LOCAL app.current_tenant`), nunca saltándose el aislamiento.
- Este seed **reemplaza** a los `*-data.js` y `localStorage` del prototipo: ninguna pantalla de la v2 usa esos mocks; todas leen de la API alimentada por el seed.
- Documentar las credenciales sembradas en `Plan-Ejecucion-V2/_CREDENCIALES-SEED.md` (solo dev).

### 5. Plan de retiro del andamiaje viejo
- Listar qué archivos actuales de `apps/web/src/pages` y `ui` se **reescriben** (todos los visuales) y cuáles se **conservan** (`lib/api.ts`, `lib/auth.tsx`, `lib/format.ts`, `styles/*` ya copiados del DS). Dejar la decisión escrita para que las fases siguientes no dupliquen.

## Backend: huecos a cubrir
Ninguno se implementa aquí; esta fase **los cataloga** en `_HUECOS-BACKEND.md`. La implementación ocurre en la fase dueña de cada pantalla.

## ⚠️ ACCIÓN DEL USUARIO
**Decisiones de alcance — YA RESPONDIDAS** (registradas aquí como contrato):
1. **Sitio marketing + alta Wompi (FASE-12): SOLO VISUAL en v2.** Se maquetan todas las páginas fieles al prototipo, pero el alta no crea cuenta y el checkout Wompi no procesa pagos; la funcionalidad se difiere a una versión posterior. Rutas públicas dentro de `apps/web`.
2. **App del Especialista (FASE-10): web responsive para todos los dispositivos** (móvil/tablet/escritorio) dentro de `apps/web`. No nativa.
3. **Datos demo: se crea un script de seed** (paso 4 de esta fase) con tenants barbería + salón y datos realistas, para validar todas las pantallas contra la API real. (Decisión delegada por el USUARIO y resuelta por Claude.)
4. **Gráficas: recharts** (default acordado).

> No quedan decisiones bloqueantes pendientes. Lo único que el USUARIO debe aún proveer en fases posteriores son las **variables de entornos de despliegue** (FASE-14) y, si en el futuro se activa Wompi, sus claves.

## Verificación / Done
- Existe el mapa pantalla→API completo (cada pantalla del prototipo etiquetada ✅/🟡/🔴).
- Existe `_HUECOS-BACKEND.md` con cada hueco, su fase y si requiere migración.
- Arquitectura de carpetas, capa de datos y mapa de rutas están escritos y acordados.
- Las 4 decisiones de alcance están registradas (sitio solo-visual, spec responsive, seed, recharts).
- El **script de seed** existe, es idempotente y deja un negocio barbería + salón con datos realistas; credenciales documentadas en `_CREDENCIALES-SEED.md`.
- **No se construyó UI** (esta fase es solo de cimientos + seed).

## Trazabilidad
- ADR-008 (monorepo, tipos compartidos), Definición §6 / RNF-005 (prototipo = fuente visual), RNF-004 (es-CO/COP). Cubre la preparación de RF-015..RF-045 (cara visual) sin implementarlos aún.
