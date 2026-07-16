# _ESTRATEGIA-Y-CONVENCIONES · Cómo se prueba en la v3

Documento de apoyo transversal. Define el **cómo** para que todas las fases escriban pruebas homogéneas, estables y legibles.

## 1. Filosofía y alcance

- La v3 es **caja negra desde el frontend**: se prueba lo que ve y hace un usuario en el navegador. No se prueban funciones internas ni el estado de React.
- La unidad de valor es el **flujo**, no la pantalla aislada. Una pantalla "se prueba" demostrando que sus acciones producen el efecto correcto **en ella y en las demás vistas afectadas**.
- Pirámide invertida deliberada: aquí casi todo es **E2E de UI**. Las pruebas unitarias/financieras viven en `apps/api` (jest, ya existentes) y **no** se reescriben; la v3 las da por sentadas y se concentra en la experiencia integrada.
- **Política fix-forward.** Cuando una prueba revela un defecto real, se **corrige el código en la misma sesión** (corrección mínima y localizada), se registra el hallazgo en `_MATRIZ-TRAZABILIDAD §3` con su fix, y la prueba queda **en verde**. Nunca se ablanda la aserción. Si la corrección requiere un cambio mayor (feature, rediseño o migración de esquema), se escala al USUARIO y se deja el caso como `test.fixme` referenciando el hallazgo.

## 2. Entorno de ejecución

Requisitos antes de `playwright test`:

```bash
# 1) Base de datos
docker compose up -d db
# 2) Migraciones + seed idempotente
pnpm --filter api db:migrate && pnpm --filter api db:seed
# 3) API real (NODE_ENV ≠ production para que el OTP devuelva devCode)
pnpm --filter api start         # escucha en :3000
# 4) Suite (Playwright arranca Vite :5173 con su webServer)
pnpm --filter web e2e
```

En CI el gate ya levanta DB+API+seed antes de `pnpm --filter web e2e` (`.github/workflows/ci.yml`). Cada fase que añada specs **no** requiere tocar el workflow: corren automáticamente.

> **Estado entre pruebas:** el seed se siembra **una vez** antes de la suite. Las pruebas que mutan datos deben asumir un estado base **ya posiblemente modificado** por otras: por eso se opera con **datos propios y únicos** (ver §6) y se afirma sobre lo que cada prueba creó, no sobre conteos globales frágiles. Para fases muy destructivas (cierre de período, suspensión) se permite **re-sembrar** en un `test.beforeAll` documentado.

## 3. Estructura de carpetas `apps/web/e2e/`

Se refactoriza lo de la v2 a esta estructura (FASE-00):

```
apps/web/e2e/
  fixtures/
    auth.fixture.ts        # fixtures de página ya logueada por rol
    roles.ts               # credenciales + helpers de login (hereda helpers.ts v2)
    api.ts                 # cliente API para sembrar/leer (oráculo)
    data.ts                # generadores de datos únicos (telefono, nombre)
  pages/                   # Page Objects ligeros por pantalla
    login.page.ts
    booking.page.ts        # reserva pública (cliente)
    admin-agenda.page.ts
    spec-agenda.page.ts
    recepcion.page.ts
    ...
  specs/
    01-auth/               # un subdirectorio por fase
    02-reserva/
    03-flujo-cruzado/
    ...
  README.md                # cómo correr, convenciones (apunta a este doc)
```

- **Page Objects ligeros:** encapsulan selectores y acciones de una pantalla (`bookingPage.elegirServicio('Corte')`). Evitan duplicar selectores entre specs y absorben cambios de UI en un solo sitio.
- **Specs por fase:** cada fase de este plan crea/expande su carpeta en `specs/NN-*`.
- Los specs v2 (`auth.spec.ts`, `booking.spec.ts`, `isolation.spec.ts`) se **mueven** a `specs/01-auth/`, `specs/02-reserva/`, `specs/11-multitenant/` y se adaptan a los Page Objects.

## 4. Política de selectores (en orden de preferencia)

1. **Rol accesible + nombre**: `getByRole('button', { name: 'Entrar' })`, `getByRole('heading', { name: 'Negocios' })`. Refuerza la accesibilidad lograda en v2-FASE-14.
2. **Texto visible** estable de negocio: nombres de cliente, servicio, etc.
3. **`data-testid`** SOLO cuando 1 y 2 sean ambiguos o volátiles (listas con texto repetido, celdas de agenda, badges de estado). El `data-testid` es la **única** edición permitida en `apps/web/src`. Convención:
   - `data-testid="appt-row-{citaId}"`, `data-testid="appt-estado"`, `data-testid="agenda-col-{especialistaId}"`, `data-testid="kpi-{clave}"`, `data-testid="slot-{horaISO}"`.
   - Cada fase que añada `data-testid` los **lista** en su sección "Huecos de testabilidad" y los agrega de forma mínima e inerte (sin cambiar estilos ni lógica).
- **Prohibido** seleccionar por clases CSS, estructura del DOM frágil o índices posicionales salvo que no haya alternativa y esté justificado.
- **Strict mode** de Playwright activo: si un locator resuelve a varios nodos, **acotar** (p. ej. `getByRole('navigation').getByRole('button', { name: 'Clientes' })`) — lección de la v2.

## 5. Esperas y anti-flake

- Nunca `page.waitForTimeout(n)` para "dar tiempo". Se espera por **condición**: visibilidad, URL, respuesta de red (`page.waitForResponse`), o estado del Page Object.
- Para reflejos entre vistas (sin push en vivo): la prueba **recarga** la vista observadora (`page.reload()` o re-navegación a la pestaña) y entonces afirma. Encapsular en `pageObject.refrescar()`.
- Acciones que disparan red: esperar la respuesta antes de afirmar (`await Promise.all([page.waitForResponse(/\/citas/), boton.click()])`).
- Reintentos: `retries: 1` en CI (ya configurado). Un test que solo pasa con reintentos se trata como **sospechoso** y se estabiliza, no se acepta.

## 6. Datos: aislamiento y unicidad

- Lectura de ids del seed vía **API oráculo** (`fixtures/api.ts`): login como admin → `GET /api/sucursales`, `GET /api/public/:suc/servicios`, etc. Nunca hardcodear UUIDs (cambian en cada seed).
- Datos creados por una prueba son **únicos**: `telefono = '30' + Date.now().toString().slice(-8)`, `nombre = 'E2E ' + crypto.randomUUID().slice(0,6)`. Así dos corridas no colisionan ni dependen de orden.
- Verificación: cada prueba afirma sobre **lo que ella creó** (su cliente/teléfono/cita), no sobre totales globales del tenant.
- Limpieza: por defecto **no** se limpia (datos únicos no estorban). Las fases destructivas re-siembran en `beforeAll`.

## 7. Multi-rol en una sola prueba (flujos cruzados)

Patrón para "se refleja en todas las vistas": un `BrowserContext` por rol.

```ts
test('la reserva aparece en la agenda del especialista', async ({ browser, request }) => {
  // Actor: cliente (sin sesión) — su propio contexto
  const cli = await browser.newContext();
  const cliPage = await cli.newPage();
  // Observador: especialista logueado — otro contexto
  const esp = await browser.newContext();
  const espPage = await esp.newPage();
  await loginUI(espPage, USERS.especialista);
  // ... cliente reserva en cliPage ...
  // ... espPage.reload() y se afirma la cita visible ...
  await cli.close(); await esp.close();
});
```

- Cada contexto tiene su `localStorage`/cookies aislados (sesiones independientes, imprescindible para no pisar tokens entre roles).
- Para varios observadores (ESP+ADM+REC) se abren varios contextos. Encapsular el armado en un fixture (`abrirRoles(['especialista','admin','recepcion'])`).

## 8. Convenciones de escritura de specs

- Nombre del `test.describe` = funcionalidad/HU; nombre del `test` = escenario Gherkin en español, conciso.
- Un `expect` de negocio por aserción clave; mensajes de fallo útiles (`expect(x, 'la cita debe aparecer confirmada').toBeVisible()`).
- Comentar cada spec con la(s) HU que cubre (`// HU-CLI-003, HU-ESP-002`).
- Cada caso de borde (error, conflicto, vacío) es un `test` aparte, no un `if` dentro de otro.
- Etiquetas: usar `test.describe.serial` solo cuando el orden sea intrínseco (p. ej. crear → completar → ver en finanzas dentro del mismo flujo).

## 9. Cobertura mínima por pantalla

Cada pantalla bajo prueba debe verificar sus **cuatro estados** donde apliquen: con datos, **cargando** (skeleton/spinner aparece y desaparece), **vacío** (empty state), **error** (interceptar 5xx y ver el `ErrorState` con reintento). La reserva añade **conflicto**. Esto operacionaliza el criterio de la v2 ("todos los estados") como aserciones reales.

## 10. Definición de "hallazgo"

Si una prueba bien escrita falla por comportamiento real (no por el test), se registra en `_MATRIZ-TRAZABILIDAD` §Hallazgos con: id, severidad (bloqueante/alto/medio/bajo), pantalla, HU, pasos, esperado vs observado. Luego, **bajo la política fix-forward**:
1. Se **corrige el código** que causa el defecto (cambio mínimo, localizado, conforme a las convenciones existentes).
2. Se vuelve a correr la prueba hasta dejarla **en verde** y se anota en el hallazgo el commit/archivo del fix (estado → "corregido").
3. Se verifica que el fix **no rompe** otras pruebas (correr la suite de la fase, y la relacionada si el cambio toca un primitivo compartido).

Nunca se ablanda la aserción para un "verde falso". **Excepción (escalar):** si el defecto requiere una **feature nueva, un rediseño o una migración de esquema**, no se ejecuta el cambio grande por cuenta propia: se deja el caso como `test.fixme('[HALLAZGO-XX] …')`, se marca el hallazgo como "escalado" y se consulta al USUARIO.
