# FASE-14 · Pruebas, observabilidad y despliegue (Railway)

## Objetivo
Cerrar la v1: consolidar la **suite de pruebas** (unitarias, e2e, **aislamiento**, **concurrencia**, financiero), añadir **observabilidad** (logs estructurados + métricas del SLO), y **desplegar** en **Railway** con PostgreSQL gestionado (PITR), workers, **CI/CD con migraciones y pruebas como gate**, entornos dev/staging/prod, secretos fuera del código y TLS (ADR-008).

## Prerrequisitos
- Fases 01–13 funcionando en local.
- Cuenta Railway (FASE-00) y claves de producción de Twilio/Wompi listas (o decisión de mantener sandbox hasta el lanzamiento real).

---

## Pasos de Claude

### 1. Suite de pruebas (RNF-016) — gate de calidad
Asegurar que existen y pasan:
- **Unitarias:** cálculo financiero (FASE-09), `ConfigResolver` (FASE-06), máquina de estados (FASE-08).
- **E2E:** flujo público completo, login/RBAC, completar/revertir turno.
- **Aislamiento (RNF-010):** accesos cruzados entre negocios y entre sucursales **deben fallar** (FASE-04).
- **Concurrencia (RNF-008):** N reservas simultáneas a la misma franja → **0 dobles reservas** (FASE-08).
- Estas pruebas son **gate obligatorio** del pipeline: si fallan, no se despliega.

### 2. Observabilidad (RNF-019)
- **Logs estructurados** (JSON) con correlación por request; nunca loguear secretos ni contraseñas ni códigos OTP en claro.
- **Métricas** de operaciones críticas: reservas creadas, completados, **errores de concurrencia** (violaciones de exclusión), latencias p95 de endpoints clave (disponibilidad, confirmación), envíos de notificación.
- Healthchecks (`/api/health`) para que Railway monitoree.

### 3. Configuración de despliegue (monorepo)
- Dockerfiles (o config de Railway) para dos servicios: **API** (NestJS) y **workers** (colas), construidos desde el monorepo.
- Definir el servicio de **cola gestionada** (Redis en Railway) para BullMQ.
- **PostgreSQL gestionado** en Railway con **backups/PITR** (RPO ≤ 1h, RTO ≤ 4h — RNF-007).
- **Migraciones** se ejecutan en el pipeline como paso previo al arranque (ADR-004/008).

### 4. CI/CD
- Pipeline (GitHub Actions o el de Railway) que en cada push: instala, **typecheck**, **lint**, **corre todas las pruebas** (incluidas aislamiento y concurrencia) y **aplica migraciones**; solo despliega si todo pasa.
- **Entornos separados:** `dev`, `staging`, `prod` (ADR-008). Cada uno con su BD y sus secretos.

### 5. Secretos y TLS (RNF-012)
- Todos los secretos (JWT, Twilio, Wompi, DATABASE_URL) se configuran en **variables de entorno de Railway**, nunca en el repo.
- Forzar **TLS/HTTPS** en todos los endpoints (Railway lo provee); el dominio público de reservas también sobre HTTPS.

### 6. Rate limiting y protección pública en prod (RNF-011)
- Confirmar que el rate limiting de los endpoints públicos (FASE-08) está activo en producción y dimensionado.

### 7. Disponibilidad (RNF-006)
- Objetivo **99.9%** mensual; priorizar el presupuesto de error en el **enlace público de reservas**. Configurar alertas básicas sobre el healthcheck y los errores 5xx.

---

## ⚠️ ACCIÓN DEL USUARIO
1. **Crear el proyecto en Railway** y conectarlo al repositorio (o autorizar a Claude para hacerlo si tiene acceso).
2. **Aprovisionar** en Railway: PostgreSQL gestionado (con backups/PITR activados) y Redis.
3. **Cargar todos los secretos** en las variables de entorno de Railway para `staging` y `prod` (JWT_*, TWILIO_*, WOMPI_*, DATABASE_URL la inyecta Railway). El USUARIO los pega; Claude no los ve.
4. Decidir cuándo pasar Twilio y Wompi de **sandbox/trial** a **producción** (claves prod, número Twilio de pago, llaves Wompi `prod`, webhook con la URL pública real).
5. Configurar el **dominio** del enlace público y verificar el certificado TLS.
6. Revisar y aprobar que los backups/PITR cumplen RPO ≤ 1h / RTO ≤ 4h.

> Lanzar a producción y cobrar dinero real es **irreversible y de cara al público**: Claude debe **confirmar explícitamente con el USUARIO** antes de activar llaves de producción o ejecutar el primer despliegue a `prod`.

---

## Verificación / Done
- CI corre y **bloquea** el merge/deploy si fallan pruebas o migraciones.
- Las pruebas de aislamiento y concurrencia pasan en el pipeline.
- API + workers + Postgres + Redis corren en Railway (`staging` al menos).
- Backups/PITR activos y probados (restauración de prueba).
- Secretos solo en Railway; nada de claves en el repo; todo sobre HTTPS.
- Healthcheck verde; métricas y logs estructurados visibles.
- (Cuando el USUARIO lo apruebe) `prod` desplegado con llaves reales y dominio público con TLS.

## Trazabilidad
- ADR-008 completo, ADR-004 (migraciones en pipeline). RNF-002, RNF-006, RNF-007, RNF-008, RNF-010, RNF-011, RNF-012, RNF-016, RNF-019. Atributos de calidad del SRS §7.

---

## 🎉 Cierre de la v1
Al pasar la verificación de esta fase con todas las anteriores en ✅, Orkalis v1 está **levantado**: SaaS multi-tenant robusto, agendamiento público sin fricción con 0 dobles reservas, app del especialista, configurabilidad con herencia, motor financiero auditable, notificaciones, suscripción por sucursales y despliegue gestionado. Actualiza el tablero de progreso en `PLAN-V1.md`.
