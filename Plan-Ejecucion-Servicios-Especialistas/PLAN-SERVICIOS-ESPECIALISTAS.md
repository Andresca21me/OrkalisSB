# PLAN-SERVICIOS-ESPECIALISTAS · Asignación de servicios y mapeo dinámico en reservas — Orkalis

> **Para quién es este documento.** Para el dueño del producto (EL USUARIO) y para la IA ejecutora. Introduce la **relación N:M especialista↔servicio**, el **filtrado bidireccional** servicio↔especialista en la reserva pública y en los flujos internos, y las **reglas de cascada** por desactivación (especialista dado de baja con citas futuras, servicio desactivado, visibilidad pública).
>
> **Regla de oro:** este es el PLAN. **No se escribe código hasta que EL USUARIO apruebe.** Es una **FASE ÚNICA** en etapas ordenadas (E1…E10); cada etapa tiene su verificación y no se avanza si no pasa. Si algo choca con `/Documentacion`, **gana la documentación** y se avisa.
>
> **Estado del análisis:** completo. Basado en el código real (`apps/api`, `apps/web`, `packages/shared`), el SRS (RF-016, RF-017) y las HU (HU-CLI-002, HU-ADM-012).
>
> **Despliegue:** al terminar y verificar, commit + push a `main` (Railway despliega solo; el entrypoint aplica la migración).

---

## 0. Decisiones de producto (cierran los huecos del requerimiento)

| # | Tema | Resolución |
|---|------|-----------|
| D1 | Modelo de datos | Tabla N:M **`especialista_servicio`** con PK compuesta `(especialista_id, servicio_id)`, FKs con `ON DELETE CASCADE`, **calcada de `especialista_sucursal`** (`db/schema/team.ts:32`), incluida su política RLS por `EXISTS` sobre `especialista` (patrón exacto en `drizzle/0002_rls_y_rol_app.sql:159-163` — las tablas de unión sin `negocio_id` se aíslan vía la tabla padre, y llevan `FORCE ROW LEVEL SECURITY`). |
| D2 | Semántica por defecto (retro-compatibilidad, la decisión MÁS importante) | **Especialista sin filas en `especialista_servicio` = realiza TODOS los servicios.** Es la misma convención "ausencia de fila = permitido" que ya usan `sucursal_dia_laborable` y `servicio_dia` (documentada en `scheduling.ts:66-67,91-92`). Consecuencias: (a) el despliegue NO cambia nada para los negocios existentes — nadie desaparece del link de reservas; (b) la migración no necesita sembrar combinaciones; (c) un servicio nuevo lo realizan automáticamente los especialistas "sin restricción". El filtrado solo se activa cuando el admin asigna explícitamente un subconjunto. **Caso "ninguno":** deseleccionar todos los chips vuelve al estado "todos" — la UI lo dice en claro ("Sin selección = realiza todos los servicios"); si el admin quiere que alguien no reciba reservas, para eso ya existe el switch Libre/Ocupado (`disponible`). |
| D3 | Cómo viaja el mapeo al link público | `GET /public/:sucursalId/servicios` pasa a incluir **`especialistaIds: string[]`** por servicio (los especialistas activos+disponibles de ESA sucursal que lo realizan, con D2 resuelta). Con ese único dato el frontend resuelve todo el filtrado bidireccional **por intersección, sin endpoints nuevos ni ida-y-vuelta**: oculta servicios con lista vacía, deshabilita servicios incompatibles durante la multiselección y filtra el paso de especialistas. Los ids de especialistas ya son públicos (los expone `GET /public/:sucursalId/especialistas`), así que no se filtra ningún dato nuevo. |
| D4 | Indivisibilidad del combo | La reserva es UNA cita con UN especialista que realiza TODOS los servicios elegidos. Al multiseleccionar, un servicio se puede añadir solo si **algún especialista realiza la selección completa** (intersección de `especialistaIds` no vacía); los demás se muestran deshabilitados con el motivo ("Nadie realiza esta combinación junta"). Esto elimina el callejón sin salida de llegar al paso de horario sin franjas posibles. |
| D5 | Validación en servidor (nunca confiar en el cliente) | El chequeo "el especialista realiza todos los servicios" se añade en **`validarEntidades`** (`agendamiento/validators/validador-cita.port.ts:24-49`), el punto por el que ya pasan la confirmación pública y la creación interna; y `franjasPublicas` con `especialista='any'` restringe los candidatos a quienes realizan todos los `servicioIds`. **Excepción deliberada: el walk-in RETROACTIVO no se bloquea** — registra un hecho que ya ocurrió en el mundo real; impedir registrarlo corrompería finanzas, no la realidad. |
| D6 | Reasignación endurecida | `reasignar` hoy solo comprueba que el destino EXISTA (`agendamiento.service.ts:135-136`, sin validador). Pasa a validar: destino **activo**, **asignado a la sucursal de la cita** y que **realiza todos los servicios de la cita** (reutilizando `validarEntidades`). El anti-solape ya lo garantiza el EXCLUDE. La UI de reasignar filtra los candidatos con los mismos criterios. |
| D7 | Baja de especialista con citas futuras (caso borde crítico) | `DELETE /especialistas/:id` con citas futuras pendientes (estados `solicitada`/`confirmada` con `inicio > now()`) **responde 409** con el conteo, sin ejecutar nada. El admin decide en un modal y reintenta con `?accion=reasignar` o `?accion=cancelar`. **`reasignar`**: para cada cita busca un candidato (activo + disponible + asignado a la sucursal de la cita + realiza todos sus servicios) y lo intenta en orden; si el EXCLUDE de solape rechaza, prueba el siguiente; **las citas sin candidato viable se cancelan** (fallback) avisando al cliente. **`cancelar`**: cancela todas avisando al cliente. La respuesta informa `{ reasignadas, canceladas }` y la UI lo muestra. Cada cita se procesa en su propia transacción (un solape no debe revertir las demás); la baja (`activo=false`) se ejecuta al final. |
| D8 | Quitar un servicio asignado con citas futuras | **No toca ninguna cita**, ni pasada ni futura (regla del requerimiento): solo bloquea reservas NUEVAS. Las citas existentes son un contrato ya pactado con el cliente. Sin guard ni aviso bloqueante; el modal de asignación puede mostrar una nota informativa. Lo mismo aplica a quitar una sucursal (comportamiento actual, fuera de alcance). |
| D9 | Desactivar servicio global | Ya desaparece del link (filtro `activo=true` existente) y las citas futuras que lo incluyen se conservan (FK `restrict` + regla D8). Se añade: el diálogo de confirmación informa cuántas citas futuras lo incluyen (dato informativo, no bloqueante), y el servicio inactivo deja de contar en los chips/contadores de los especialistas (se filtra por `servicio.activo` al leer). |
| D10 | Mensajería en las cascadas | Cancelación por baja de especialista → **se avisa al cliente** con la plantilla `aviso` existente ("Tu cita fue cancelada", `templates.ts:47-48`), respetando el interruptor de saldo. Reasignación (individual o por baja) → **NO se le envía mensaje al cliente en v1**: su servicio, sede y hora no cambian, y el crédito de SMS es finito (presupuesto de 300 segmentos); el nuevo especialista sí recibe su aviso interno ya existente ("Te asignaron esta cita"). |

**Extra incluido (vía libre, hueco real detectado en el análisis):** hoy la **cancelación interna** (admin cancela desde la agenda) NO avisa al cliente — solo al especialista (`agendamiento.service.ts:160-164`); la cancelación pública sí avisa. Se corrige: cancelar internamente una cita con cliente y teléfono encola el mismo `aviso` al cliente. Es exactamente la plantilla que ya existe y es un agujero de experiencia grave (el cliente llega a una cita cancelada).

**Extras de UI incluidos:** chips de servicios en la tarjeta del especialista + acción rápida "Asignar servicios"; badge "Sin especialista asignado" en la tarjeta del servicio (con conteo de quiénes lo realizan); filtros bidireccionales también en cita interna, walk-ins y reasignación.

**Queda explícitamente FUERA:** asignación por sucursal (la relación es a nivel negocio, como `servicio`); precios/duración por especialista; prioridades u orden de preferencia entre especialistas; notificación al cliente por reasignación (D10).

---

# PARTE I — DIAGNÓSTICO DEL ESTADO ACTUAL

## 1.1 Lo que YA EXISTE (no se reconstruye)

**Backend:**
- Patrón N:M listo para calcar: `especialista_sucursal` (PK compuesta, RLS por `EXISTS`, endpoint `PUT /especialistas/:id/sucursales` con delete+reinsert en `equipo.service.ts:232-243`).
- Motor de disponibilidad (`agendamiento/disponibilidad.service.ts:47-102`): ya filtra por sucursal, `especialista.activo`, `especialista.disponible`, ventanas de `disponibilidad`, día laborable de la sucursal y `servicio_dia`; genera franjas de 15 min; con `'any'` agrega por hora y "gana" el primer especialista libre. Solo le falta el filtro por servicio.
- Validador central `validarEntidades` (sucursal activa, especialista existe+activo, especialista∈sucursal) usado por `ValidadorPublico` y `ValidadorInterno` — el sitio natural para el chequeo nuevo.
- Reserva pública completa (`public-agendamiento.service.ts`): info/servicios/especialistas/disponibilidad/retener/OTP/confirmar/cancelar, con revalidación de día laborable y `servicio_dia` en `confirmar` (`:337-344`).
- `reasignar` (`agendamiento.service.ts:130-155`) con EXCLUDE anti-solape y aviso al nuevo especialista.
- Baja/reactivación por borrado lógico (`darDeBaja` → `activo=false`), verificación de alta en 2 pasos con borrador jsonb (`verificacion_especialista.datos_borrador`).
- Notificaciones: plantilla `aviso` de cancelación AL CLIENTE ya existe y se usa en la cancelación pública (`public-agendamiento.service.ts:495-502`); aviso interno al especialista (`avisos-especialista.service.ts`).

**Frontend:**
- `SpecialistModal` (`EquipoScreen.tsx:196-444`) con multiselección de sucursales por botones-checkbox (patrón a calcar para servicios) y flujo de verificación en 2 pasos; `SpecialistCard` con chips de sucursales (`:175-183`, patrón a calcar).
- Reserva pública (`BookingPage.tsx`): pasos `servicios → especialista → horario → identificación`; multiselección de servicios con categorías; opción **"Cualquiera disponible"**; días no laborables tachados; estados vacíos diferenciados.
- `NuevaCitaModal` ya filtra especialistas **por sucursal** (`agenda-ui.tsx:291-294`) — único filtro existente; walk-ins y `ReasignarDialog` no filtran nada.
- `ServiciosScreen` con tarjeta de servicio (precio, duración, reparto, activo/inactivo).

## 1.2 Lo que FALTA (huecos que este plan cierra)

1. **No existe la relación especialista↔servicio** en ninguna capa (tabla, DTO, UI) — confirmado por barrido completo.
2. La reserva pública muestra **todos** los especialistas y **todos** los servicios activos, sin filtrado bidireccional ni ocultamiento de servicios sin quién los atienda.
3. `franjasPublicas` con `'any'` considera a todo el equipo de la sede — puede prometer franjas de alguien que no realiza el servicio (cuando exista la relación).
4. Ningún flujo valida "el especialista realiza este servicio": ni confirmar público, ni cita interna, ni walk-ins, ni reasignar.
5. **`reasignar` solo valida existencia** del destino: permite reasignar a un especialista inactivo o de otra sucursal.
6. **Dar de baja no mira las citas futuras**: quedan citas huérfanas en la agenda de alguien que ya no está, sin aviso a nadie.
7. La cancelación interna no avisa al cliente (solo la pública lo hace).
8. El modal de crear especialista (con verificación por celular) no captura servicios; el borrador jsonb no los guarda.
9. La tarjeta del especialista no muestra sus servicios; la del servicio no muestra quién lo realiza.

## 1.3 Riesgos que la ejecutora debe respetar

- **Regresión cero en negocios existentes:** ningún negocio tiene filas en la tabla nueva al desplegar → por D2, TODO debe comportarse EXACTAMENTE igual que hoy. Los specs existentes de agendamiento (`agendamiento.spec.ts`, 9 escenarios, que siembran especialista+servicio SIN asignación) deben pasar **sin modificarlos**: son la prueba viviente de D2.
- **El EXCLUDE anti-solape es la única barrera de concurrencia** en retenciones/citas/reasignación — todo reintento de candidatos en la baja (D7) debe capturar el error `23P01` como ya hacen `retener` y `crearInterna`.
- **`servicio` y la relación nueva son nivel-NEGOCIO; `disponibilidad` y la asignación de sedes son nivel-SUCURSAL.** El cómputo público de `especialistaIds` por servicio debe cruzar ambos (realiza el servicio Y está en esa sucursal Y activo Y disponible).
- **Aviso al especialista solo si tiene teléfono verificado** (`avisos-especialista.service.ts:49-52`) — las cascadas de la baja no deben romperse con especialistas antiguos sin teléfono.
- El flujo de alta con verificación crea el especialista **al confirmar el código** desde el borrador jsonb — los `servicioIds` deben viajar en ese borrador o se perderán.

---

# PARTE II — DISEÑO OBJETIVO

## 2.1 Modelo de datos (migración 0019)

```
especialista_servicio (
  especialista_id uuid NOT NULL REFERENCES especialista(id) ON DELETE CASCADE,
  servicio_id     uuid NOT NULL REFERENCES servicio(id)     ON DELETE CASCADE,
  PRIMARY KEY (especialista_id, servicio_id)
)
```

En Drizzle: `db/schema/team.ts`, copiando `especialistaSucursal` (líneas 32-45). Migración: `drizzle-kit generate` y **extensión manual** con el bloque RLS calcado de `especialista_sucursal` (`0002_rls_y_rol_app.sql:159-163`): `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + política `USING/WITH CHECK (EXISTS (SELECT 1 FROM especialista e WHERE e.id = especialista_servicio.especialista_id))`. Sin datos sembrados (D2). `ON DELETE CASCADE` en ambas FKs hace que borrar físicamente un servicio o especialista limpie sus filas (hoy todo es borrado lógico, pero la integridad queda garantizada).

## 2.2 Semántica de lectura (regla D2, helper único)

Un solo helper en el backend para no repetir la regla en cinco sitios (proponer en `agendamiento/validators/` o junto a `EquipoService`):

```
// ¿El especialista realiza TODOS estos servicios?
// Sin filas en especialista_servicio → realiza todos (D2).
realizaServicios(tx, especialistaId, servicioIds): Promise<boolean>
// Ids de especialistas (de una lista candidata) que realizan TODOS los servicioIds.
filtrarPorServicios(tx, especialistaIds, servicioIds): Promise<string[]>
```

Implementación sugerida (una consulta): traer las filas de `especialista_servicio` de los candidatos; los que no tienen NINGUNA fila pasan siempre; los que tienen filas pasan si su conjunto contiene todos los `servicioIds`. Nota: considerar solo servicios con `servicio.activo=true` al contar "sus filas" no es necesario para el chequeo (se valida contra los `servicioIds` pedidos, que ya vienen de listados filtrados por activo).

## 2.3 Endpoints (nuevos y modificados)

| Cambio | Ruta | Roles | Detalle |
|---|---|---|---|
| NUEVO | `PUT /especialistas/:id/servicios` | Admin | Body `{ servicioIds: string[] }`. Delete+reinsert (calcar `asignarSucursales`, `equipo.service.ts:232-243`). Valida que los ids existan y sean del negocio. `[]` = sin restricción (todos, D2). |
| MODIFICAR | `GET /especialistas` | (sin cambio de roles) | `EspecialistaEquipo` gana `servicioIds: string[]` (vacío = todos). Cargar con UNA consulta agrupada, no N+1 (como ya se hace con `sucursalIds`). |
| NUEVO | `GET /especialistas/:id/citas-futuras` | Admin | `{ total: number, muestra: { id, inicio, clienteNombre, servicios }[] }` (máx. 5 en `muestra`). Citas `solicitada`/`confirmada` con `inicio > now()`. Alimenta el modal de baja. |
| MODIFICAR | `DELETE /especialistas/:id` | Admin | Sin query y con citas futuras → **409** `{ citasFuturas: n }`. Con `?accion=reasignar` o `?accion=cancelar` → ejecuta D7 y devuelve `{ reasignadas, canceladas }`. Sin citas futuras → comportamiento actual. |
| MODIFICAR | `GET /public/:sucursalId/servicios` | público | Cada servicio gana `especialistaIds: string[]` (activos+disponibles de esa sucursal que lo realizan, D2 resuelta). Servicio con lista vacía **se sigue devolviendo** (el front decide ocultarlo) — así la pantalla de gestión de una cita vieja puede seguir nombrándolo. |
| MODIFICAR | `GET /public/:sucursalId/disponibilidad` | público | `franjasPublicas` con `'any'`: tras el filtro actual (sucursal+activo+disponible) aplica `filtrarPorServicios`. Con especialista concreto: `realizaServicios` o lista vacía de franjas. |
| MODIFICAR | `POST /public/:sucursalId/confirmar` y `POST /citas` / walk-in vivo | (sin cambio) | Vía `validarEntidades` extendido (D5). |
| MODIFICAR | `POST /citas/:id/reasignar` | (sin cambio) | Validación D6 antes del update. |

**DTOs compartidos** (`packages/shared/src/dtos.ts`): `EspecialistaEquipo` += `servicioIds: string[]`; `PublicServicio` += `especialistaIds: string[]`; nuevo `CitasFuturasResp`; `BajaEspecialistaResp { reasignadas: number; canceladas: number }`. Recordar el **build dual** de shared.

## 2.4 Matriz de visibilidad pública (cascadas)

| Evento | Efecto en el link de reservas | Mecanismo |
|---|---|---|
| Especialista dado de baja (`activo=false`) o marcado Ocupado (`disponible=false`) | Sale de `especialistaIds` de todos los servicios; si era el único de un servicio, ese servicio queda con lista vacía → **oculto** | Cómputo en lectura (D3); nada materializado, no hay estados que sincronizar |
| Servicio desactivado | Desaparece del listado público (filtro `activo=true` existente) y de los chips del especialista | Filtro existente + filtro por `servicio.activo` al leer asignaciones |
| Día no laborable / `servicio_dia` inactivo | Sin cambios: ya lo resuelven `esDiaLaborable` y `serviciosInactivosEnDia` en franjas y en confirmar | Existente |
| Se le quita un servicio a un especialista | Solo afecta reservas nuevas; citas existentes intactas (D8) | `validarEntidades` solo corre al crear |
| Todos los especialistas de un servicio quedan ocupados (`disponible=false`) | Servicio oculto mientras dure (lista vacía) | Mismo cómputo D3 |

---

# PARTE III — FASE ÚNICA DE EJECUCIÓN (etapas E1–E10)

> Orden obligatorio. Tras CADA etapa: `pnpm --filter api typecheck` + suite (`npx jest` con `TWILIO_ACCOUNT_SID= TWILIO_AUTH_TOKEN= TWILIO_FROM_NUMBER= TWILIO_VERIFY_SERVICE_SID=` vaciados y el Postgres local levantado con `docker compose up -d`). Baseline actual: **322 tests, 316 verdes + 6 flaky preexistentes de mensajería** (`verificacion-especialista` y a veces `notificaciones`/`cupos-plan` — no son regresión, varían entre corridas).

## E0 · Preparación

1. Leer completos: `agendamiento/disponibilidad.service.ts`, `public-agendamiento.service.ts`, `agendamiento.service.ts`, `validators/*`, `negocio/equipo.service.ts` + `verificacion-especialista.service.ts`, `avisos-especialista.service.ts`, `pages/admin/EquipoScreen.tsx`, `pages/public/BookingPage.tsx`, `pages/admin/agenda-ui.tsx` (NuevaCitaModal), `pages/recepcion/RecepcionApp.tsx`, `pages/spec/spec-walkin.tsx`, `pages/admin/ServiciosScreen.tsx`, `lib/useEquipo.ts`, `lib/useServicios.ts`.
2. Suite completa como baseline.

## E1 · Esquema y migración 0019

**Archivos:** `db/schema/team.ts`, `drizzle/0019_*.sql`.

1. Tabla `especialistaServicio` calcada de `especialistaSucursal` (§2.1), importando `servicio` desde `./catalog`.
2. `drizzle-kit generate`; **extender a mano** el SQL con el bloque RLS (ENABLE + FORCE + política EXISTS, §2.1). Verificar el SQL final contra `0002_rls_y_rol_app.sql:159-163`.
3. Aplicar en local (`pnpm db:migrate`); smoke: INSERT/SELECT con el rol de app dentro de `runInTenantTx` funciona, y NO se ven filas de otro tenant.

**Verificación:** suite verde intacta (tabla nueva sin consumidores).

## E2 · Tipos compartidos

`packages/shared/src/dtos.ts`: los 4 cambios de §2.3. Build dual + typecheck api/web.

## E3 · EquipoService: asignación y lectura

**Archivos:** `negocio/equipo.service.ts`, `negocio/equipo.controller.ts`, `negocio/verificacion-especialista.service.ts`, `negocio/dto/*` (donde vivan los DTOs de equipo).

1. `asignarServicios(ctx, id, servicioIds)` calcado de `asignarSucursales` (validar existencia de los ids en el negocio; delete+reinsert). Endpoint `PUT /especialistas/:id/servicios` (Admin). **Ojo con el orden de rutas**: en `equipo.controller.ts` ya existe el patrón `mi/foto` antes de `:id/foto` — las rutas nuevas con `:id` no colisionan, pero mantener las literales primero.
2. `listar()` (el que alimenta `GET /especialistas`): añadir `servicioIds` por especialista con una consulta agrupada (mismo patrón que `sucursalIds`). **Filtrar por `servicio.activo=true`** al leer (D9: un servicio desactivado no debe aparecer como chip).
3. `crear(...)`: nuevo parámetro opcional `servicioIds` → inserta las filas tras crear (dentro de la misma tx).
4. **Alta con verificación:** `iniciar` guarda `servicioIds` en `datos_borrador`; `confirmar` los pasa a `equipo.crear`. Sin cambios de esquema (jsonb).
5. `citasFuturasDe(ctx, id)` para el endpoint `GET /especialistas/:id/citas-futuras`.

**Verificación (tests, en `negocio/` siguiendo el patrón de specs con BD real):** asignar y leer servicios; `[]` limpia (vuelve a "todos"); ids de otro negocio → rechazo; alta con verificación conserva los servicios del borrador; especialista sin filas devuelve `servicioIds: []`.

## E4 · Validación central y reasignación endurecida

**Archivos:** `agendamiento/validators/validador-cita.port.ts`, `validador-publico.ts`, `validador-interno.ts`, `agendamiento/agendamiento.service.ts`, helper de §2.2.

1. Implementar `realizaServicios` / `filtrarPorServicios` (§2.2) — funciones puras sobre `tx`, exportadas y unit-testeables.
2. `validarEntidades` gana el chequeo: si `datos.servicioIds` viene y `datos.validarServicios !== false`, exigir `realizaServicios`. Mensaje de error claro: `'El especialista no realiza alguno de los servicios seleccionados.'`
3. Cablear `servicioIds` en los datos que pasan `ValidadorPublico` (confirmar) y `ValidadorInterno` (crearInterna). **Walk-in retroactivo: pasar `validarServicios: false`** (D5) — el flag viaja desde `walkInRetroactivo`.
4. `reasignar`: antes del update, validar destino activo + `especialistaSucursal` de la sucursal de la cita + `realizaServicios` con los servicios de la cita (leer de `cita_servicio`). Errores 400 con mensajes distinguibles.

**Verificación (tests):** especialista restringido a Corte no puede recibir cita de Tinte (público e interno); sin filas → acepta cualquier servicio (D2); retroactivo NO se bloquea; reasignar a inactivo/otra sede/no-capacitado → 400; reasignar válido sigue funcionando. **Los 9 escenarios existentes de `agendamiento.spec.ts` pasan SIN tocarlos** (regresión D2).

## E5 · Disponibilidad y flujo público

**Archivos:** `agendamiento/disponibilidad.service.ts`, `agendamiento/public-agendamiento.service.ts`.

1. `franjasPublicas`: en la rama `'any'` (líneas ~73-90), tras obtener los candidatos, aplicar `filtrarPorServicios(tx, candidatos, servicioIds)`. En la rama de especialista concreto: si no `realizaServicios` → `[]` (sin error: el front ya lo habrá filtrado; la lista vacía es coherente con el resto de "sin franjas").
2. `serviciosPublicos`: añadir `especialistaIds` — UNA consulta: especialistas activos+disponibles de la sucursal (join `especialistaSucursal`) + sus filas de `especialista_servicio`; en memoria, resolver D2 (sin filas → está en todos los servicios). Devolver el campo en TODOS los servicios (incluso vacíos, §2.3).
3. `confirmar`: ya pasa por `ValidadorPublico` (E4) — verificar que `servicioIds` llegan al validador; añadir además la revalidación de que el ESPECIALISTA DE LA RETENCIÓN sigue activo+disponible (hoy no se revalida y entre retener y confirmar pudo darse de baja — hueco menor que se cierra gratis aquí).

**Verificación (tests, ampliando `agendamiento.spec.ts` con un segundo especialista restringido):** `servicios` públicos traen `especialistaIds` correctos; franjas `'any'` excluyen al que no realiza el servicio; franjas de especialista concreto no-capacitado → vacías; combo de 2 servicios solo ofrece a quien realiza ambos; confirmar con especialista retenido pero recién dado de baja → rechazo limpio.

## E6 · Baja con citas futuras + aviso al cliente en cancelación interna

**Archivos:** `negocio/equipo.service.ts`, `negocio/equipo.controller.ts`, `agendamiento/agendamiento.service.ts` (o servicio auxiliar), `notificaciones` (solo consumo).

1. `darDeBaja(ctx, id, accion?)`: sin `accion` y con citas futuras → `ConflictException` con `{ citasFuturas }` (el 409 ya se usa en el repo para conflictos de dominio). Con `accion`:
   - `reasignar`: por cada cita futura (orden cronológico), candidatos = activos + disponibles + de la sucursal de la cita + `filtrarPorServicios` con los servicios de la cita, excluyendo al que se va. Intentar en orden con captura de `23P01` (solape) → siguiente candidato. Sin candidato → cancelar esa cita (transición válida desde solicitada/confirmada) + aviso al cliente + aviso al especialista nuevo en las reasignadas (mecanismo existente de `reasignar`). **Cada cita en su propia `runInTenantTx`** (D7).
   - `cancelar`: cancelar todas + `encolarAviso` al cliente (si tiene teléfono) — el interruptor de mensajería ya gobierna si sale de verdad.
   - Al final: `setActivo(false)`. Devolver `{ reasignadas, canceladas }`.
2. **Extra (hueco existente):** en `AgendamientoService.cancelar` (`:160-164`), además del aviso al especialista, encolar `aviso` al CLIENTE de la cita si tiene teléfono — calcando cómo lo hace la cancelación pública (`public-agendamiento.service.ts:495-502`), post-commit y sin romper el flujo si falla.
3. `GET /especialistas/:id/citas-futuras` (lectura simple).

**Verificación (tests):** baja sin citas futuras → directa (regresión); con citas → 409 con conteo; `reasignar` mueve a un candidato capaz y cancela la que no tiene candidato (sembrar un caso de cada); `cancelar` cancela todas y encola avisos (assert sobre la tabla `mensaje`/outbox en modo mock); citas PASADAS no cuentan ni se tocan; cancelación interna encola aviso al cliente.

## E7 · Frontend — Equipo

**Archivos:** `pages/admin/EquipoScreen.tsx`, `lib/useEquipo.ts`, `lib/useServicios.ts` (lectura).

1. `useEquipo.ts`: `asignarServicios(id, servicioIds)` → `PUT /especialistas/:id/servicios`; `citasFuturas(id)`; `darDeBajaEspecialista(id, accion?)` con manejo del 409; `IniciarVerificacionBody` += `servicioIds?`.
2. **`SpecialistModal`:** bloque "Servicios que realiza" con botones-checkbox calcados del bloque de sucursales (`:402-415`), alimentado por `useServicios()` (solo activos), con leyenda permanente: "Sin selección = realiza todos los servicios". Al crear: viaja en `iniciarVerificacion` (borrador). Al editar: `asignarServicios` junto a `asignarSucursales`.
3. **`SpecialistCard`:** chips de servicios bajo los de sucursales — si `servicioIds` vacío, un único chip "Todos los servicios"; si no, hasta 3 chips + "+N más" (los nombres se resuelven con el catálogo de `useServicios`). Acción "Asignar servicios" en el `RowMenu` que abre el modal directo en ese bloque (o el modal de edición normal — decisión ejecutora, lo simple gana).
4. **Flujo de baja:** al eliminar, si la API devuelve 409, abrir un `Dialog` de decisión: texto con el conteo y la muestra de citas (`citasFuturas`), dos opciones — "Reasignar automáticamente" (explica el fallback: las que nadie pueda atender se cancelan y se avisa al cliente) y "Cancelar las citas" — más "Volver". Tras ejecutar, toast con `{reasignadas, canceladas}`.

**Verificación:** typecheck + manual con `pnpm dev`: crear especialista con 2 servicios (el código visible del alta aparece porque la mensajería local está en mock), chips correctos, editar asignación, baja con citas futuras muestra el modal y los resultados.

## E8 · Frontend — Reserva pública

**Archivos:** `pages/public/BookingPage.tsx`.

1. **Paso Servicios:** ocultar los servicios con `especialistaIds` vacío (si TODOS quedan ocultos → `EmptyState` "Este negocio aún no tiene reservas en línea disponibles"). Durante la multiselección, deshabilitar (atenuado, no clicable, con subtítulo "No disponible junto a tu selección") los servicios cuya intersección de `especialistaIds` con la selección actual sea vacía (D4). Al deseleccionar, recalcular.
2. **Paso Especialista:** filtrar la lista a la intersección de `especialistaIds` de los servicios elegidos; "Cualquiera disponible" se mantiene (el backend ya filtra el `'any'`). Si solo queda 1 especialista, mostrar igual la pantalla (transparencia).
3. El paso Horario e Identificación no cambian (el backend ya devuelve franjas correctas). El manejo de "no hay franjas" existente cubre el resto.
4. **Gestión de cita existente:** no tocar — usa la cita ya creada, con su especialista y servicios históricos.

**Verificación:** manual con dos especialistas de servicios disjuntos: elegir Servicio A oculta al especialista B; combo imposible queda deshabilitado; servicio sin nadie no aparece; reserva completa con OTP en pantalla (mock) llega a confirmación. Gotcha e2e: los specs de Playwright preexistentes rotos NO son regresión (lista en memoria `twilio-real-en-env-local`).

## E9 · Frontend — Flujos internos

**Archivos:** `pages/admin/agenda-ui.tsx` (NuevaCitaModal), `pages/recepcion/RecepcionApp.tsx` (WalkinModal + ReasignarDialog), `pages/spec/spec-walkin.tsx`.

1. **`NuevaCitaModal`:** al filtro por sucursal existente, añadir filtro por servicios seleccionados (intersección con `servicioIds` de `EspecialistaEquipo`, D2 = vacío pasa siempre). Bidireccional: si ya hay especialista elegido, los servicios que no realiza se deshabilitan con nota. Si el especialista elegido queda fuera al cambiar servicios → deseleccionar (patrón existente al cambiar sede, `:296-298`).
2. **`WalkinModal` (recepción):** aplicar AMBOS filtros que hoy no tiene: por sucursal (calcar NuevaCitaModal) y por servicios.
3. **`WalkinSpec`:** filtrar el catálogo a los servicios que el especialista logueado realiza (su `servicioIds` — necesita llegarle: `GET /especialistas` ya lo trae y el spec puede leer su propia ficha; si el rol especialista no puede listar el equipo, exponer sus servicios en el `me` o filtrar contra un `GET /servicios` anotado — decisión ejecutora con la opción MÁS simple que funcione, documentándola). En walk-in retroactivo NO filtrar (D5), solo en vivo.
4. **`ReasignarDialog`:** candidatos = activos, de la sucursal de la cita, que realizan todos los servicios de la cita (datos ya presentes en `useEquipo` + `cita.servicios`... **ojo**: `CitaAgenda.servicios` trae `{nombre, precio}` sin id — la forma más simple es resolver por nombre contra el catálogo o añadir `servicioIds` a `CitaAgenda` en shared/backend; **añadir `servicioIds: string[]` a `CitaAgenda`** es lo correcto y barato — incluirlo en E2/E5 al construir la agenda). Mensaje si no hay candidatos: "Ningún otro especialista puede atender esta cita".

**Verificación:** manual en los tres paneles con el mismo par de especialistas disjuntos; y confirmar que el backend rechaza igualmente si se fuerza (validación E4).

## E10 · Frontend Servicios + cierre

**Archivos:** `pages/admin/ServiciosScreen.tsx`, `lib/useServicios.ts`.

1. **`ServiceCard`:** contador "Lo realizan N especialistas" (derivado de `useEquipo`: cuántos lo incluyen o no tienen restricción) y badge de advertencia "Sin especialista asignado — no aparece en reservas" cuando N=0. Diálogo de desactivación: si hay citas futuras que lo incluyen, nota informativa (dato de un endpoint ligero o del propio listado de citas — decisión ejecutora; no bloquea).
2. **Cierre:** suite completa api (baseline 316+nuevos, sin regresiones), typecheck y build de los 3 paquetes, regresión manual del flujo público completo, commit(s) en español (`feat(servicios): ...`), push a `main` **solo tras aprobación de EL USUARIO**, verificación post-deploy: los endpoints nuevos responden (401/409 esperados), reserva pública real de humo en un negocio de prueba.

---

# PARTE IV — GOTCHAS DEL REPO PARA LA EJECUTORA

1. **`@orkalis/shared` dual CJS+ESM**: build tras tocar `dtos.ts` o api/web verán tipos viejos.
2. **Migraciones**: `drizzle-kit generate` + extensión manual SOLO para el bloque RLS (§2.1); en producción las aplica el entrypoint.
3. **RLS**: todo acceso de negocio va por `runInTenantTx`; la tabla nueva se aísla vía `EXISTS` sobre `especialista` (política FORCE — el rol de app no la salta).
4. **Concurrencia**: capturar `23P01` (EXCLUDE) en cada intento de reasignación, patrón de `crearInterna`/`retener`.
5. **Twilio real en `.env` local**: vaciar `TWILIO_*` en tests y `pnpm dev` (memoria `twilio-real-en-env-local`); los avisos van al outbox con `MockAdapter` y se asertan en la tabla `mensaje`.
6. **Specs con BD real**: los specs construyen servicios a mano (`new XService(deps)`) — al añadir dependencias a constructores (p. ej. si `AgendamientoService` gana un helper inyectado), actualizar TODOS los specs que lo instancian (buscar `new AgendamientoService`, `new EquipoService`, etc.).
7. **Orden de rutas Nest** por declaración: literales antes que `:id` (patrón `mi/foto` en `equipo.controller.ts`).
8. **`Input`/`Select` del design system** usan eventos React estándar; los botones-checkbox del modal de especialista son el patrón para la multiselección de servicios.
9. **Iconos**: solo claves de `ui/icons.ts` (verificar antes de usar; existen `scissors`, `check`, `alert-triangle`, `users`, `store`, `list`).
10. **Popover/menús**: usar el `Popover` portaleado de `ui/ui.tsx` para menús nuevos.
11. **No modificar los 9 escenarios existentes de `agendamiento.spec.ts`**: si alguno falla, la regla D2 está mal implementada — arreglar el código, no el test.

# PARTE V — CRITERIOS DE ACEPTACIÓN (checklist final)

- [ ] Existe `especialista_servicio` (N:M) con RLS y CASCADE, sin datos sembrados.
- [ ] El admin asigna servicios por multiselección al crear (incluido el flujo con verificación por celular) y al editar; la tarjeta muestra chips ("Todos los servicios" cuando no hay restricción).
- [ ] **Regresión D2**: un negocio sin asignaciones se comporta EXACTAMENTE igual que antes del despliegue (specs de agendamiento intactos).
- [ ] En el link público: un servicio sin especialista capaz (por baja, ocupado o desasignación) no se puede elegir; los servicios incompatibles entre sí se deshabilitan durante la multiselección; el paso de especialistas solo muestra a quienes realizan TODO lo elegido; "Cualquiera disponible" nunca asigna a alguien que no realiza el combo.
- [ ] El servidor rechaza (400) cualquier intento de crear cita —pública, interna o walk-in vivo— con un especialista que no realiza alguno de los servicios; el walk-in retroactivo NO se bloquea.
- [ ] Reasignar valida activo + sucursal + servicios, en API y en UI (candidatos filtrados).
- [ ] Dar de baja con citas futuras: 409 con conteo → el admin elige reasignar (con fallback a cancelar+avisar) o cancelar todo; la respuesta y la UI informan el resultado; citas pasadas intactas.
- [ ] Quitar un servicio a un especialista NO altera citas existentes (solo bloquea nuevas).
- [ ] Desactivar un servicio lo saca del link y de los chips sin tocar citas futuras; su tarjeta advierte cuando nadie lo realiza.
- [ ] La cancelación interna ahora avisa al cliente (y la baja con cancelaciones también), respetando el interruptor de mensajería.
- [ ] Flujos internos (cita interna, walk-ins, reasignación) con filtrado bidireccional coherente con el público.
- [ ] Suite api en verde (sin contar los 6 flaky preexistentes de mensajería) + typecheck/build de los 3 paquetes.
