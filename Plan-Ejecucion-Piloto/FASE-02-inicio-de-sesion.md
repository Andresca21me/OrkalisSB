# FASE-02 · Inicio de sesión y cuentas

> Parte de `PLAN-PILOTO.md`. Abre ese archivo + este. Prioridad 🔴.

## Problema
`POST /api/auth/login` (`auth.controller.ts`) no tiene `@Throttle` propio ni bloqueo por
cuenta: solo el límite global de 120 req/min por IP. Un atacante puede probar unas 170.000
contraseñas al día contra la cuenta del dueño de la barbería, y con varias IP no hay techo.

## Decisión de diseño
- **Bloqueo por cuenta:** 5 intentos fallidos seguidos → la cuenta queda bloqueada
  **15 minutos**. Un login correcto o un restablecimiento de contraseña reinicia el contador.
- Mientras está bloqueada, el login responde **429** con un mensaje que no revela si la
  contraseña era correcta: "Demasiados intentos. Espera 15 minutos o restablece tu
  contraseña."
- **Throttle por IP del login:** 10 por minuto.
- Correos inexistentes: siguen respondiendo el 401 genérico (no se bloquea lo que no existe).

## Alcance
- `apps/api/src/db/schema/tenant.ts` (tabla `usuario`): `intentos_fallidos integer not null
  default 0` y `bloqueado_hasta timestamptz null`, con su migración generada.
- `apps/api/src/auth/auth.service.ts` (`login`).
- `apps/api/src/auth/auth.controller.ts` (`@Throttle` en `login`).
- `apps/api/src/auth/credenciales.service.ts` (reiniciar el contador al restablecer).
- Pruebas: `apps/api/src/auth/*.spec.ts`; E2E `apps/web/e2e/specs/01-auth/*` si hace falta.
- Frontend: solo el texto del error 429 en la pantalla de login, si hoy muestra algo
  confuso.

## Fuera de alcance
- Mover los tokens de `localStorage` a cookies (posterior al piloto).
- 2FA, captcha, política de contraseñas (hoy mínimo 8; se deja igual).

## Pasos 🤖
1. **Pruebas primero** (en `auth.e2e.spec.ts` o un spec nuevo `auth/bloqueo.spec.ts`):
   - 5 contraseñas malas → el 6.º intento, incluso con la contraseña **correcta**, da 429.
   - Simulando el paso de 15 minutos (actualizar `bloqueado_hasta` en la BD al pasado), la
     contraseña correcta entra y el contador queda en 0.
   - 3 malas + 1 buena + 3 malas → no bloquea (el éxito reinicia).
   - Restablecer la contraseña desbloquea y pone el contador en 0.
   - Un correo inexistente siempre da 401, nunca 429.
2. Agregar las columnas y generar la migración (aditiva).
3. En `login()`:
   - Si `bloqueado_hasta > now()` → `HttpException(429)` con el mensaje de arriba, **antes**
     de verificar la contraseña con argon2.
   - Contraseña mala: `UPDATE usuario SET intentos_fallidos = intentos_fallidos + 1`, y si
     llega a 5: `bloqueado_hasta = now() + interval '15 minutes'`, `intentos_fallidos = 0`.
     Hacerlo en **un solo UPDATE atómico** (con `CASE`) para que dos intentos simultáneos no
     se pisen.
   - Contraseña buena: poner `intentos_fallidos = 0` y `bloqueado_hasta = null`.
   - Registrar la métrica `login_bloqueados` en `METRICAS` (nombre canónico nuevo).
4. `@Throttle({ default: { limit: 10, ttl: 60_000 } })` en el endpoint de login.
5. En el restablecimiento de contraseña (`credenciales.service.ts`, donde ya se revocan los
   refresh tokens): también reiniciar `intentos_fallidos` y `bloqueado_hasta`.
6. **Revisión, sin cambiar si ya está bien:** confirmar con una prueba que cambiar o
   restablecer la contraseña revoca **todas** las sesiones abiertas (refresh tokens) del
   usuario. El código parece hacerlo (`credenciales.service.ts` líneas ~99 y ~215); si
   falta una prueba que lo cubra, agregarla.
7. Front: si el 429 se ve como un error genérico en `/login`, mostrar el mensaje que manda
   la API.
8. Gate + `pnpm --filter web e2e -- e2e/specs/01-auth`.

## ✅ Criterio de hecho
- Pruebas del paso 1 en verde; ninguna otra en rojo.
- Con la API local: 6 logins seguidos con contraseña mala → el 6.º responde 429.

## Qué quedó hecho
**Cerrada el 12-nov-2026 (ORK-67).**

**API**
- `usuario.intentos_fallidos` (int, default 0) y `usuario.bloqueado_hasta` (timestamptz).
  Migración `0027_tired_mysterio.sql`, **aditiva**.
- **Login:** si `bloqueado_hasta` es futuro, responde 429 **antes** de verificar la
  contraseña. Cada contraseña mala hace **un solo UPDATE atómico** con `CASE`: al llegar a 5
  fija 15 minutos de bloqueo y pone el contador en 0. Un login correcto lo limpia todo.
- **Desvío menor del plan:** el plan decía "el 6.º intento da 429". Quedó **el 5.º intento
  fallido ya responde 429**, para que el dueño de la cuenta se entere en ese momento. El
  criterio ("al 6.º no entra") se sigue cumpliendo. Con `curl`: intentos 1–4 → 401,
  5 y 6 → 429.
- El mensaje del 429 no revela si la contraseña era correcta. Los correos inexistentes
  siempre dan 401.
- **Restablecer la contraseña** (`credenciales.service.ts`) pone el contador en 0 y quita
  el bloqueo.
- Métrica nueva `login_bloqueados`.
- `@Throttle` del login: **10/min por IP** con `limitePublico`, importado de
  `agendamiento/public-agendamiento.controller.ts` (FASE-01). Hereda `THROTTLE_LIMIT` si se
  subió.
- **Paso 6 (revisión):** cambiar y restablecer la contraseña ya revocaban **todas** las
  sesiones, y ya había pruebas que lo cubren (`auth.e2e.spec.ts`: "olvido → enlace → nueva
  contraseña → sesiones viejas revocadas" y "cambiar contraseña exige la actual y revoca
  las sesiones"). Sin cambios.

**Web**
- La pantalla "Acceso bloqueado temporalmente" ya existía, pero contaba 4:54. Ahora cuenta
  **15:00**, igual que la API, y tiene el botón **"Restablecer contraseña"**, que desbloquea
  de inmediato.

**Fuera del alcance listado (mínimo):** `observability/metrics.service.ts`, solo para
registrar `login_bloqueados`, como pedía el paso 3.

**Pruebas**
- Spec nuevo `auth/bloqueo.spec.ts` con **6 pruebas** HTTP. Se escribió primero y falló
  antes de implementar. Cubre: bloqueo, expiración, reinicio por login correcto,
  desbloqueo por restablecimiento, correo inexistente y 5 intentos en paralelo.
- **Gate:** typecheck ✓ · lint 0 warnings ✓ · Jest **433/433** ✓ · build web ✓.
- **E2E `01-auth`:** 17/17 ✓.

## Hallazgos para fases futuras
- `limitePublico` vive en el controlador público de agendamiento y ahora lo usa también
  auth. Conviene moverlo a `common/` (refactor post-piloto, sin cambiar comportamiento).
- La prueba del bloqueo de la guía (Parte E, E7) debe hacerse con un usuario de prueba,
  nunca con el del dueño: lo deja 15 minutos fuera, salvo que restablezca la contraseña.
