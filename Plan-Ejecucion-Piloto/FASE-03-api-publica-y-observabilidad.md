# FASE-03 · API pública y observabilidad

> Parte de `PLAN-PILOTO.md`. Abre ese archivo + este. Prioridad 🔴.

## Problema
1. `GET /api/metrics` es público (`observability/metrics.controller.ts`, `@Public()`).
   Cualquiera ve cuántas reservas, logins y mensajes tiene la plataforma, y la latencia de
   cada ruta.
2. No hay forma sencilla de que Andrés se entere de errores durante el piloto: no existe un
   contador de respuestas 5xx ni una línea de log fácil de filtrar.
3. En producción hay 94 mensajes "entregados" para 93 "enviados" por WhatsApp. Causa
   desconocida; puede ser inofensiva.

## Decisión de diseño
- `/api/metrics` exige `Authorization: Bearer <METRICS_TOKEN>`. **Falla cerrado:** si
  `METRICS_TOKEN` no está definido, responde 404 en producción (en `test`/`development`
  sigue abierto para no romper las pruebas existentes).
- `/api/health` y `/api/health/ready` siguen públicos: los usa Railway y no revelan datos.
- Toda respuesta 5xx incrementa `errores_5xx` y deja un log JSON de nivel `error` con
  `ruta`, `status` y el id de la petición, **sin** el cuerpo ni datos personales. Así Andrés
  puede crear una alerta en Railway filtrando ese texto.

## Alcance
- `apps/api/src/observability/metrics.controller.ts`, `metrics.service.ts`,
  `logging.interceptor.ts` (o un filtro de excepciones global nuevo en `observability/`).
- `apps/api/src/config/env.validation.ts` (`METRICS_TOKEN`, opcional, mínimo 32 caracteres).
- `apps/api/.env.example`, tabla de variables de `DEPLOY.md` (solo agregar la fila).
- `apps/api/src/notificaciones/outbox.worker.ts`: **solo** si la investigación del paso 5
  encuentra un conteo doble real.
- Pruebas en `apps/api/src/observability/` y `health/`.

## Fuera de alcance
- Exportador Prometheus, Sentry u otra herramienta externa.
- Cambiar la forma de los contadores que ya existen.

## Pasos 🤖
1. **Pruebas primero:**
   - `NODE_ENV=production` sin `METRICS_TOKEN` → `GET /api/metrics` da 404.
   - Con `METRICS_TOKEN` definido: sin cabecera → 401; token incorrecto → 401; correcto → 200.
   - La comparación del token usa `timingSafeEqual` (prueba unitaria del helper).
   - Un endpoint que lanza un error no controlado → la respuesta es 500 y `errores_5xx`
     sube en 1.
2. Implementar un guard pequeño (`MetricsTokenGuard`) y usarlo en `MetricsController`.
   Mantener `@Public()` para que el guard JWT no pida sesión; la protección la da el
   guard nuevo.
3. Contador `errores_5xx` (nombre canónico en `METRICAS`) y log de error en el
   interceptor o filtro: formato JSON, **sin** body, headers ni teléfonos.
4. Variable `METRICS_TOKEN` en `env.validation.ts` (opcional, `min(32)`), `.env.example` y
   `DEPLOY.md`.
5. **Investigar** "entregados > enviados" con una prueba en `notificaciones.spec.ts`:
   enviar un WhatsApp y aplicar `delivered` y luego `read` (los dos mapean a `entregado`);
   comprobar que la métrica sube solo una vez. Revisar también el camino de degradación
   WhatsApp → SMS y el de reintento. Si hay conteo doble, corregirlo; si no, anotar la
   explicación en "Qué quedó hecho" y no tocar código.
6. Gate completo.

## ✅ Criterio de hecho
- Pruebas en verde.
- Con la API local en modo `production` y sin token: `curl localhost:3000/api/metrics` → 404.
- 🧑‍💻 Después del deploy: Andrés genera `METRICS_TOKEN` y lo carga en Railway
  (`_GUIA-MANUAL.md`, Parte E).

## Qué quedó hecho
_(Claude lo completa.)_

## Hallazgos para fases futuras
_(Claude anota aquí.)_
