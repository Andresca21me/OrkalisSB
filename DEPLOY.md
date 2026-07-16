# Despliegue de Orkalis (FASE-14, ADR-008)

Guía **paso a paso** para desplegar **todo en Railway**: base de datos
(PostgreSQL gestionado), **API** (NestJS, contenedor Docker) y **frontend**
(React/Vite estático servido con Caddy). Tres servicios en **un solo proyecto**.

> ⚠️ **Acción del USUARIO.** El primer deploy a `prod` y la activación de llaves
> **reales** (Twilio / Mercado Pago) son **irreversibles y de cara al público**.
> Claude deja todo listo (Dockerfiles, `railway.json`, migraciones, esta guía)
> pero **no** ejecuta el primer deploy ni pega llaves reales sin tu confirmación.

## 0. Qué se despliega (mapa)

```
Proyecto Railway "orkalis"
 ├─ Postgres            (plugin gestionado, con backups)
 ├─ API   (Docker)      apps/api/Dockerfile  ·  arranca migrando + main.js  ·  /api/health
 └─ Web   (Docker+Caddy) apps/web/Dockerfile ·  sirve apps/web/dist (SPA)
```

Artefactos ya listos en el repo:
- `apps/api/Dockerfile` + `apps/api/railway.json` (build Docker, start = migrar + API).
- `apps/web/Dockerfile` + `apps/web/Caddyfile` + `apps/web/railway.json` +
  `apps/web/Dockerfile.dockerignore` (build estático servido con Caddy, con
  fallback SPA y cache de assets).
- Migrador Drizzle en `dist/db/migrate.js` (no necesita `drizzle-kit`).

El **CI** (`.github/workflows/ci.yml`) es el **gate** (RNF-016): typecheck + lint +
pruebas de API (aislamiento y concurrencia) + migraciones + build del frontend +
**E2E por rol (Playwright)** contra la API real. Si el CI falla, no se despliega.

---

## 1. Crear el proyecto y la base de datos

1. En [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**,
   selecciona este repositorio. Autoriza el acceso a Railway.
2. **Add** → **Database** → **PostgreSQL**. Railway crea la instancia y expone
   `DATABASE_URL` (rol dueño) en las variables de ese servicio.
3. Activa **backups** en el plugin de Postgres (RPO ≤ 1h, RTO ≤ 4h — RNF-007) y
   haz al menos **una restauración de prueba** antes de mostrar al cliente.
4. (Opcional) La cola de notificaciones es **en proceso** en v1
   (`src/notificaciones/job-queue.ts`); no necesitas Redis todavía.

## 2. Roles de base de datos (RLS — FASE-04)

La app se conecta con un rol **sin superusuario** (`orkalis_app`) para que la RLS
multi-tenant **siempre** aplique. Las migraciones/seed usan el rol **dueño**.

- `DATABASE_URL_ADMIN` = la cadena que da Railway (rol dueño). La usan las migraciones.
- `DATABASE_URL` = cadena del rol **`orkalis_app`**. La migración `0002` crea ese rol.
  **En producción cambia su contraseña** (no reutilices la de desarrollo): tras la
  primera migración, ejecuta una vez en la consola SQL de la BD:
  ```sql
  ALTER ROLE orkalis_app PASSWORD '<secreto-fuerte>';
  ```
  y compón `DATABASE_URL` con ese usuario/clave apuntando al **mismo host/puerto/BD**
  que `DATABASE_URL_ADMIN` (p. ej. `postgres://orkalis_app:<secreto>@<host>:<port>/<db>`).

> Truco: puedes usar la referencia de Railway para el host/puerto/BD y solo cambiar
> usuario y contraseña. Nunca pongas estos valores en el repo (RNF-012).

## 3. Servicio API (backend)

1. **Add** → **GitHub Repo** (el mismo). En **Settings** del servicio:
   - **Config-as-code**: Railway detecta `apps/api/railway.json` → builder **Dockerfile**
     (`apps/api/Dockerfile`), start `node dist/db/migrate.js && node dist/main.js`,
     healthcheck `/api/health`. Si no lo detecta, apúntalo a mano.
2. **Variables** del servicio API (solo aquí, nunca en el repo):

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | lo inyecta Railway (no lo fijes) |
   | `CORS_ORIGIN` | dominio público del frontend (ver §5), sin barra final |
   | `DATABASE_URL` | rol `orkalis_app` (ver §2) |
   | `DATABASE_URL_ADMIN` | rol dueño (la que da Railway) |
   | `JWT_ACCESS_SECRET` | secreto largo (`openssl rand -base64 48`) |
   | `JWT_REFRESH_SECRET` | **otro** secreto largo distinto |
   | `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | opcionales (120 req/min por IP por defecto) |
   | `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | SMS real (ver §7). Sin ellas → mock (no envía) |
   | `MP_ACCESS_TOKEN` | Mercado Pago privado del backend (`APP_USR-…` en prod) |
   | `MP_PUBLIC_KEY` | Mercado Pago público (`APP_USR-…`); igual valor que `VITE_MP_PUBLIC_KEY` |
   | `MP_WEBHOOK_SECRET` | clave del webhook (verifica `x-signature`) |
   | `MP_ENV` | `production` (o `sandbox` para demo) |

   Genera los dos secretos JWT:
   ```bash
   openssl rand -base64 48   # JWT_ACCESS_SECRET
   openssl rand -base64 48   # JWT_REFRESH_SECRET (distinto)
   ```
3. **Deploy**. El arranque aplica las migraciones con `DATABASE_URL_ADMIN` y luego
   levanta la API. El `seed` **no** corre en producción.
4. **Genera un dominio** (Settings → Networking → Generate Domain). Anótalo:
   será `https://<api>.up.railway.app`.

## 4. Migraciones en el arranque (ADR-004)

`apps/api/railway.json` arranca con `node dist/db/migrate.js && node dist/main.js`:
migra (migrador de `drizzle-orm`) y luego arranca. Si una migración falla, el
proceso no levanta y Railway reintenta (política `ON_FAILURE`). Revisa los logs
del primer deploy para confirmar `migraciones aplicadas`.

## 5. Servicio Web (frontend)

1. **Add** → **GitHub Repo** (el mismo). Railway detecta `apps/web/railway.json` →
   builder **Dockerfile** (`apps/web/Dockerfile`). Sirve el estático con Caddy en `$PORT`.
2. **Variables** del servicio Web (se **hornean en el build**, no en runtime):

   | Variable (build-time) | Valor |
   |---|---|
   | `VITE_API_URL` | URL pública de la API **con sufijo `/api`** → `https://<api>.up.railway.app/api` |
   | `VITE_MP_PUBLIC_KEY` | llave **pública** de Mercado Pago del entorno (misma que `MP_PUBLIC_KEY`) |

   > El Dockerfile las recibe como `ARG` y las expone a Vite. Al ser build-time,
   > **si cambias `VITE_API_URL` hay que re-desplegar** (rebuild), no basta reiniciar.
3. **Deploy** y **Generate Domain**. Anota `https://<web>.up.railway.app`.
4. **Cierra el círculo de CORS**: vuelve al servicio **API**, pon en `CORS_ORIGIN`
   el dominio exacto del frontend (`https://<web>.up.railway.app`, sin barra final)
   y re-despliega la API.

## 6. Verificación (que TODO funcione)

```bash
# API viva y BD lista
curl -s https://<api>.up.railway.app/api/health
curl -s https://<api>.up.railway.app/api/health/ready     # verifica conexión a BD

# CORS correcto (debe devolver el header Access-Control-Allow-Origin)
curl -I -H "Origin: https://<web>.up.railway.app" https://<api>.up.railway.app/api/health

# Frontend sirviendo el SPA
curl -sI https://<web>.up.railway.app | head -n 1          # 200 OK
```
Luego, en el navegador: abre el frontend, entra con un usuario, crea una cita y
comprueba que las llamadas a `/api/...` no dan CORS ni 401 espurios.

## 7. Twilio / Mercado Pago: pasar a real

> El SDK `twilio` **ya es dependencia** de `apps/api` (envío real de SMS). El
> cliente de Mercado Pago usa `fetch` directo (no necesita SDK). **Nota v1**: hoy
> solo el canal **SMS** está cableado para envío real (OTP del cliente y avisos por
> SMS). **WhatsApp y email** aún no envían de verdad — es el
> `Plan-Ejecucion-Mensajeria` pendiente de aprobar.

**Twilio (SMS real):**
1. Número con SMS habilitado para Colombia (cuenta paga; el trial solo envía a
   números verificados). Configura **geo-permissions → Colombia**.
2. Pega `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` en el
   servicio API y re-despliega. Sin estas variables, la API usa el **mock** (loguea,
   no envía) y todo lo demás sigue funcionando.

**Mercado Pago (cobro real):**
1. En tu app de Mercado Pago, obtén las credenciales **de producción** (`APP_USR-…`):
   `MP_ACCESS_TOKEN` (privada) y `MP_PUBLIC_KEY` (pública). Pon `MP_ENV=production`.
2. En el panel de Mercado Pago, apunta el **webhook** a
   `https://<api>.up.railway.app/api/pagos/webhook` y usa el mismo `MP_WEBHOOK_SECRET`.
3. `VITE_MP_PUBLIC_KEY` (servicio Web) debe ser la **misma** pública → re-deploy del Web.

> Sin `MP_ACCESS_TOKEN`, el cobro opera en modo **INACTIVO** (simula respuestas,
> no llama a la API real): útil para una demo sin cobrar. Ver
> `_GUIA-GO-LIVE-MERCADOPAGO.md` para el go-live completo.

## 8. Observabilidad

- `GET /api/health` (liveness) · `GET /api/health/ready` (readiness, verifica BD).
- `GET /api/metrics` (contadores de negocio + p95 por ruta).
- Logs **JSON** en producción (sin secretos/OTP). Configura alertas sobre el
  healthcheck y los 5xx; prioriza el presupuesto de error del enlace público (RNF-006).

## 9. Entornos

- `dev` (local, Docker Compose), y en Railway un entorno para el cliente
  (`staging`/`prod`). Cada uno con su **propia BD y sus secretos**.
- Recomendado: un entorno **demo/staging** para mostrar al cliente antes de `prod`.
- Promueve a `prod` solo cuando el CI esté verde y lo apruebes.
