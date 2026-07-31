# PLAN-CORREO · Correo transaccional (SendGrid) y ciclo de vida de credenciales — Orkalis

> **Para quién es este documento.** Para el dueño del producto (EL USUARIO) y para la IA ejecutora. Diseña e implementa el **servicio de correo electrónico con SendGrid** y los **cuatro flujos de credenciales** que dependen de él: verificación de correo en el alta, recuperación de contraseña, gestión de credenciales en Configuración e invitación de especialistas por correo.
>
> **Regla de oro:** este es el PLAN. **No se escribe código hasta que EL USUARIO apruebe.** La implementación es **fase por fase** (E1…E7); no se avanza de fase si su verificación no pasa.
>
> **Estado del análisis:** completo. Basado en el código real tras el pull `8327769` (alta-wizard de 7 pasos, outbox de notificaciones, verificación de especialista por Twilio Verify, guards de auth).

---

## 0. Decisiones de producto (a confirmar por EL USUARIO)

| # | Decisión | Propuesta |
|---|----------|-----------|
| D1 | **Dónde corta el alta la verificación** | Entre el Paso 2 (Cuenta) y el Paso 3 (Sucursal) del wizard `/alta`, como pidió EL USUARIO. El backend **exige** en `POST /auth/registro` una verificación de correo vigente — la regla vive en el servidor, no solo en la UI. |
| D2 | **Transporte de los correos** | Todos los correos de auth viajan por el **outbox existente** (tabla `mensaje`, worker con reintentos 30/60/120 s, canal `email` exento de la pausa de Twilio). Nada de envíos "sueltos" sin auditoría. |
| D3 | **Tokens de un solo uso** | Tabla nueva `token_accion`: token aleatorio de 32 bytes (base64url) enviado en el enlace, **solo el hash SHA-256 se persiste** (mismo principio que `refresh_token` guarda el jti, no el token). Un uso, con TTL por tipo. |
| D4 | **El especialista se auto-registra** | El admin captura solo datos básicos (nombre, apellidos, especialidad, foto, servicios, sucursales/disponibilidad, notas) **+ el correo**. El especialista, desde el enlace de invitación: ① crea su contraseña, ② pone su celular y confirma el código SMS. El admin ya no escribe ni contraseña ni celular. |
| D5 | **SMS del especialista sin mensajería** | Si la mensajería está pausada (`sinMensajes()`), el paso del celular en la invitación **se pospone**: el especialista entra con su contraseña y verifica el celular después desde su panel. No se bloquea el acceso por un SMS que no puede salir. |
| D6 | **Variables de entorno** | Railway ya tiene `SENDGRID_API_KEY` y `FROM_EMAIL`. El código hoy lee `MAIL_FROM` → se acepta **`FROM_EMAIL` como alias** (sin tocar Railway). Se añade **`APP_URL`** (base de los enlaces de los correos) con fallback a `CORS_ORIGIN`. |
| D7 | **Anti-enumeración** | "¿Olvidaste tu contraseña?" responde **siempre 204**, exista o no el correo. La verificación del alta sí puede responder 409 "ya existe una cuenta" (ahí el usuario está tecleando SU correo, y hoy ese conflicto ya se revela en el paso 6 — solo lo adelantamos al paso 2). |
| D8 | **Al cambiar la contraseña** | Se **revocan todas las familias de refresh tokens** del usuario (cierra sesiones en otros dispositivos), tanto en reset por correo como en cambio desde Configuración. |

---

# PARTE I — DIAGNÓSTICO

## 1.1 Lo que YA existe (no se reescribe)

- **`@sendgrid/mail` instalado** (`apps/api/package.json:32`) y **`SendgridEmailAdapter` implementado** (`notificaciones/adapters/sendgrid-email.adapter.ts`), registrado en el factory si hay `SENDGRID_API_KEY && MAIL_FROM` (`notificaciones.module.ts:63-65`), con `MockAdapter` de fallback (en dev sin claves, los correos salen al log).
- **Outbox durable**: tabla `mensaje` con `canal='email'`, `asunto`, `proveedorId` (x-message-id), estados, reintentos con backoff, `FOR UPDATE SKIP LOCKED`. El canal email **no consume crédito Twilio** y **sigue saliendo con la mensajería pausada** (`outbox.worker.ts:121-131`).
- **Patrón de token de un solo uso**: `refresh_token` (jti + familia + revocación en cascada, `auth.service.ts:191-226`).
- **Patrón "borrador antes de crear"**: `verificacion_especialista` (el especialista no existe hasta confirmar el código; password ya hasheada en el borrador jsonb).
- **Twilio Verify** para OTP de celular (`verify.port.ts`, mock `123456`), con cupo del plan verificado ANTES de gastar el SMS.
- **Guards**: `@Public()`, `@Roles()`, throttling por endpoint; gotcha documentado: un endpoint público dentro de un controller con `@Roles` de clase devuelve 403 → **clase aparte** (patrón `EspecialistaFotoController`).

## 1.2 Lo que NO existe (lo que se construye)

1. Ningún campo `email_verificado_en` en `usuario`; ninguna tabla de tokens de acción.
2. El adaptador SendGrid envía **solo texto plano** — sin `html`.
3. "¿Olvidaste tu contraseña?" es un `<a href="#">` muerto (`LoginPage.tsx:150-152`).
4. Configuración no tiene sección de credenciales; `UsuariosService.editar` no acepta ni password ni email.
5. El alta de especialista exige que el **admin** teclee celular y contraseña (modal OTP en `EquipoScreen.tsx`).
6. No hay `APP_URL` para construir enlaces; `mensaje.negocio_id` es NOT NULL (y la verificación del alta ocurre **antes** de que exista el negocio).

---

# PARTE II — ARQUITECTURA

## 2.1 Módulo nuevo: `apps/api/src/correo/`

```
correo/
├── correo.module.ts            # importa NotificacionesModule (encolado) y DbModule
├── token-accion.service.ts     # crear / validar / consumir tokens de un solo uso
├── correo-auth.service.ts      # orquesta los 4 flujos (compone token + plantilla + encolado)
├── templates-email.ts          # layout base HTML responsive + 4 plantillas
└── dto/correo.dto.ts
```

El módulo **no habla con SendGrid**: encola en el outbox (`canal:'email'`) y el worker despacha con el adaptador que toque (SendGrid real o mock). Los endpoints viven donde su dominio: los de auth en `auth.controller.ts`, los de invitación en `negocio/`.

## 2.2 Tabla nueva `token_accion` (migración 0022)

```sql
CREATE TABLE token_accion (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo         text NOT NULL,          -- 'alta_email' | 'reset_password' | 'cambio_email' | 'invitacion_especialista'
  token_hash   text NOT NULL UNIQUE,   -- sha256(token); el token solo viaja en el enlace
  email        text NOT NULL,          -- destino (lowercased)
  usuario_id   uuid REFERENCES usuario(id) ON DELETE CASCADE,      -- null en alta_email
  negocio_id   uuid REFERENCES negocio(id) ON DELETE CASCADE,      -- null en alta_email
  payload      jsonb,                  -- p.ej. { nuevoEmail } o { especialistaId }
  expira_en    timestamptz NOT NULL,
  usado_en     timestamptz,            -- un solo uso
  reenvios     integer NOT NULL DEFAULT 0,
  ultimo_envio timestamptz NOT NULL DEFAULT now(),
  creado_en    timestamptz NOT NULL DEFAULT now()
);
```

- Acceso **solo por `adminDb`** (cross-tenant, igual que `refresh_token`): RLS que niega todo al rol `orkalis_app` (patrón de `mensajeria_saldo`).
- **TTLs**: `alta_email` 24 h · `reset_password` 60 min · `cambio_email` 24 h · `invitacion_especialista` 7 días.
- **Reenvío**: cooldown 60 s, máx. 5 reenvíos (regenera token y re-expira; invalida el anterior).
- Al **iniciar** un flujo se invalidan los tokens vigentes del mismo `(tipo, email)` — nunca hay dos enlaces válidos a la vez.
- Limpieza de vencidos en el tick del worker (mismo lugar donde ya se expiran `verificacion_especialista`).

## 2.3 Cambios al outbox (mínimos)

- **`mensaje.negocio_id` pasa a nullable** (migración): la verificación de correo del alta ocurre antes de que exista el negocio. Las filas con `negocio_id IS NULL` solo las ve `adminDb` (la política RLS por tenant ya no las matchea) y se insertan por una nueva vía `encolarEmailPlataforma()` en `NotificacionesService`.
- **`MensajeSalida` gana `html?: string`** y el `SendgridEmailAdapter` envía `{ to, from, subject, text, html }` (text = fallback plano). El mock loguea el asunto y el enlace.
- **Tipos nuevos** de mensaje (columna `tipo` es text libre, sin migración de enum): `'alta_email' | 'reset_password' | 'cambio_email' | 'invitacion'`. Todos `transaccional: true`.

## 2.4 Variables de entorno (`env.validation.ts` + `.env.example`)

| Var | Regla |
|---|---|
| `SENDGRID_API_KEY` | ya existe, opcional (sin ella → mock) |
| `MAIL_FROM` / **`FROM_EMAIL`** | alias: `MAIL_FROM ?? FROM_EMAIL`. Railway ya tiene `FROM_EMAIL=orkalis.corporation@orkalis.com` — no se toca nada allá |
| **`APP_URL`** (nueva) | base de los enlaces (`https://…`); fallback: primer origen de `CORS_ORIGIN` |

## 2.5 Plantillas HTML (`templates-email.ts`)

Layout base único, responsive (tabla de 600 px, CSS inline, botón CTA grande, funciona en Gmail/Outlook), con la marca Orkalis (logo texto + navy del design system) y pie con "si no fuiste tú, ignora este correo". Cuatro plantillas:

1. **Verifica tu correo** (alta): saludo con nombre, botón "Confirmar mi correo", aviso de 24 h.
2. **Restablece tu contraseña**: botón "Crear nueva contraseña", aviso de 60 min y de un solo uso.
3. **Confirma tu nuevo correo**: explica que alguien pidió cambiar el correo de la cuenta al destino actual.
4. **Te invitaron a {negocio}**: nombre del negocio, quién invita, botón "Activar mi cuenta", aviso de 7 días.

Cada plantilla exporta `{ asunto, html, texto }`; el enlace es `${APP_URL}/<ruta>?token=<token>`.

## 2.6 Rutas públicas nuevas del frontend (`App.tsx`, lazy, antes del catch-all)

| Ruta | Página | Flujo |
|---|---|---|
| `/verificar-correo` | `VerificarCorreoPage` | destino del enlace del alta y del cambio de correo (`?token=`) |
| `/restablecer` | `RestablecerPage` | formulario de nueva contraseña (`?token=`) |
| `/invitacion` | `InvitacionPage` | activación del especialista (`?token=`) |

(`/recuperar` ya está tomado por la recuperación de suscripción — no se toca.)

---

# PARTE III — LOS CUATRO FLUJOS

## Flujo 1 · Verificación de correo en el alta (Paso 2 → Paso 3)

**Endpoints** (en `auth.controller.ts`, `@Public()` + throttle):

| Endpoint | Body → Respuesta |
|---|---|
| `POST /auth/alta/verificacion` (5/60s) | `{ email, nombre }` → `{ verificacionId }`. 409 si ya existe cuenta con ese correo. Crea token `alta_email`, encola el correo. |
| `POST /auth/alta/verificacion/reenviar` (5/60s) | `{ verificacionId }` → 204. Cooldown 60 s. |
| `GET /auth/alta/verificacion/:id` (30/60s) | → `{ verificado: boolean }` (para el polling del wizard; no filtra el email). |
| `POST /auth/verificar-correo` (10/60s) | `{ token }` → `{ ok, contexto: 'alta' \| 'cambio_email' }`. Marca `usado_en`. Compartido con el Flujo 3. |

**Cambio en `POST /auth/registro`**: el DTO gana `verificacionId` obligatorio; `AuthService.registrar()` valida que exista un token `alta_email` **usado** (verificado), no expirado (ventana de 24 h tras verificar) y cuyo `email` coincida con `admin.email` → si no, 403 "Verifica tu correo antes de crear la cuenta". El token se consume definitivamente al registrar (no sirve para dos registros). `usuario` gana columna **`email_verificado_en timestamptz`** y el registro la estampa.

**Wizard `/alta`** (`alta-wizard.tsx`):

- Al pulsar "Continuar" en el Paso 2 (válido): llama `POST /auth/alta/verificacion` y entra a un **sub-estado de espera** dentro del mismo paso: "📬 Revisa tu bandeja de entrada — te enviamos un enlace a **{email}**", con botón "Reenviar" (cooldown visible) y "Cambiar correo" (vuelve al formulario).
- **Polling** de `GET /auth/alta/verificacion/:id` cada 4 s; al verificarse → avanza al Paso 3 automáticamente ("¡Correo confirmado!").
- El usuario abre el enlace (misma u otra pestaña/celular) → `/verificar-correo?token=` confirma y muestra "Listo. Vuelve a la pestaña del registro para continuar."
- `crearCuenta()` añade `verificacionId` al payload de `registrar()`. Si expira antes del paso 6, el error 403 regresa al usuario al sub-estado de verificación.

## Flujo 2 · "¿Olvidaste tu contraseña?"

**Endpoints** (`@Public()` + throttle):

| Endpoint | Body → Respuesta |
|---|---|
| `POST /auth/password/olvido` (5/60s) | `{ email }` → **siempre 204** (D7). Si el usuario existe y está activo: token `reset_password` (60 min) + correo. |
| `GET /auth/password/token/:token` (10/60s) | → `{ valido: boolean }` (la página valida antes de mostrar el formulario). |
| `POST /auth/password/restablecer` (5/60s) | `{ token, password }` → 204. Consume el token, `argon2.hash`, **revoca todas las familias de refresh** del usuario (D8) y estampa `email_verificado_en` si era null (abrió un enlace de su correo → correo probado). |

**Frontend**:

- `LoginPage.tsx`: el enlace muerto pasa a abrir una **vista inline** en la misma tarjeta (estado `vista: 'olvido'`): campo de correo → "Enviar enlace" → mensaje neutro "Si el correo existe, te llegará un enlace en unos minutos" (reutiliza `LoginField`).
- `/restablecer?token=`: valida el token al montar (inválido/vencido → mensaje + botón "Pedir otro enlace"); formulario nueva contraseña + confirmación (min 8) → éxito → "Contraseña actualizada" → botón a `/login`.

## Flujo 3 · Credenciales en Configuración

**Endpoints** (autenticados, cualquier rol — operan sobre el propio usuario de la sesión):

| Endpoint | Body → Respuesta |
|---|---|
| `POST /auth/password/cambiar` (5/60s) | `{ passwordActual, passwordNueva }` → 204. `argon2.verify` de la actual (401 si falla), hash de la nueva, revoca las **demás** familias de refresh (la sesión actual sigue viva). |
| `POST /auth/email/cambio` (3/60s) | `{ password, nuevoEmail }` → 204. Valida password, 409 si `nuevoEmail` ya existe, token `cambio_email` con `payload:{ nuevoEmail }` y correo **a la dirección nueva**. El email de la cuenta **no cambia todavía**. |
| `GET /auth/email/cambio` | → `{ pendiente: string \| null }` (dirección pendiente de confirmar, para pintar el estado). |
| `DELETE /auth/email/cambio` | → 204 (cancela la solicitud pendiente). |

La confirmación reutiliza `POST /auth/verificar-correo` (`contexto:'cambio_email'`): al validar el token consolida `usuario.email = payload.nuevoEmail` (re-chequeando unicidad), estampa `email_verificado_en` y avisa con un correo informativo a la dirección anterior.

**Frontend**: sección nueva **"Cuenta"** en `ConfigScreen.tsx` (`SECCIONES` + componente `ConfigCredenciales` en `config-cuenta.tsx`):

- Tarjeta "Cambiar contraseña": actual + nueva + confirmación.
- Tarjeta "Correo de acceso": correo actual (+ badge "verificado" si `email_verificado_en`), botón "Cambiar correo" → password + nuevo correo → estado "Pendiente de confirmación: **x@y.com** · Reenviar · Cancelar".
- `GET /auth/me` expone `email` y `emailVerificadoEn` en `SesionUsuario` (hoy no viaja el email).

## Flujo 4 · Invitación de especialistas por correo

**Alta (admin)** — el formulario de `EquipoScreen.tsx` queda: nombre, apellidos, especialidad, foto, sucursales, servicios, disponibilidad, notas y **correo (obligatorio)**. Desaparecen celular, contraseña y el modal del código OTP.

| Endpoint | Qué hace |
|---|---|
| `POST /especialistas/invitar` (Admin, 5/60s) | Valida cupo del plan y unicidad del correo → **crea el especialista ya** (sin teléfono, `disponible` según el form) con sucursales/servicios → token `invitacion_especialista` (7 días, `payload:{ especialistaId }`) → encola el correo. Devuelve el especialista + `invitacionPendiente: true`. Así la foto se puede subir de inmediato (necesita id) y el especialista aparece en el equipo con badge "Invitación enviada". |
| `POST /especialistas/:id/invitacion/reenviar` (Admin) | Regenera token + correo (cooldown 60 s). |
| `GET /public/invitacion/:token` (`@Public`, **clase aparte** por el gotcha de `RolesGuard`) | → `{ nombre, negocio, email, estado }` para pintar la página. |
| `POST /public/invitacion/:token/activar` | `{ password }` → crea el `usuario` rol Especialista (reutiliza `crearOEnlazarLogin` de `equipo.service.ts`), estampa `email_verificado_en`, consume el token y **devuelve `TokenPair`** (queda logueado para el paso del celular). |
| `POST /especialistas/mi/telefono/iniciar` (rol Especialista, 5/60s) | `{ celular }` → normaliza `+573…`, `verify.start()` (Twilio Verify o mock). Si `sinMensajes()` → 409 `{ codigo:'SIN_MENSAJERIA' }` y el front ofrece "verificar más tarde" (D5). |
| `POST /especialistas/mi/telefono/confirmar` (rol Especialista, 10/60s) | `{ codigo }` → `verify.check()` → estampa `especialista.telefono` + `telefonoVerificadoEn`. |

**Página `/invitacion?token=`** (3 pasos con el `Stepper` de `onboarding-ui.tsx`):
1. **Bienvenida + contraseña**: "Hola {nombre}, {negocio} te invitó a Orkalis" → crear contraseña (min 8, doble entrada) → activa y guarda `TokenPair`.
2. **Tu celular**: input +57 → enviar código → 6 dígitos (reusa el patrón del diálogo actual). Enlace "Lo haré después" (y automático si `SIN_MENSAJERIA`).
3. **Listo** → botón "Entrar a mi panel" → `/especialista`.

**Panel del especialista**: si `telefonoVerificadoEn` es null, banner en `perfil` "Verifica tu celular para recibir avisos de tus citas" que reusa los endpoints `mi/telefono/*` (los avisos ya se saltan a quien no tiene teléfono verificado — `avisos-especialista.service.ts:49`).

**Qué pasa con el flujo viejo**: los endpoints `POST /especialistas/verificacion/*` (OTP del admin) y el alta directa con `credenciales` quedan **deprecados**: se retiran del frontend y del formulario; el código backend se elimina en esta misma fase junto con sus specs (se reemplazan por specs del flujo nuevo). `EquipoScreen` muestra el estado por especialista: "Invitación enviada hace 2 días · Reenviar" / "Activo desde …" / "Celular sin verificar".

---

# PARTE IV — FASES DE EJECUCIÓN

| Fase | Contenido | Verificación para cerrar |
|---|---|---|
| **E1 · Cimientos** | Env (`FROM_EMAIL` alias, `APP_URL`), migración 0022 (`token_accion`, `mensaje.negocio_id` nullable, `usuario.email_verificado_en`), `html` en puerto+adaptador SendGrid, `templates-email.ts` con las 4 plantillas, `TokenAccionService`, `encolarEmailPlataforma`. | Specs del servicio de tokens (hash, un uso, TTL, reenvío/cooldown, invalidación por tipo+email). Email mock visible en log con enlace bien formado. |
| **E2 · Verificación en el alta** | Endpoints `auth/alta/*` + `verificar-correo`, DTO de registro con `verificacionId`, candado en `registrar()`, sub-estado de espera + polling en el wizard, página `/verificar-correo`. | Spec: registro sin verificación → 403; con verificación → 201 y `email_verificado_en` estampado. E2E del alta actualizado. |
| **E3 · Olvido y restablecimiento** | Endpoints `auth/password/olvido|token|restablecer`, vista inline en `LoginPage`, página `/restablecer`. | Spec: 204 con email inexistente; token usado dos veces → 401; reset revoca refresh (el refresh viejo → 401). |
| **E4 · Credenciales en Configuración** | Endpoints `password/cambiar` + `email/cambio` (+ GET/DELETE), `email`+`emailVerificadoEn` en `/auth/me`, sección "Cuenta" en Config. | Spec: cambiar password con actual errada → 401; cambio de email consolida solo al confirmar; aviso al correo anterior encolado. |
| **E5 · Invitación de especialistas** | Endpoints de invitación + activación + `mi/telefono/*`, formulario nuevo de EquipoScreen (sin celular/password, correo obligatorio, badges de estado), página `/invitacion`, banner en panel del especialista, retiro del flujo OTP del admin. | Specs portados de `verificacion-especialista.spec.ts` al flujo nuevo (cupo antes de invitar, password nunca en claro, activación idempotente). E2E de equipo reescrito. |
| **E6 · Limpieza y expiración** | Job de limpieza de `token_accion` vencidos, retiro definitivo de código muerto del flujo viejo, `.env.example` y `DEPLOY.md` actualizados (`FROM_EMAIL`, `APP_URL` en Railway). | `pnpm build` + suite completa verde (API + web). |
| **E7 · E2E y humo en Railway** | Pasada E2E completa local (mock), despliegue y prueba de humo real: un alta con correo real, un reset y una invitación contra SendGrid productivo. | Los 3 correos reales llegan y los enlaces funcionan con `APP_URL` de producción. |

---

# PARTE V — RIESGOS Y BORDES

1. **Entregabilidad**: `orkalis.com` debe tener la autenticación de dominio de SendGrid (SPF/DKIM) hecha; si no, los correos de verificación caerán a spam y el alta se frena. Verificarlo en E7 antes del go-live (es configuración en SendGrid/DNS, no código).
2. **El enlace se abre en otro dispositivo**: cubierto por diseño (el wizard hace polling del estado, no depende de la pestaña del enlace).
3. **Doble clic / reuso de enlaces**: `usado_en` + respuesta idempotente ("este enlace ya se usó") sin filtrar información.
4. **E2E y dev sin claves**: `MockAdapter` ya cubre email; los E2E leerán el token de la tabla `mensaje` (el cuerpo del mock incluye el enlace) vía la fixture de API existente, igual que hoy se usa `CODIGO_VERIFY_MOCK`.
5. **Especialistas existentes** (creados con el flujo viejo): conservan teléfono verificado y login; el badge solo aplica a invitaciones nuevas. Sin migración de datos.
6. **`usuario.email` único global**: el 409 del cambio de correo y de la invitación se apoya en el índice existente (`usuario_email_uq`) — sin condiciones de carrera.
