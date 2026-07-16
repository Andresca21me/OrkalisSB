# PLAN-V1 · Índice maestro de ejecución de Orkalis (v1)

> **Para quién es este documento.** Para una IA que escribe código (en adelante "Claude ejecutor") y para el dueño del producto (en adelante "EL USUARIO"). Construye Orkalis v1 desde cero siguiendo **exactamente** la documentación de `/Documentacion`. No inventes alcance. No omitas pasos. Si algo de la documentación choca con este plan, **gana la documentación** y debes avisarlo al USUARIO.

---

## 0. Cómo usar este plan (LEER SIEMPRE PRIMERO)

1. El trabajo está partido en **fases** (`FASE-00` … `FASE-14`). Cada fase vive en su propio archivo `.md` dentro de esta carpeta.
2. **Una sesión de Claude = una fase** (o parte de una fase). Al empezar una sesión, abre **solo dos archivos**: este `PLAN-V1.md` (para contexto global) y el archivo de la fase que toca. No abras las demás fases: gastan tokens y no las necesitas.
3. Cada archivo de fase tiene SIEMPRE esta estructura fija:
   - **Objetivo** — qué se logra.
   - **Prerrequisitos** — qué fases deben estar 100% terminadas antes.
   - **Pasos de Claude** — qué código escribir, archivo por archivo.
   - **⚠️ ACCIÓN DEL USUARIO** — lo que el humano debe hacer fuera del código (crear cuentas, pasar claves, aprobar). Si una fase necesita una acción del usuario y no está hecha, **detente y pídela explícitamente**; no inventes claves ni datos.
   - **Verificación / Done** — cómo comprobar que la fase quedó bien antes de pasar a la siguiente.
   - **Trazabilidad** — qué RF/RNF/ADR de la documentación cubre.
4. **No avances de fase** si la verificación de la fase actual no pasa. La v1 es **robusta**: sin atajos en seguridad, multi-tenancy ni máquina de estados (Definición §5).
5. Marca el progreso en la tabla de la sección 4 de este archivo (cambia ⬜ por ✅) cuando termines una fase.

---

## 1. Qué es Orkalis (resumen de 1 minuto)

Plataforma **SaaS multi-tenant** para **salones de belleza y barberías en Colombia**. Tres cosas a la vez:
- **Gestión interna** (agenda, clientes, servicios, inventario, ventas, gastos, liquidaciones, reportes) — hereda y mejora a "NOVA".
- **Agendamiento público sin cuenta** para el cliente final (elige especialista/servicio, ve franjas libres en tiempo real, reserva; se identifica por teléfono con OTP).
- **Todo configurable** por negocio y por sucursal (módulos on/off + parámetros financieros) con herencia.

Jerarquía: **negocio (tenant) → sucursal → operación**. Un negocio de una sede = una sucursal. Suscripción **se cobra por plan (Básico/Pro/Premium/Empresarial) + número de especialistas**, con cupos de mensajería por plan; multi-sede es una función del plan, no un factor de cobro (ver **ADR-009**).

---

## 2. Stack y decisiones ya cerradas (NO cambiar sin ADR)

| Capa | Decisión | Fuente |
|---|---|---|
| Lenguaje | **TypeScript** de extremo a extremo | ADR-000 |
| Backend | **NestJS** (Node.js) | ADR-000 |
| Frontend | **React + TypeScript** | ADR-000 |
| Base de datos | **PostgreSQL** con **RLS** | ADR-000 / ADR-001 |
| ORM | **Drizzle ORM** (SQL-first, patrón `SET LOCAL app.current_tenant`) | ADR-004 |
| Aislamiento | columnas `negocio_id` (+`sucursal_id` en operativas) + **scope en repositorio base** + **RLS** | ADR-001 |
| Configuración | overrides dispersos + resolución en cascada `sistema→negocio→sucursal` | ADR-002 |
| Auth | **JWT propio** (access corto + refresh), argon2, RBAC por guards; **cliente final por OTP sin sesión** | ADR-003 |
| Agendamiento | máquina de estados + **`EXCLUDE` con `tstzrange`+`btree_gist`** + retención TTL; validación **por estrategia según origen** | ADR-005 |
| Finanzas | **servicio de dominio en la app** al completar; **snapshot** de parámetros; reversión transaccional | ADR-006 |
| Notificaciones | puerto `NotificationSender` + **SMS (Twilio)** como proveedor inicial; email complemento; WhatsApp futuro | ADR-007 |
| Repo / Deploy | **monorepo** (workspaces `api`/`web`/`shared`) + **Railway** (Postgres gestionado con PITR, workers, CI/CD con migraciones y pruebas como *gate*) | ADR-008 |
| Modelo de cobro | **planes por niveles** (Básico/Pro/Premium/Empresarial) + **nº de especialistas** + **cupos de mensajería**; sucursal NO es factor de cobro | ADR-009 |
| Pasarela suscripción | **Wompi** (Colombia) | decidido con el USUARIO |
| Localización | **COP**, formato `es-CO`, textos en **español** | Definición §7 / RNF-004 |
| Diseño | **demo de Claude Design** que traerá el USUARIO es la fuente de verdad visual | Definición §6 / RNF-005 |

---

## 3. Mapa de fases

| Fase | Archivo | Qué hace | Necesita acción del usuario |
|---|---|---|---|
| 00 | `FASE-00-prerrequisitos-y-cuentas.md` | Instalar herramientas; crear cuentas (Railway, Wompi sandbox, Twilio trial); reunir claves | **SÍ (mucha)** |
| 01 | `FASE-01-monorepo-y-tooling.md` | Monorepo pnpm (`api`/`web`/`shared`), TS, lint, formato, `.env.example` | No |
| 02 | `FASE-02-postgres-y-drizzle.md` | Postgres local (Docker), Drizzle, patrón transacción + GUC de tenant, 1ª migración | No |
| 03 | `FASE-03-esquema-de-datos.md` | Todas las tablas del ER, índices, `EXCLUDE`, `configuracion`, `retencion_franja`, `disponibilidad` | No |
| 04 | `FASE-04-rls-y-aislamiento.md` | Políticas RLS, repositorio base con scope, `TenantContext`, **pruebas de aislamiento** | No |
| 05 | `FASE-05-auth-y-rbac.md` | Login/refresh/logout, argon2, claims, guards rol + alcance sucursal | No |
| 06 | `FASE-06-configurabilidad.md` | Registry de claves, `ConfigResolver`, caché+invalidación, validación, clonado de sucursal | No |
| 07 | `FASE-07-negocio-sucursales-suscripcion.md` | Onboarding, perfiles salón/barbería, CRUD sucursales, equipo, cálculo de cobro por plan + nº especialistas (ADR-009) | No |
| 08 | `FASE-08-agendamiento.md` | Disponibilidad, retención TTL, máquina de estados, validadores por origen, endpoints públicos+OTP, walk-ins | No |
| 09 | `FASE-09-motor-financiero.md` | Cálculo al completar (guard de pago), snapshot, reversión transaccional | No |
| 10 | `FASE-10-operacion-interna.md` | Clientes/CRM, servicios, inventario opcional, ventas, gastos, liquidaciones, reportes, cierre de período | No |
| 11 | `FASE-11-notificaciones.md` | Puerto `NotificationSender`, adaptador Twilio SMS + email, cola/worker | **SÍ (claves Twilio)** |
| 12 | `FASE-12-suscripcion-wompi.md` | Integración Wompi, webhook, operador de plataforma, suspensión/reactivación | **SÍ (claves Wompi)** |
| 13 | `FASE-13-frontend.md` | Integrar demo de Claude Design; paneles admin/especialista/público/recepción; es-CO/COP; tipos compartidos | **SÍ (entregar la demo)** |
| 14 | `FASE-14-pruebas-observabilidad-despliegue.md` | Suite de pruebas, logs/métricas, despliegue en Railway, CI/CD, entornos, PITR, TLS | **SÍ (claves de producción)** |

**Orden recomendado:** estrictamente 00 → 14. Las fases 03–04 son el cimiento de aislamiento (no negociable). El frontend (13) puede empezar en paralelo a partir de la fase 07 si hay dos sesiones, pero su integración final depende de los endpoints de 05–12.

---

## 4. Tablero de progreso (actualizar al terminar cada fase)

- ✅ FASE-00 Prerrequisitos y cuentas (Wompi sandbox pendiente, no bloqueante hasta FASE-12)
- ✅ FASE-01 Monorepo y tooling
- ✅ FASE-02 Postgres y Drizzle
- ✅ FASE-03 Esquema de datos
- ✅ FASE-04 RLS y aislamiento
- ✅ FASE-05 Auth y RBAC
- ✅ FASE-06 Configurabilidad
- ✅ FASE-07 Negocio, sucursales y suscripción
- ✅ FASE-08 Agendamiento
- ✅ FASE-09 Motor financiero
- ✅ FASE-10 Operación interna
- ✅ FASE-11 Notificaciones
- ✅ FASE-12 Suscripción Wompi
- ✅ FASE-13 Frontend
- ✅ FASE-14 Pruebas, observabilidad y despliegue

---

## 5. Convenciones globales (aplican a TODAS las fases)

- **Idioma del dominio en español:** nombres de tablas/columnas en español (`negocio`, `sucursal`, `cita`, `cita_servicio`, `atencion`, `gasto`, `configuracion`…), igual que el modelo ER. Código (variables, clases) en inglés está permitido, pero los términos de dominio mantienen el nombre del ER.
- **Toda entidad lleva `negocio_id`.** Las **operativas** llevan además `sucursal_id` (citas, atenciones, inventario, ventas, gastos, disponibilidad, liquidaciones). Ver tabla de niveles en ADR-001.
- **Ninguna consulta sin scope.** Toda lectura/escritura pasa por el repositorio base que fija el tenant (fase 04). Nunca consultes Drizzle "a pelo" saltándote el scope.
- **Dinero en enteros (centavos de COP)** o `numeric` con 2 decimales — nunca `float`. Formato de salida `es-CO`.
- **Tiempos en `timestamptz`.** Rango de cita como `tstzrange` para el `EXCLUDE`.
- **Nada de secretos en el código** (RNF-012). Todo por variables de entorno. `.env` está en `.gitignore`; existe `.env.example` con claves vacías.
- **Cada cambio de esquema = una migración Drizzle versionada** (ADR-004). Nunca edites la BD a mano fuera de migraciones.
- **Validación de dominio centralizada** (ej. repartición prof+salón = 100%, porcentajes 0–100).
- **Tareas pesadas (PDF, reportes, envío de SMS) en workers/colas**, nunca en el hilo de la petición (RNF-002).
- **Pruebas obligatorias** para lógica crítica: agendamiento, concurrencia, cálculo financiero, aislamiento (RNF-016). Una fase no está "Done" sin sus pruebas.

---

## 6. Glosario rápido

| Término | Significado |
|---|---|
| Tenant / negocio | Cliente suscrito; unidad de aislamiento principal (`negocio_id`). |
| Sucursal | Sede física; unidad operativa y de aislamiento (`sucursal_id`). **No** es unidad de cobro (ADR-009); multi-sede es función del plan. |
| Walk-in | Cliente sin reserva; turno creado a mano (en vivo o retroactivo). |
| Origen | Atributo de la cita: `agendamiento_publico` o `creacion_interna`. Decide qué validación aplica. |
| Confirmación automática | Reserva pública que entra como `confirmada` sin aceptación manual (default). |
| Retención de franja | Bloqueo temporal con TTL mientras el cliente confirma. |
| OTP | Código de un solo uso por SMS para identificar al cliente final sin cuenta. |
| ConfigResolver | Servicio que resuelve un valor de config por la cadena `sistema→negocio→sucursal` y devuelve su procedencia. |
| Snapshot de parámetros | Copia de los porcentajes/valores aplicados al completar un turno, para auditoría. |
| GUC | Variable de sesión de Postgres (`app.current_tenant`) que activa RLS por petición. |

---

## 7. Estados de la cita (referencia rápida — detalle en FASE-08)

```
              (aprobación manual ON)
                    Solicitada ──aprobar──► Confirmada
                        │ rechazar              │ iniciar
                        ▼                        ▼
                    Cancelada              En progreso ──[pago] completar──► Completada
                                                │ incidente                      │ revertir efectos
                                                ▼                                 ▼ (deshace ganancias+stock, ADR-006)
                                          Cancelada / No asistió
```
- Reserva pública con auto-confirmación entra **directo en Confirmada**.
- Walk-in en vivo entra en **En progreso**; walk-in retroactivo entra **directo en Completada**.
- **Guard de pago:** marcar Completada exige pago + servicios reales registrados.
- Origen (público/interno) decide el punto de entrada y la validación (Strategy).

---

*Fin del índice maestro. Abre ahora el archivo de la fase que corresponda.*
