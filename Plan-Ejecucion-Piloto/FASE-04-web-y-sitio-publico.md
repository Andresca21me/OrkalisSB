# FASE-04 · Web y sitio público (orkalis.com)

> Parte de `PLAN-PILOTO.md`. Abre ese archivo + este. Prioridad 🟡: antes de la
> publicidad. No bloquea el piloto.

## Problema
1. **Sin cabeceras de seguridad en la web.** `apps/web/Caddyfile` sirve el SPA sin CSP,
   HSTS, `X-Frame-Options` ni `Referrer-Policy`. Los tokens de sesión viven en
   `localStorage` (`apps/web/src/lib/api.ts`). Si algún día se cuela un XSS, se roban
   sesiones. Una CSP estricta es la defensa más barata mientras se migra a cookies.
2. **Páginas maqueta con datos falsos.** `/checkout` y `/bienvenida`
   (`pages/site/site-funnel.tsx`, enrutadas en `SiteApp.tsx`) muestran "Activa" y
   "Próximo cobro en 14 días" fijos en el código, con `TODO(v-next)` pendientes. Cuando
   empiece la publicidad, alguien puede caer ahí.
3. **Precios del sitio calculados aparte.** `site-pages.tsx` (línea ~379) y `site-data.ts`
   usan una fórmula local con un `TODO` de "sustituir por el cálculo real". Si no coincide
   con `plan-registry.ts` del backend, el sitio promete un precio y se cobra otro.

## Alcance
- `apps/web/Caddyfile`
- `apps/web/src/pages/site/SiteApp.tsx`, `site-funnel.tsx`, `site-pages.tsx`, `site-data.ts`
- Prueba de precios: un spec nuevo en `packages/shared` o en `apps/api/src/plans/`.
- E2E `apps/web/e2e/specs/14-sitio/*`.

## Fuera de alcance
- Migrar los tokens a cookies `httpOnly`.
- Rediseño del sitio o del texto comercial.

## Pasos 🤖
1. **Inventario de orígenes externos.** Buscar en `apps/web/src` y `index.html` todo lo
   que se carga de fuera: SDK de Mercado Pago (`checkout-mp.tsx`), fuentes, imágenes y la
   API (`VITE_API_URL`). Con esa lista se arma la CSP; no se adivina.
2. **Cabeceras en Caddy** (bloque `header` global):
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `X-Frame-Options: DENY`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   - **`Content-Security-Policy-Report-Only`** con `default-src 'self'`, los orígenes del
     paso 1, `img-src 'self' data: blob:` + la API, `style-src 'self' 'unsafe-inline'` (la
     app usa estilos en línea) y `frame-ancestors 'none'`. Va en **Report-Only** durante el
     piloto: el navegador avisa las violaciones en la consola pero no bloquea nada. Pasar a
     modo estricto es una fase posterior, cuando la Parte H de la guía confirme que la
     consola está limpia.
3. **Verificar las cabeceras localmente:** construir la imagen web
   (`docker build -f apps/web/Dockerfile .`) o, si Docker no está disponible, correr Caddy
   con el `Caddyfile`. Comprobar con `curl -I` que salen todas. Si no hay forma de correr
   Caddy en el entorno, validar la sintaxis con `caddy validate` y dejarlo anotado para la
   prueba de humo de Andrés.
4. **Páginas maqueta:** averiguar si algún flujo real lleva a `/checkout` o `/bienvenida`.
   El alta real es `/alta` (`alta-wizard.tsx`) y el pago real es `checkout-mp.tsx`.
   - Si nada real lleva ahí: quitar las rutas y redirigir `/checkout` y `/bienvenida` a
     `/alta` (los enlaces viejos no dan 404).
   - Si algo real lleva ahí: **parar y reportar**; no se inventa un flujo nuevo.
5. **Precios:** escribir una prueba que, para cada plan y para 1–5 especialistas, compare
   el precio que muestra el sitio (función de `site-data.ts`) con `calcularCargo` del
   backend. Si difieren, hacer que el sitio use el cálculo compartido
   (`@orkalis/shared` o el catálogo `GET /suscripcion/planes`) y quitar el `TODO`.
6. Gate + `pnpm --filter web e2e -- e2e/specs/14-sitio`.

## ✅ Criterio de hecho
- `curl -I` sobre la web local (o la validación de Caddy) muestra las cabeceras.
- No quedan rutas del sitio con datos de suscripción inventados.
- La prueba de precios está en verde.

## Qué quedó hecho
_(Claude lo completa.)_

## Hallazgos para fases futuras
_(Claude anota aquí.)_
