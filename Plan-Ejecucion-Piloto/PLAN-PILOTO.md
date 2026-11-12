# Plan de Ejecución · Endurecimiento para el piloto (noviembre 2026)

> **Objetivo único:** cerrar las vulnerabilidades y los pulimientos que salieron de
> la auditoría del 11-nov-2026, para que la barbería piloto use Orkalis desde el
> **vie 13-nov** y el **enlace público de reservas** se abra a sus clientes el
> **sáb 14-nov** sin exponer datos de nadie.
>
> Punto de partida: `main` @ `2b69f78` (27-ago-2026). Rama de trabajo:
> **`piloto/endurecimiento`**, un commit por fase.

---

## 1. Cómo se usa este plan

- **Una fase por sesión de trabajo.** Al empezar, Claude lee **solo** este archivo y el
  de la fase que toca. No se adelanta trabajo de otra fase aunque "quede cerca".
- **Cada fase es autocontenida:** dice qué archivos toca, qué NO toca, los pasos en orden,
  las pruebas que hay que escribir y los comandos que deben quedar en verde.
- **`_GUIA-MANUAL.md`** contiene **todo lo que hace Andrés a mano** (Railway, Twilio,
  SendGrid, GitHub, configurar la barbería, capacitación, seguimiento del piloto).
  Se ejecuta de principio a fin, en orden; cada paso dice cuándo hacerlo.

Marcas usadas en las fases:
- 🤖 **Claude** — lo hace Claude en el código.
- 🧑‍💻 **Andrés** — está en `_GUIA-MANUAL.md` (las fases solo lo referencian).
- ✅ **Verificación** — comando o comprobación que debe pasar.

## 2. Reglas para Claude (anti-desvarío)

1. **No tocar archivos fuera del "Alcance" de la fase.** Si un cambio fuera del alcance
   parece necesario, se **anota** en la sección "Hallazgos para fases futuras" del archivo
   de la fase y se sigue sin hacerlo.
2. **Primero la prueba que falla, luego el arreglo** (cuando la fase lo indique).
3. **Gate de cada fase** (todo en verde antes de hacer commit):
   ```bash
   pnpm -r typecheck
   pnpm --filter api lint
   pnpm --filter api test          # Postgres local con migraciones + seed
   pnpm --filter web build
   ```
   más las E2E que la fase indique (`pnpm --filter web e2e -- <carpeta>`).
4. **Migraciones:** solo con `pnpm --filter api db:generate`; nunca editar a mano un SQL ya
   generado de otra fase. Toda migración debe ser **aditiva** (agregar columnas con default),
   para que el deploy no rompa datos existentes.
5. **Nada de secretos en el repo.** Variables nuevas: se agregan a
   `apps/api/src/config/env.validation.ts`, a `apps/api/.env.example` y a la tabla de
   `DEPLOY.md`; el valor real lo pone Andrés en Railway.
6. **Si algo inesperado rompe el gate** (prueba ajena que falla, comportamiento que
   contradice este plan): parar, describirlo en el chat y esperar. No "arreglar de paso".
7. Al terminar: marcar la fase en el tablero (§5), completar "Qué quedó hecho" en el
   archivo de la fase y hacer **un** commit:
   `fix(piloto): FASE-NN <resumen>`.

## 3. Mapa de fases

| Fase | Apartado | Qué ataca | Prioridad |
|---|---|---|---|
| 00 | Cimientos | Rama, entorno de pruebas, E2E rotas por la UI, CI en verde, warnings | 🔴 Bloquea todo |
| 01 | Reserva pública (`/reservar`) | Ver/cancelar citas ajenas con solo el celular; abuso de reservas y mensajes | 🔴 Bloquea el enlace público |
| 02 | Inicio de sesión y cuentas | Fuerza bruta del login; revisión de sesiones al cambiar contraseña | 🔴 Bloquea el piloto |
| 03 | API pública y observabilidad | `/api/metrics` abierto; contador de errores 5xx para alertas | 🔴 Bloquea el piloto |
| 04 | Web y sitio público (`orkalis.com`) | Cabeceras de seguridad (CSP, HSTS…); páginas maqueta con datos falsos; precios del sitio vs backend | 🟡 Antes de la publicidad |
| 05 | Finanzas · exportaciones | CSV que descarga como `download`; escape de celdas CSV | 🟡 Antes de la quincena del 15 |
| 06 | Regresión y entrega | Suite completa, documentación al día, rama lista para deploy | 🔴 Cierra el plan |

**Fuera de este plan (después del piloto):** Mercado Pago en producción, facturación
electrónica DIAN, mover los tokens de sesión de `localStorage` a cookies `httpOnly`,
locks para crons con varias réplicas, plantilla de WhatsApp con enlace de gestión
(se prepara el código en FASE-01, la aprobación de Meta es manual y opcional).

## 4. Calendario

| Cuándo | Claude | Andrés (`_GUIA-MANUAL.md`) |
|---|---|---|
| Mié 11-nov noche | FASE-00 | Parte A (accesos) |
| Jue 12-nov mañana | FASE-01 | Parte B (recolectar datos de la barbería, antes del mediodía) |
| Jue 12-nov tarde | FASE-02, FASE-03 | Parte C (verificaciones de producción) |
| Jue 12-nov noche | FASE-06 (si 04/05 no alcanzan, se cierra sin ellas) | Parte D (configurar la barbería) |
| Vie 13-nov mañana | — | Parte E (deploy + prueba de humo) y Parte F (capacitación) |
| Sáb 14-nov | — | Parte G (abrir el enlace público) |
| Lun 16 – vie 20-nov | FASE-04, FASE-05 (segundo deploy) | Parte H (seguimiento diario) |
| Lun 30-nov | — | Fin del testeo |
| Mié 2-dic | Informe | Parte I (cierre e informe) |

## 5. Tablero

- ✅ FASE-00 Cimientos (11-nov · gate verde, lint 0 warnings, E2E 139 ✓ / 1 ✘ previsto para FASE-05)
- ⬜ FASE-01 Reserva pública
- ⬜ FASE-02 Inicio de sesión
- ⬜ FASE-03 API pública y observabilidad
- ⬜ FASE-04 Web y sitio público
- ⬜ FASE-05 Finanzas · exportaciones
- ⬜ FASE-06 Regresión y entrega

## 6. Hallazgos de la auditoría que dieron origen al plan (11-nov-2026)

- API: 415/415 pruebas Jest en verde; typecheck limpio; 6 warnings de lint.
- E2E: 133 pasan, 6 fallan. 4 por el page object de reserva desactualizado (el botón del
  paso 1 ahora dice "Continuar"), 1 intermitente del seed, 1 real (CSV del análisis).
- `POST /public/:sucursal/cita/buscar` devuelve la cita completa de cualquier celular, y
  con su `id` se puede cancelar (`POST /public/:sucursal/cita/:id/cancelar`). Reproducido.
- Login sin bloqueo por cuenta; solo el límite global de 120 req/min por IP.
- `GET /api/metrics` es público en producción (contadores y latencias).
- Producción (métricas reales): API viva 76 días, 93 WhatsApp + 2 SMS sin fallos;
  **29 reservas y 9 inicios de sesión en 76 días** (la primera barbería casi no la usó).
