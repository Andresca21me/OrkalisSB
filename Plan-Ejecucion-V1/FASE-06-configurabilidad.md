# FASE-06 · Configurabilidad (registry + ConfigResolver + herencia)

## Objetivo
Implementar el **mecanismo único de configuración** de Orkalis: un **registry de claves en código** (con defaults por vertical salón/barbería y validación de dominio), la tabla `configuracion` de overrides dispersos, y el **`ConfigResolver`** que resuelve cada valor por la cadena `sistema → negocio → sucursal`, devuelve su **procedencia**, cachea y se invalida por evento. Banderas de módulo y parámetros financieros usan **el mismo** mecanismo (ADR-002).

## Prerrequisitos
- FASE-04 (repositorio con scope) y FASE-05 (RBAC; solo admin edita config).

---

## Pasos de Claude

### 1. Registry de claves (en código, fuente de verdad)
Crear `apps/api/src/config-module/registry.ts` con un mapa de TODAS las claves. Cada clave define: `clave`, `tipo` (`boolean`|`porcentaje`|`numero`|`enum`|`dinero`|`duracion`), `nivelMinimoEdicion`, `default` **por vertical** (`salon` / `barberia`), y `validacion`. Claves mínimas (de ADR-002 §contexto y RF-008/009):

**Banderas de módulo (boolean):**
- `modulo.inventario` (default: salon ON, barberia según; decidir defaults sensatos)
- `modulo.particion_por_especialista`
- `modulo.cierre_periodo`
- `agendamiento.aprobacion_manual` (default OFF → confirmación automática es el comportamiento por defecto)

**Parámetros financieros y operativos:**
- `finanzas.reparticion_profesional` (porcentaje)
- `finanzas.reparticion_salon` (porcentaje) — **validación cruzada: prof + salon = 100**
- `finanzas.deduccion_administrativa` (porcentaje)
- `finanzas.comision_bancaria` (porcentaje) — p. ej. descuento por transferencia (HU-ADM-009 menciona 2%)
- `finanzas.tarifa_cliente_profesional` (dinero/porcentaje)
- `agendamiento.antelacion_cancelacion_horas` (numero)
- `agendamiento.ventana_recordatorio_horas` (numero)
- `agendamiento.duracion_retencion_min` (duracion, TTL del bloqueo de franja)

> Estos son el mínimo; agrega los que el dominio pida, pero **siempre** en el registry, nunca claves sueltas.

### 2. Validación de dominio centralizada
- Cada `validacion` corre en **toda escritura**, sin importar el nivel (RF-012): porcentajes 0–100, booleanos válidos, y la **regla cruzada repartición prof + salón = 100%** (HU-ADM-004 escenario 2). Rechazar el guardado con mensaje claro si no cumple.

### 3. Tabla `configuracion` (ya creada en FASE-03)
- Guarda **solo overrides**: una fila por `(negocio_id, nivel, ambito_id, clave)`. Lo no definido cae al nivel superior y, en última instancia, al default del vertical.

### 4. `ConfigResolver` (servicio NestJS)
Crear `config-resolver.service.ts`:
- `resolver(negocioId, sucursalId, clave)` → `{ valor, procedencia }` donde `procedencia ∈ {sistema, negocio, sucursal}`.
- Orden: busca override de **sucursal**; si no, de **negocio**; si no, el **default del vertical** (lee `negocio.perfil`). Gana el más específico.
- `resolverModulo(...)` y helpers tipados para banderas vs. parámetros.
- Exponer también `getEfectivos(negocioId, sucursalId)` que devuelve TODAS las claves resueltas con su procedencia (para la UI de admin, RF-010).

### 5. Caché + invalidación por evento
- Cachear el config resuelto por `(negocio_id, sucursal_id)` (en memoria; basta para la escala v1).
- Emitir un evento `config.updated` al guardar un override; al recibirlo, invalidar la entrada de caché afectada. (Reutiliza el patrón `financial-settings-updated` que menciona ADR-002.)

### 6. Escritura de overrides (endpoints admin)
- `PUT /api/config/:nivel/:ambitoId/:clave` (solo admin, con `SucursalScopeGuard` si nivel=sucursal): valida con el registry y hace upsert en `configuracion`, luego invalida caché.
- `GET /api/config?sucursalId=...` → valores efectivos + procedencia.
- `DELETE` del override = "volver a heredar".

### 7. Clonar configuración de otra sucursal (RF-011)
- Acción `clonarConfig(sucursalOrigenId, sucursalDestinoId)`: copia los **overrides efectivos** del origen como overrides propios del destino (**instantánea**, no enlace vivo). Documentar en la UI que cambios posteriores en el origen NO se propagan (ADR-002).

---

## ⚠️ ACCIÓN DEL USUARIO
- Ninguna. (Los defaults por vertical los decide Claude con criterio sensato y los confirma con el USUARIO si hay duda en algún porcentaje.)

---

## Verificación / Done
- `ConfigResolver` devuelve el default del vertical cuando no hay overrides; el override de negocio gana sobre el default; el de sucursal gana sobre el de negocio; y la **procedencia** reportada es correcta en cada caso.
- Guardar repartición que no suma 100% es **rechazado**.
- Desactivar `modulo.inventario` en una sucursal no afecta a las demás (HU-ADM-003 escenario 2).
- Clonar config de sucursal A a B copia los overrides; cambiar A después no cambia B.
- La caché se invalida al guardar (no devuelve valores viejos).
- Pruebas unitarias del resolutor (cascada + procedencia) y de la validación cruzada.

## Trazabilidad
- ADR-002 completo, RF-008, RF-009, RF-010, RF-011, RF-012, RNF-015 (config sin código), HU-ADM-003, HU-ADM-004.
