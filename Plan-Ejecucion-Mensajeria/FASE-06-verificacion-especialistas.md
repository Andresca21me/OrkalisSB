# FASE-06 · Verificación de especialistas por código (Twilio Verify)

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.
> Implementa **D3** (Twilio Verify para el especialista) y el nuevo flujo de alta de Parte VII.

## Objetivo
Rediseñar el alta de especialistas: **celular obligatorio + verificación por código** antes de crear el registro. Hoy se crea el especialista de inmediato, sin celular ni verificación.

## Prerrequisitos / Dependencias
- FASE-01 (adaptador Twilio Verify), FASE-00 (`TWILIO_VERIFY_SERVICE_SID`).

## Cambios técnicos (Pasos de Claude)
1. **Schema `especialista`** (`db/schema/team.ts`): añadir `telefono text`, `telefono_verificado_en timestamptz`, `apellidos text?`. Migración tolerante (existentes quedan sin teléfono → se les puede pedir verificación al editar; no se rompen).
2. **Tabla `verificacion_especialista`** (Parte III.2): `negocio_id, telefono, datos_borrador jsonb, verify_sid, estado(pendiente|verificado|expirado|cancelado), intentos, reenvios, expira_en, creado_en`. Migración.
3. **`VerificacionEspecialistaService`** (nuevo):
   - `iniciar(ctx, {nombre, apellidos, celular, especialidad?, sucursalIds, email?, password?})`: valida cupo de especialistas (reusa `EquipoService`/`PlanService`), formato celular (+57, 10 dígitos), crea fila borrador, llama `verify.start(celular, 'sms')`, guarda `verify_sid`. Devuelve `{ verificacionId }`. **Throttled**.
   - `confirmar(ctx, {verificacionId, codigo})`: `verify.check(...)`. OK → crea especialista vía `EquipoService.crear` (con `telefono`, `telefono_verificado_en`, `activo=true`) + sucursales + disponibilidad + login opcional; marca `verificado`. Falla → `intentos++`; a 5 → `cancelado`.
   - `reenviar(ctx, {verificacionId})`: cooldown 30s, máx 3 reenvíos.
4. **Endpoints** en `equipo.controller.ts` (o nuevo controller): `POST /especialistas/verificacion/iniciar|confirmar|reenviar` (`@Roles(Admin)`, `@Throttle`).
5. **DTOs** en `negocio/dto/negocio.dto.ts`: `IniciarVerificacionDto` (añade `celular`, `apellidos`), `ConfirmarVerificacionDto`, `ReenviarVerificacionDto`. El viejo `POST /especialistas` directo se depreca o queda solo para casos internos sin teléfono.
6. **Frontend `EquipoScreen.tsx` → `SpecialistModal` de 2 pasos:**
   - Paso 1 (datos): añade **Celular** obligatorio (+57, 10 dígitos) + Apellidos; mantiene nombre/especialidad/sucursales/login opcional. Botón "Enviar código".
   - Paso 2 (código): input 6 dígitos, reenvío con contador, "Verificar y crear". Mensajes de error claros (incorrecto/expirado/agotado).
   - `lib/useEquipo.ts`: `iniciarVerificacion`, `confirmarVerificacion`, `reenviarCodigo`.

## Archivos afectados
- `apps/api/src/db/schema/team.ts` + nueva tabla verificación, `apps/api/drizzle/*`
- `apps/api/src/negocio/verificacion-especialista.service.ts` (nuevo)
- `apps/api/src/negocio/equipo.controller.ts`, `equipo.service.ts`
- `apps/api/src/negocio/dto/negocio.dto.ts`
- `apps/api/src/notificaciones/verify/*`
- `apps/web/src/pages/admin/EquipoScreen.tsx`, `apps/web/src/lib/useEquipo.ts`

## ⚠️ Acción requerida del desarrollador
- **AM-2:** `TWILIO_VERIFY_SERVICE_SID` cargado (de FASE-00). Sin él → adaptador Verify mock (código fijo en dev).

## Riesgos y mitigaciones
- **Costo/abuso de Verify** → throttling por IP/negocio, máx intentos/reenvíos, TTL 10 min.
- **Especialistas existentes sin teléfono** → migración tolerante; flujo de "verificar teléfono" al editar (opcional, futura).
- **Doble creación** → el especialista se crea solo en `confirmar` OK, dentro de tx; verificación pasa a `verificado` (idempotente).
- **Fuga del código** → nunca se devuelve; en dev, Verify mock loguea.

## Criterios de aceptación (Done)
- No se crea especialista sin código correcto.
- Reenvío e intentos limitados; expiración respetada.
- El especialista creado queda con `telefono` y `telefono_verificado_en`, `activo=true`.
- Cupo de especialistas se sigue respetando.

## Pruebas
- Unit del servicio con Verify mockeado (start/check, límites).
- E2E del modal 2 pasos (feliz, código incorrecto, reenvío, expiración).
- Verificación de que el cupo bloquea igual que antes.

## Trazabilidad
Parte VII del plan, D3, ADR-003 (verificación por código), HU-ADM-005 (gestión de equipo).

## Resultado esperado
Alta de especialistas segura, con celular verificado — habilita los avisos por mensajería (FASE-07).
