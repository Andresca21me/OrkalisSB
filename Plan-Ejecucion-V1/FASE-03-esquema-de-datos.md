# FASE-03 · Esquema de datos completo

## Objetivo
Definir en Drizzle **todas las tablas del modelo ER** de Orkalis, con sus columnas de tenant/sucursal, índices, la **restricción de exclusión** anti doble-reserva, y las tablas de soporte de agendamiento y configuración. Sin RLS todavía (eso es FASE-04), pero con la estructura lista para activarlo.

## Prerrequisitos
- FASE-02 completa (Drizzle conectado, migraciones funcionando, `btree_gist` instalada).
- Tener a la vista el diagrama `Documentacion/Diagramas/modelo-er.svg`.

---

## Regla transversal del modelo (ADR-001)
- **Toda tabla** tiene `negocio_id` (FK a `negocio`). 
- Las **tablas operativas** tienen además `sucursal_id` (FK a `sucursal`).
- PK por defecto: `id uuid default gen_random_uuid()`.
- Timestamps: `creado_en timestamptz default now()`, `actualizado_en timestamptz`.
- Borrado lógico donde la doc lo pide (cliente, especialista, gasto): columna `activo boolean default true` (o `archivado_en`).

---

## Pasos de Claude — definir las tablas
Crear un archivo por grupo dentro de `apps/api/src/db/schema/` y reexportar en `index.ts`. Tablas exactas (nombres del ER):

### Grupo A — Tenencia y cuenta
1. **`negocio`**: `id`, `nombre`, `perfil` (`salon`|`barberia`), `estado_suscripcion` (`activa`|`suspendida`, default `activa`), timestamps.
2. **`suscripcion`**: `id`, `negocio_id`, `plan` (`basico`|`pro`|`premium`|`empresarial`), `num_especialistas` (int: especialistas facturables/activos), `estado`, timestamps. (El cobro se calcula por **plan + nº de especialistas**, RF-006 / ADR-009. El catálogo de precios/cupos vive en código, no en BD.)
3. **`sucursal`** (operativa-base): `id`, `negocio_id`, `nombre`, `activa boolean default true`, timestamps.
4. **`usuario`**: `id`, `negocio_id`, `nombre`, `email` (único por negocio), `password_hash`, `rol` (RolUsuario), `activo`, timestamps. (Sin `sucursal_id` directo: el alcance de sucursal va en `usuario_sucursal` o en claims; ver nota.)
   - Tabla relación **`usuario_sucursal`** (`usuario_id`, `sucursal_id`): alcance de sucursales del usuario (para RBAC, RF-014). PK compuesta.

### Grupo B — Equipo
5. **`especialista`**: `id`, `negocio_id`, `nombre`, `especialidad`, `disponible boolean default true`, `usuario_id` (opcional, si el especialista inicia sesión), `activo`, timestamps.
6. **`especialista_sucursal`** (relación N:N): `especialista_id`, `sucursal_id`. PK compuesta. (Un especialista pertenece a varias sucursales pero opera en una a la vez — Definición §6.)

### Grupo C — Clientes y catálogo
7. **`cliente`**: `id`, `negocio_id`, `nombre`, `telefono`, `activo boolean default true`, timestamps. Índice por `(negocio_id, telefono)` para deduplicar (RF-034). *(El cliente es de nivel negocio, no sucursal.)*
8. **`servicio`**: `id`, `negocio_id`, `nombre`, `precio` (numeric/centavos), `duracion_min` (int), `categoria`, `split_type` (`porcentaje`|`valor_fijo`), `split_valor` (numeric: % o valor fijo al profesional), `activo`, timestamps. (RF-035, RF-036.)

### Grupo D — Operación: citas y atenciones (operativas → con `sucursal_id`)
9. **`cita`**: `id`, `negocio_id`, `sucursal_id`, `cliente_id` (nullable para walk-in sin datos), `especialista_id`, `inicio timestamptz`, `fin timestamptz`, `rango tstzrange` (generado de inicio/fin, usado por el `EXCLUDE`), `estado` (EstadoCita), `origen` (OrigenCita), `precio_est` (numeric, estimado), timestamps.
   - **Restricción de exclusión anti doble-reserva (ADR-005):**
     ```sql
     ALTER TABLE cita ADD CONSTRAINT cita_no_solape
       EXCLUDE USING gist (
         especialista_id WITH =,
         sucursal_id WITH =,
         rango WITH &&
       ) WHERE (estado IN ('confirmada','en_progreso'));
     ```
     > El `WHERE` evita que citas canceladas/no_asistió/completadas bloqueen la franja. Definir `rango` como columna `tstzrange` (puede ser `GENERATED ALWAYS AS (tstzrange(inicio, fin))` o mantenerse en la app). Requiere `btree_gist`.
   - Índices: `(negocio_id, sucursal_id, inicio)`, `(especialista_id, inicio)`.
10. **`cita_servicio`**: `id`, `cita_id`, `servicio_id`, `precio_aplicado` (numeric). Servicios previstos/realizados de la cita.
11. **`atencion`** (operativa): `id`, `negocio_id`, `sucursal_id`, `cita_id`, `especialista_id`, `total` (numeric), `gan_prof` (numeric), `gan_salon` (numeric), `metodo_pago` (MetodoPago), `snapshot_param` (jsonb: porcentajes/valores aplicados — ADR-006), `creado_en`. Es el **cierre financiero** del turno al completar.
12. **`atencion_producto`**: `id`, `atencion_id`, `producto_id`, `cantidad` (int), `valor` (numeric). Productos consumidos/vendidos en la atención.

### Grupo E — Inventario y ventas (operativas, módulo opcional)
13. **`producto`**: `id`, `negocio_id`, `sucursal_id`, `nombre`, `tipo` (`servicio`|`venta`), `cantidad` (int, stock actual), `stock_min` (int), `costo` (numeric), `precio_venta` (numeric), `activo`, timestamps. (RF-037.)
14. **`movimiento_inventario`** (soporte de RF-037/RF-038): `id`, `negocio_id`, `sucursal_id`, `producto_id`, `tipo_mov` (`entrada`|`salida`|`ajuste`), `cantidad`, `motivo`, `gasto_id` (nullable, si la entrada por compra generó gasto), `creado_en`.
15. **`venta_producto`** (operativa): `id`, `negocio_id`, `sucursal_id`, `especialista_id` (nullable), `producto_id`, `cantidad`, `total` (numeric), `comision_prof` (numeric), `creado_en`. (RF-039.)

### Grupo F — Finanzas
16. **`gasto`** (operativa): `id`, `negocio_id`, `sucursal_id`, `tipo` (`fijo`|`variable`), `categoria`, `monto` (numeric), `frecuencia` (nullable, p. ej. mensual para fijos), `activo boolean default true`, `creado_en`. (RF-040.)
17. **`liquidacion`** (operativa): `id`, `negocio_id`, `sucursal_id`, `especialista_id`, `periodo` (text o rango de fechas), `bruto` (numeric), `descuento` (numeric), `neto` (numeric), `pagado boolean default false`, `creado_en`. (RF-043.)
18. **`cierre_periodo`** (opcional, RF-046): `id`, `negocio_id`, `sucursal_id` (nullable si es de negocio), `tipo` (`quincenal`|`mensual`), `desde`, `hasta`, `datos_archivados` (jsonb o referencia), `creado_en`.

### Grupo G — Configuración (ADR-002)
19. **`configuracion`**: `id`, `negocio_id`, `nivel` (`negocio`|`sucursal`), `ambito_id` (uuid: el negocio_id o el sucursal_id según nivel), `clave` (text), `valor` (text/jsonb), `tipo` (text). Guarda **solo overrides**. Único por `(negocio_id, nivel, ambito_id, clave)`.
   > El catálogo/registry de claves vive en **código**, no en BD (FASE-06).

### Grupo H — Soporte de agendamiento (ADR-005)
20. **`disponibilidad`** (operativa): `id`, `negocio_id`, `sucursal_id`, `especialista_id`, `dia_semana` (0–6) o fecha específica, `hora_inicio`, `hora_fin`, `activo`. Define las ventanas en que el especialista puede recibir reservas.
21. **`retencion_franja`** (operativa): `id`, `negocio_id`, `sucursal_id`, `especialista_id`, `rango tstzrange`, `expira_en timestamptz`, `creado_en`. Bloqueo temporal (TTL) mientras el cliente confirma. 
    - Considerar también un `EXCLUDE` sobre `retencion_franja` (especialista+sucursal+rango) con `WHERE expira_en > now()` para que dos retenciones no se solapen; y/o que la disponibilidad consulte tanto `cita` como `retencion_franja` vigentes.
22. **`otp_codigo`** (soporte FASE-08): `id`, `negocio_id` (nullable hasta resolver sucursal), `telefono`, `codigo_hash`, `expira_en`, `intentos`, `consumido boolean`, `creado_en`.

---

## Pasos de Claude — migración y seed
1. Generar la migración con `drizzle-kit generate` y aplicarla. La restricción `EXCLUDE` y los `GENERATED` puede que requieran SQL crudo dentro de la migración (Drizzle permite `sql` en migraciones); revísalo.
2. Crear un **seed de desarrollo** (`apps/api/src/db/seed.ts`) que inserte: 1 negocio (perfil barbería), 1 suscripción, 2 sucursales, 1 usuario admin, 2 especialistas (uno en 2 sucursales), 3 servicios, algunos clientes. Sirve para probar todo lo demás. *(El seed inserta saltándose RLS usando un rol/conexión de superusuario o fijando el tenant manualmente.)*

---

## ⚠️ ACCIÓN DEL USUARIO
- Ninguna.

---

## Verificación / Done
- La migración aplica limpio sobre una BD vacía (`docker compose down -v` + `up` + `db:migrate`).
- La restricción `cita_no_solape` existe: intentar insertar dos citas `confirmada` solapadas para el mismo especialista/sucursal **falla** con error de exclusión.
- Todas las tablas del ER existen con `negocio_id`, y las operativas con `sucursal_id`.
- El seed corre sin error y deja datos consultables.

## Trazabilidad
- ADR-001 (columnas de tenant/sucursal, `especialista_sucursal`), ADR-002 (`configuracion`), ADR-005 (`EXCLUDE`, `retencion_franja`, `disponibilidad`), ADR-006 (`atencion.snapshot_param`). Cubre el modelo ER completo.
