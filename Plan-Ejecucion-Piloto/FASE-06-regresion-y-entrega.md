# FASE-06 · Regresión y entrega

> Parte de `PLAN-PILOTO.md`. Abre ese archivo + este. Prioridad 🔴: cierra el plan y deja
> la rama lista para que Andrés despliegue. Se ejecuta **dos veces**: el jue 12-nov (con
> 00–03) y después de 04–05 (segundo deploy).

## Objetivo
Probar todo junto, dejar la documentación de despliegue al día y entregarle a Andrés una
rama con la lista exacta de lo que cambia y de las variables nuevas.

## Alcance
- Solo documentación: `DEPLOY.md`, `CREDENCIALES-PENDIENTES.md`, `apps/api/.env.example`,
  este plan (tablero y "Qué quedó hecho").
- **Sin cambios de código.** Si la regresión encuentra un fallo, se vuelve a la fase que lo
  causó, se corrige ahí y se repite esta fase.

## Pasos 🤖
1. Base de datos local **desde cero** (borrar y crear), `db:migrate`, `db:seed`. Así se
   prueba que las migraciones nuevas aplican sobre una BD vacía.
2. **Migración sobre datos existentes:** restaurar la BD al estado de `main` (checkout de
   `main`, migrar y sembrar), volver a la rama y migrar encima. Comprobar que las citas
   previas tienen `token_gestion` y los usuarios `intentos_fallidos = 0`.
3. Gate completo + **suite E2E completa**. Todo en verde (en la primera pasada se tolera
   solo el CSV del análisis si FASE-05 aún no se hizo).
4. Prueba manual con `curl` de lo que corrigen las fases 01 a 03 (los comandos están en el
   "Criterio de hecho" de cada fase).
5. **Documentación:**
   - `DEPLOY.md`: corregir lo que quedó viejo. Hoy dice que WhatsApp "aún no envía de
     verdad" y que producción está en mock; en realidad WhatsApp está en producción desde
     agosto. Agregar `METRICS_TOKEN` y `TWILIO_WA_TPL_ENLACE_GESTION` (opcional) a la tabla.
   - `CREDENCIALES-PENDIENTES.md`: lo mismo y quitar los OTP de la lista.
6. **Nota de entrega** al final de este archivo (y en el chat): lista de commits, variables
   nuevas, migraciones que corren al arrancar y qué debe verificar Andrés en la prueba de
   humo.
7. Marcar el tablero de `PLAN-PILOTO.md`.

## ✅ Criterio de hecho
- Todo en verde sobre BD vacía y sobre BD migrada desde `main`.
- Nota de entrega escrita.
- Rama subida a GitHub (por Claude con acceso de push, o por Andrés en la Parte A/E).

## Nota de entrega
_(Claude la completa.)_
