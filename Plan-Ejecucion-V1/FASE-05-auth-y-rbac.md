# FASE-05 · Autenticación y RBAC con contexto de tenant

## Objetivo
Construir la **identidad propia** de Orkalis: login de usuarios internos con **JWT (access corto + refresh)**, hashing con **argon2**, claims con `negocio_id` + rol + alcance de sucursal, y **guards de NestJS** que autorizan por rol y acotan por sucursal. El cliente final **no** usa este sistema (su OTP va en FASE-08). Sin BaaS (ADR-003).

## Prerrequisitos
- FASE-04 completa (RLS + `TenantContext` + repositorio base).

---

## Pasos de Claude

### 1. Módulo `auth`
Crear `apps/api/src/auth/` con:
- `auth.module.ts`, `auth.service.ts`, `auth.controller.ts`.
- Estrategias Passport: `jwt.strategy.ts` (valida access token), `jwt-refresh.strategy.ts`.

### 2. Hashing de contraseñas
- Usar **argon2** (`argon2` paquete) para `password_hash` de `usuario`.
- Nunca guardar contraseñas en claro; nunca loguearlas.

### 3. Endpoints de auth
- `POST /api/auth/login` — recibe `{ email, password }`. Busca el usuario (recordar: email único por negocio; el login puede requerir también un identificador de negocio, o resolver el negocio por email global único — **decisión:** email único global entre todos los usuarios internos para simplificar login; documentarlo). Verifica hash, emite access + refresh.
- `POST /api/auth/refresh` — recibe refresh token (rotación: invalida el anterior, emite uno nuevo).
- `POST /api/auth/logout` — revoca el refresh token actual.
- `GET /api/auth/me` — devuelve el usuario y su contexto (negocio, rol, sucursales).
- **No existe registro público de cuentas internas** (RF-013): los usuarios los crea el admin/onboarding (FASE-07) o el operador de plataforma.

### 4. Contenido del JWT (claims)
Access token debe llevar: `sub` (usuario_id), `negocio_id`, `rol`, `sucursal_ids` (array o `null` para alcance consolidado), `tipo: 'access'`. Vida corta (`JWT_ACCESS_TTL`, p. ej. 15 min). Refresh: vida larga (`JWT_REFRESH_TTL`), `tipo: 'refresh'`, almacenado/rastreado para poder revocarlo (tabla `refresh_token` o columna con jti + revocado).

### 5. Construcción del `TenantContext` desde el JWT
- Reemplazar el stub de FASE-04: el interceptor/guard ahora arma `TenantContext` a partir de los claims del access token validado.
- `sucursalIds`: para admin consolidado puede ser `null` (ve todo el negocio); para especialista/recepcionista es la lista de sus sucursales (de `usuario_sucursal`).

### 6. Guards de RBAC
- `JwtAuthGuard` — exige access token válido (global, con decorador `@Public()` para excluir endpoints públicos).
- `RolesGuard` + decorador `@Roles('admin', ...)` — autoriza por rol.
- `SucursalScopeGuard` — para operaciones sobre una sucursal concreta, verifica que la sucursal esté dentro del alcance del usuario (`ctx.sucursalIds`), salvo admin consolidado. Bloquea cruces entre sucursales (RF-014).

### 7. Revocación y rotación de refresh
- Implementar rotación: cada refresh emite uno nuevo e invalida el usado (detección de reuso = posible robo → revocar toda la familia).
- Guardar secretos `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` SOLO en env (RNF-012).

### 8. Suspensión de cuenta (engancha con FASE-12)
- En el login y en el guard, si `negocio.estado_suscripcion = 'suspendida'`, **bloquear el acceso** con un mensaje claro de "cuenta suspendida" pero **sin borrar datos** (HU-PLT-002). El operador de plataforma (FASE-12) reactiva.

---

## ⚠️ ACCIÓN DEL USUARIO
- Generar dos secretos largos y aleatorios y ponerlos en `apps/api/.env`:
  - `JWT_ACCESS_SECRET=` (p. ej. salida de `openssl rand -base64 48`)
  - `JWT_REFRESH_SECRET=` (otro distinto)
  > Claude puede generarlos y decirle al USUARIO que los pegue, o el USUARIO los crea. **No** subir estos valores a git.

---

## Verificación / Done
- Login con el usuario admin del seed devuelve access + refresh válidos.
- Un endpoint protegido rechaza peticiones sin token (401) y con rol equivocado (403).
- El `TenantContext` derivado del token alimenta correctamente `runInTenantTx` (las queries solo ven el negocio del token).
- Refresh rota el token; el refresh viejo deja de funcionar; logout lo revoca.
- Un usuario de negocio suspendido no puede operar y ve el aviso.
- Pruebas: login ok/fallido, expiración de access, rotación de refresh, guard de rol, guard de sucursal.

## Trazabilidad
- ADR-003 (JWT propio, argon2, claims, guards; cliente final separado), ADR-001 (claims portan tenant/sucursal), RF-013, RF-014, HU-PLT-002.
