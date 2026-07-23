# PLAN-INVENTARIO · Inventario, venta en citas y finanzas integradas — Orkalis

> **Para quién es este documento.** Para el dueño del producto (EL USUARIO) y para la IA ejecutora. Integra el **módulo de inventario** con la **venta de productos al finalizar citas** y con **Finanzas** (gasto por compra, costo promedio ponderado, comisión configurable al especialista, historiales y liquidaciones con desglose).
>
> **Regla de oro:** este es el PLAN. **No se escribe código hasta que EL USUARIO apruebe.** Es una **FASE ÚNICA** dividida en etapas ordenadas (E1…E11); cada etapa tiene su verificación y no se avanza si no pasa. Si algo choca con `/Documentacion`, **gana la documentación** y se avisa.
>
> **Estado del análisis:** completo. Basado en el código real (`apps/api`, `apps/web`, `packages/shared`), el SRS (RF-037, RF-038, RF-039), la HU-ADM-007 y el ADR-006 (cierre financiero con snapshot auditable).
>
> **Alcance de despliegue:** al terminar y verificar, se hace commit + push a `main` (Railway despliega ambos servicios solo). La migración la aplica el entrypoint del contenedor (`docker-entrypoint.sh` → `node dist/db/migrate.js`).

---

## 0. Decisiones de producto (cierran los huecos del requerimiento)

El requerimiento original dejaba varios puntos abiertos o en conflicto con el código existente. Estas decisiones los cierran; si EL USUARIO quiere otra resolución, se cambia ANTES de ejecutar:

| # | Tema | Resolución |
|---|------|-----------|
| D1 | Costo del producto al recargar | **Costo promedio ponderado**: `nuevoCosto = (stockActual×costoActual + costoCompra) / (stockActual + cantidadComprada)`, redondeado a 2 decimales. Si el stock actual es negativo (D7), se toma como 0 para el cálculo. Solo recalcula en **entradas con costo declarado**; salidas, ajustes y entradas sin costo (p. ej. reingreso por reversión) NO tocan el costo. El costo sigue siendo editable a mano en la ficha (override consciente del admin). |
| D2 | Comisión por venta de producto | **Global por negocio/sucursal vía configuración** (no por producto, no por request): dos claves nuevas, `finanzas.comision_producto_tipo` (`porcentaje` \| `valor_fijo`) y `finanzas.comision_producto_valor`. `porcentaje` = % sobre el valor de la línea; `valor_fijo` = monto fijo COP **por unidad vendida**, con tope en el valor de la línea. Valor `0` = **Opción A (100 % al negocio)** — es el default, conserva el comportamiento actual. La comisión se calcula **SIEMPRE en el servidor**; se elimina el 10 % hardcodeado "prototipo" del frontend y el campo `comisionProf` que hoy viaja en el request de venta directa. |
| D3 | A quién se acredita | En venta **dentro de una cita**: al especialista de la atención. En venta **directa** (modal de Finanzas): al especialista que se seleccione (opcional; sin especialista no hay comisión). Con `modulo.particion_por_especialista` OFF la comisión es 0 (coherente con `ganProf = 0` actual). |
| D4 | Separación contable | `atencion.ganProf` **incluye** la comisión por productos (así liquidaciones y reportes existentes siguen cuadrando sin reescribirse), y una **columna nueva `atencion.comision_productos`** guarda la parte de productos para poder desglosarla en liquidaciones, reportes y el panel del especialista. La deducción administrativa y la tarifa cliente→profesional siguen aplicando **solo a servicios** (no a productos); la comisión bancaria no cambia (porción electrónica del total). |
| D5 | Trazabilidad total de stock | HOY `completar`/`revertir` mueven stock **sin registrar movimiento**. Pasa a ser ley: **toda variación de stock inserta una fila en `movimiento_inventario`**, que además guarda `costo_total` (compras) y `stock_resultante` (kardex legible). |
| D6 | Historial de ventas unificado | Las ventas en cita viven en `atencion_producto` y las directas en `venta_producto`; **NO se duplica el registro** (insertarlo en ambas duplicaría ingresos en `reportes.analisis`, que ya suma `venta_producto`). El historial es una **unión de lectura** de ambas fuentes con campo `origen: 'cita' | 'directa'`. |
| D7 | Stock insuficiente | Clave nueva `inventario.permitir_stock_negativo` (boolean, default **false**). OFF = comportamiento actual (bloquea). ON = la venta (directa o en cita) y la salida manual pueden dejar stock negativo; la UI lo muestra en rojo y avisa antes de confirmar. Entradas y reversiones nunca se bloquean. |
| D8 | Cancelar/revertir una cita finalizada | `POST /citas/:id/revertir` acepta body opcional `{ reponerStock?: boolean }` (default `true`). La UI pregunta "¿Reingresar los productos al inventario?" con casilla marcada por defecto. Si NO se repone (producto ya usado/dañado), el stock queda como está — la salida ya quedó registrada al completar (D5). La acción **Revertir** se agrega también al menú del admin (hoy solo la tiene el especialista). |
| D9 | Margen exacto (extra) | Cada línea de venta guarda **snapshot** del costo unitario vigente (`costo_unitario`) y de la comisión (`comision` en `atencion_producto`). Así el margen y el CMV (costo de lo vendido) de los reportes son exactos e inmunes a cambios posteriores de costo — mismo principio del `snapshot_param` del ADR-006. |
| D10 | Pago de productos en la cita | El requerimiento pedía "elegir si el producto se paga con el mismo método o por separado". **Ya está resuelto por el pago dividido existente** (`atencion_pago` + `PagoSplit`): los productos suben el total y el cobro puede repartirse en varios métodos. No se construye nada nuevo aquí; solo se garantiza que el total del `PagoSplit` incluya los productos. |
| D11 | Gating por plan y por configuración (transversal) | TODO lo de este plan vive detrás de `modulo.inventario`, que solo está **disponible desde el plan Pro** y solo **activo si el admin lo enciende** en Configuración → Módulos (regla existente `plan ∧ config` de `ModuloGate`). Regla de decisión para cada superficie nueva: **operaciones nuevas** (vender, recargar, historiales, comisión) → bloqueadas sin el módulo; **datos históricos** (ventas/comisiones/gastos registrados cuando el módulo estaba activo) → SIEMPRE visibles en reportes, liquidaciones e historial aunque el módulo se apague después (apagar el módulo no puede borrar contabilidad); **deshacer** (revertir un cobro con productos) → NUNCA gateado, porque opera sobre datos existentes y su bloqueo dejaría stock y finanzas inconsistentes. Ver §2.5. |

**Extras incluidos (vía libre, dan valor sin ensanchar el riesgo):** kardex por producto (historial de movimientos), pestaña **"Inventario y ventas"** en Finanzas (historial de ventas con filtros + compras e inversión + top productos + KPIs de margen/CMV), gasto y movimiento automáticos al crear producto con stock inicial, y lectura de productos habilitada para recepcionista/especialista (necesaria para vender en el cobro).

**Queda explícitamente FUERA:** comisión distinta por producto individual, proveedores/órdenes de compra, códigos de barras, cliente en la venta directa (la venta en cita ya hereda el cliente de la cita), y notificaciones de stock bajo por mensajería (el aviso visual ya existe y los mensajes cuestan dinero).

---

# PARTE I — DIAGNÓSTICO DEL ESTADO ACTUAL

## 1.1 Lo que YA EXISTE y FUNCIONA (no se reconstruye)

**Backend:**
- Tablas `producto`, `movimiento_inventario`, `venta_producto` (`apps/api/src/db/schema/inventory.ts`) y `atencion`, `atencion_producto`, `atencion_pago` (`db/schema/appointments.ts`). Todas multi-tenant con RLS.
- `InventarioService` (`operacion/inventario.service.ts`): CRUD de producto con **borrado lógico** (`activo=false`, línea 75), movimientos entrada/salida/ajuste, **gasto variable opcional en entradas** (`generaGasto` + `costoTotal`, líneas 114-127), alertas de stock bajo (`cantidad < stock_min`), valoración (`Σ cantidad×costo`), y venta directa `vender()` con descuento de stock.
- `AtencionService.completar` (`finanzas/atencion.service.ts:53`): **ya acepta `productos[]`**, valida stock, inserta `atencion_producto` y descuenta stock atómico; `revertir` (línea 169) repone stock y borra la atención. Endpoints `POST /citas/:id/completar` y `/revertir` (`agendamiento/agendamiento.controller.ts:66,72`, roles Admin/Especialista/Recepcionista).
- Motor puro `calcularAtencion` (`finanzas/calculo.ts:70`): reparto por servicio, deducción, tarifa, comisión bancaria sobre porción electrónica, pago dividido. Productos: **100 % al salón** ("comisión de producto = 0 en v1", línea 14).
- `ModuloGate` + gate por plan: `modulo.inventario` es módulo avanzado (Pro+) (`plans/plan-registry.ts:47`).
- Reportes (`operacion/reportes.service.ts`): `financiero` y `analisis` **ya suman `venta_producto`**; `analisis` reparte `ventasComision` a profesionales (líneas 183-184). Liquidaciones (`operacion/liquidaciones.service.ts:39`): bruto = `Σ atencion.ganProf` + `Σ venta_producto.comisionProf`.
- Ganancias del especialista (`negocio/equipo.service.ts:194`, `GET /especialistas/:id/ganancias`): `ganServicios` (Σ ganProf) + `comisiones` (Σ venta_producto.comisionProf).
- Config: registry en código (`config-module/registry.ts`), resolver con caché y cascada sistema→negocio→sucursal, endpoints `GET/PUT/DELETE /config/...`.

**Frontend:**
- `InventarioScreen` (`pages/admin/InventarioScreen.tsx`, dentro de GestionScreen, gated por módulo): KPIs, panel ámbar de stock bajo con chips, tabla con `StockDot`, `ProductModal` (crear/editar), `MovementModal` (movimientos con switch de gasto), eliminar con confirmación.
- Cobro con pago dividido: `CobroModal` (`pages/admin/agenda-ui.tsx:170`, usado por admin Y recepción) y `CobroSpec` (`pages/spec/spec-cobro.tsx:10`), ambos sobre `PagoSplit` (`ui/PagoSplit.tsx`) y `completarCita` (`lib/useCitas.ts:46`) — cuya firma **ya acepta `productos[]`** aunque nadie lo envía.
- `VentaModal` (venta directa, `pages/admin/finanzas-modals.tsx:56`) con comisión **hardcodeada al 10 %** (línea 10, marcada "prototipo").
- Reversión de cobro: solo en panel del especialista (`spec-agenda.tsx:152`), repone stock sin preguntar.
- Config UI: `ConfigFinancieros` (`ConfigScreen.tsx:292`) edita repartición y los `FIN_PCT`; sección Módulos con candados por plan.
- Panel del especialista: `GananciasSpec` (`spec-extra.tsx:26`) ya muestra "Comisiones" por separado.

## 1.2 Lo que FALTA (huecos que este plan cierra)

1. **Recarga con costo real:** `MovementModal` no tiene input de costo; el gasto se calcula con el costo viejo de la ficha (`InventarioScreen.tsx:278`) → el gasto registrado NO es lo que se pagó.
2. **Costo promedio ponderado:** no existe; el costo nunca se recalcula al comprar.
3. **Gasto al crear producto con stock inicial:** `crear()` no genera gasto NI movimiento — el stock inicial aparece de la nada (sin traza ni egreso).
4. **Venta de productos en el cobro de la cita:** ningún modal la ofrece (el backend ya la soporta).
5. **Comisión configurable por venta de producto:** no hay clave de config; el 10 % del `VentaModal` es un placeholder del prototipo y en la venta en cita la comisión es siempre 0.
6. **Historial de ventas de productos:** no hay endpoint GET de `venta_producto` ni de `atencion_producto`; solo agregados en reportes.
7. **Historial de compras / "Compras e inversión en inventario":** `movimiento_inventario` se escribe pero no hay endpoint que lo lea; no hay vista en Finanzas.
8. **Stock negativo / venta forzada:** siempre bloqueado, sin opción.
9. **Pregunta de reingreso al revertir:** repone siempre, sin preguntar; el admin ni siquiera tiene la acción.
10. **Movimientos fantasma:** `completar`/`revertir` cambian stock sin registrar `movimiento_inventario`.
11. **Roles de lectura:** `GET /inventario/productos` es solo Admin → recepcionista y especialista no podrían cargar el selector de productos del cobro.
12. **Etiquetado de ganancias:** si la comisión de producto entra a `ganProf` sin columna aparte, `ganancias()` la mostraría como "ganancia por servicios" (mal etiquetada) — lo resuelve D4.

## 1.3 Riesgos concretos que la ejecutora debe respetar

- **Doble conteo en reportes:** `reportes.analisis`/`financiero` suman `atencion.total` **y** `venta_producto.total`. La venta en cita ya está dentro de `atencion.total` → **jamás insertar en `venta_producto` lo vendido en una atención** (D6).
- **Idempotencia y transacciones:** `completar` es transaccional e idempotente por `citaId`; todo lo nuevo (movimientos, comisión) debe ir **dentro de la misma `runInTenantTx`**.
- **Snapshot inmutable:** los parámetros aplicados se congelan en `atencion.snapshot_param`; la comisión de producto aplicada debe congelarse igual (el % puede cambiar mañana y la liquidación de ayer no puede moverse).
- **Compatibilidad de datos viejos:** atenciones y ventas existentes no tienen los campos nuevos → toda lectura debe tolerar `NULL`/`0` (defaults en la migración).
- **HUECO LATENTE detectado (a cerrar en E6):** `AtencionService.resolverParametros` resuelve `inventarioActivo` con `config.resolverModulo(...)` — es decir, mira **solo la configuración y NO el plan**. Un negocio que baje de Pro a Básico con el toggle encendido seguiría vendiendo productos en el cobro. Todos los demás caminos (InventarioService) sí pasan por `ModuloGate` (plan ∧ config). Este plan lo corrige.

---

# PARTE II — DISEÑO OBJETIVO

## 2.1 Modelo de datos (migración 0018)

Columnas nuevas (todas con default para no romper filas existentes):

| Tabla | Columna | Tipo | Para qué |
|---|---|---|---|
| `atencion` | `comision_productos` | `numeric(12,2) NOT NULL DEFAULT 0` | Parte de `gan_prof` que viene de productos (D4). |
| `atencion_producto` | `costo_unitario` | `numeric(12,2) NOT NULL DEFAULT 0` | Snapshot del costo al vender (D9, margen/CMV). |
| `atencion_producto` | `comision` | `numeric(12,2) NOT NULL DEFAULT 0` | Comisión de ESTA línea (trazabilidad por producto). |
| `venta_producto` | `costo_unitario` | `numeric(12,2) NOT NULL DEFAULT 0` | Ídem D9 para ventas directas. |
| `movimiento_inventario` | `costo_total` | `numeric(12,2)` (nullable) | Lo pagado en la compra (entrada); NULL en el resto. |
| `movimiento_inventario` | `stock_resultante` | `integer` (nullable) | Stock tras el movimiento (kardex legible). |

Además: `ALTER TABLE "producto" DROP CONSTRAINT IF EXISTS ...` — **no aplica**; lo que sí: si `inventario.permitir_stock_negativo` se activa, el guard es de aplicación (no hay CHECK de stock ≥ 0 en la tabla — verificado), así que **no hace falta tocar constraints**.

Flujo de migración (convención del repo): editar `db/schema/*.ts` → `pnpm --filter @orkalis/api drizzle-kit generate` → revisar el SQL generado en `apps/api/drizzle/0018_*.sql` (aquí no hace falta SQL a mano: no hay tablas nuevas ni RLS nueva — las columnas heredan las policies existentes de su tabla). Aplicar en local con el runner de migraciones del repo y correr la suite.

## 2.2 Claves de configuración nuevas (`config-module/registry.ts`)

| Clave | Tipo | Defaults (Salón / Barbería) | Descripción |
|---|---|---|---|
| `finanzas.comision_producto_tipo` | `enum` (`porcentaje`, `valor_fijo`) | `porcentaje` / `porcentaje` | Cómo se calcula la comisión del especialista por venta de producto. |
| `finanzas.comision_producto_valor` | `numero` | `0` / `0` | % (0–100) si tipo=porcentaje; COP por unidad si tipo=valor_fijo. `0` = todo al negocio (Opción A). |
| `inventario.permitir_stock_negativo` | `boolean` | `false` / `false` | Permite vender sin stock registrado (D7). |

Nivel mínimo de edición: `Negocio` (como las demás claves de finanzas). Validación cruzada en `config-module/validation.ts`: si `comision_producto_tipo` efectivo es `porcentaje`, `comision_producto_valor` ≤ 100. Nota: el registry vive en código — **estas claves NO necesitan migración**.

## 2.3 Motor de cálculo (`finanzas/calculo.ts`)

`ParametrosFinancieros` gana `comisionProductoTipo: 'porcentaje' | 'valor_fijo'` y `comisionProductoValor: number`. `ProductoReal` no cambia de forma (cantidad, valor unitario). Dentro de `calcularAtencion`:

```
comisionLinea(producto) =
  tipo=porcentaje → round2(cantidad × valor × pct/100)
  tipo=valor_fijo → round2(min(cantidad × montoFijo, cantidad × valor))   // tope: nunca más que la línea
comisionProductos = Σ comisionLinea      (0 si !inventarioActivo o !particionPorEspecialista)
ganProf  += comisionProductos            // D4: incluida en ganProf
ganSalon += totalProductos − comisionProductos   // en vez de totalProductos entero
```

La deducción administrativa y la tarifa siguen calculándose ANTES, solo sobre servicios (no se tocan esas líneas). `ResultadoCalculo` gana `comisionProductos` y `comisionesPorLinea: number[]` (misma posición que el array de productos de entrada, para persistir `atencion_producto.comision`); el `snapshot` gana `comisionProductos` (los parámetros ya viajan completos en `snapshot.parametros`). Con `!particionPorEspecialista` el bloque final que anula `ganProf` ya deja todo al salón — verificar que `comisionProductos` también se reporte 0 en ese caso.

## 2.4 Endpoints (nuevos y modificados)

| Cambio | Ruta | Roles | Notas |
|---|---|---|---|
| MODIFICAR | `GET /inventario/productos` | Admin, **Recepcionista, Especialista** | Solo lectura; necesaria para el selector del cobro (patrón idéntico a `GET /servicios`, `operacion.controllers.ts:65`). El gate del módulo ya responde 403 si está inactivo — el frontend usa ese 403 para ocultar la sección de productos. |
| NUEVO | `GET /inventario/movimientos?sucursalId&productoId&tipo&desde&hasta` | Admin | Kardex/compras. Devuelve `{ items: MovimientoInventarioItem[] }` con nombre de producto, `costoTotal`, `stockResultante`, `gastoId`, fecha. Orden desc, límite 500. |
| NUEVO | `GET /inventario/ventas?sucursalId&desde&hasta&especialistaId&productoId&clienteId&origen` | Admin | Historial unificado (D6): unión de `venta_producto` (origen `directa`) y `atencion_producto`⋈`atencion`⋈`cita` (origen `cita`, con `citaId` y cliente). Respuesta `{ items: VentaProductoHistorial[], totales: { total, comision, costo, margen } }`. `clienteId` solo filtra origen cita. |
| MODIFICAR | `POST /inventario/ventas` (`VentaDto`) | Admin | **Eliminar `comisionProf` del DTO**; el servidor la calcula con la config (D2). La respuesta pasa a incluir `{ ventaId, total, comision }`. |
| MODIFICAR | `POST /inventario/movimientos` (`MovimientoDto`) | Admin | `costoTotal` pasa a ser **el costo real tecleado** (obligatorio si `generaGasto`); dispara promedio ponderado (D1). |
| MODIFICAR | `POST /citas/:id/revertir` | (los 3 roles, sin cambio) | Body opcional `{ reponerStock?: boolean }` (`RevertirDto` nuevo en `agendamiento/dto`). |

DTOs compartidos nuevos en `packages/shared/src/dtos.ts`: `MovimientoInventarioItem`, `VentaProductoHistorial`, `HistorialVentasResp`; `LiquidacionResultado` gana `comisionServicios` y `comisionProductos` (desglose; `bruto` sigue siendo la suma). **Recordar el build dual:** `pnpm --filter @orkalis/shared build` antes de typecheck de api/web.

## 2.5 Matriz de gating (D11) — superficie por superficie

La regla `plan ∧ config` ya existe (`ModuloGate.assertActivo/estaActivo`, `operacion/modulo-gate.service.ts`; `modulo.inventario` en `MODULOS_AVANZADOS` de `plans/plan-registry.ts:47` → disponible desde Pro; toggle del admin en Configuración → Módulos, `ConfigScreen.tsx` sección "modulos" con candado por plan). Esta matriz fija qué pasa con CADA superficie cuando el módulo NO está disponible (por plan o por toggle):

| Superficie | Sin módulo (plan sin él, o toggle OFF) |
|---|---|
| `GET /inventario/productos` (y todo `InventarioController`, incl. los GET nuevos de movimientos y ventas) | **403** vía `ModuloGate.assertActivo` — ya es el patrón de `InventarioService` (`this.assert()`); los métodos nuevos `listarMovimientos`/`listarVentas` DEBEN llamarlo igual. |
| `POST /citas/:id/completar` **con** `productos[]` | **400 explícito** "El módulo de inventario no está activo" (hoy los ignora en silencio — un producto vendido y no registrado es peor que un error claro). Sin `productos[]`, completar funciona normal: el cobro de servicios NO depende del módulo. |
| `POST /citas/:id/revertir` de una atención con productos | **Funciona SIEMPRE** (repone stock si se pide): deshace datos existentes; bloquearlo dejaría inconsistencia (D11). |
| Sección de productos en el cobro (admin/recepción/especialista) | **No se renderiza.** El componente `ProductosVenta` trata el 403 del listado como "sin módulo" (estado normal, sin mensaje de error). Es la única señal disponible en paneles que no pueden leer `GET /config` (Admin-only). |
| Tab "Inventario" en Gestión, tab "Inventario y ventas" en Finanzas, botón "Registrar venta" | **Ocultos** con el patrón existente (`moduloActivo` de `useConfig` en el panel admin) + tolerancia a 403 por si el plan no lo incluye aunque el toggle esté encendido. |
| Config: tarjeta "Comisión por venta de productos" + toggle de stock negativo | **Ocultos/candado**: mismos patrones de la sección Módulos (candado si el plan no lo incluye; ocultos si el toggle está OFF). Las claves pueden EXISTIR en BD sin efecto: solo se leen dentro de flujos ya gateados. |
| Reportes, liquidaciones, ganancias del especialista con datos históricos de productos | **Siempre visibles** (D11): las columnas/KPIs de productos muestran lo registrado cuando el módulo estaba activo. Con módulo apagado y sin historial, simplemente muestran 0. No condicionar la LECTURA de `comision_productos`/`venta_producto` al gate. |
| Claves nuevas de config en negocios sin el módulo | Inertes: `comision_producto_*` y `permitir_stock_negativo` solo se consultan dentro de caminos gateados. Cambiar el plan o el toggle no requiere limpiar configuración. |

**Cambio de estado en caliente (escenarios que NO deben romper nada):**
1. *Toggle OFF con citas a medio cobrar:* el modal de cobro abierto puede enviar `productos[]` → recibe el 400 claro y el usuario cierra la sección; al reabrir, la sección ya no aparece (403 del listado).
2. *Baja de plan (Pro→Básico) con toggle encendido:* TODO queda bloqueado igual (la parte plan del `∧`), incluido el cobro — esto es justo el hueco latente de §1.3 que E6 corrige.
3. *Reactivación posterior:* stock, costos, historiales y configuración siguen donde estaban; no hay migración ni reseteo al reactivar.

---

# PARTE III — FASE ÚNICA DE EJECUCIÓN (etapas E1–E11)

> Orden obligatorio: cada etapa asume las anteriores. Tras CADA etapa: `pnpm --filter @orkalis/api test` (la suite corre contra el Postgres local del repo) y typecheck del paquete tocado. **Antes de correr nada:** vaciar las claves reales de Twilio del entorno para no gastar SMS (arrancar la API/tests con `TWILIO_ACCOUNT_SID= TWILIO_AUTH_TOKEN= TWILIO_VERIFY_SID=` vacíos → fuerza el `MockAdapter`).

## E0 · Preparación (sin cambios de código)

1. Leer completos: `finanzas/calculo.ts`, `finanzas/atencion.service.ts`, `operacion/inventario.service.ts`, `operacion/liquidaciones.service.ts`, `operacion/reportes.service.ts`, `negocio/equipo.service.ts` (método `ganancias`), `config-module/registry.ts` + `validation.ts`, `pages/admin/InventarioScreen.tsx`, `pages/admin/agenda-ui.tsx` (CobroModal + TRANSICIONES), `pages/spec/spec-cobro.tsx`, `pages/spec/spec-agenda.tsx`, `pages/admin/finanzas-modals.tsx`, `ui/PagoSplit.tsx`, `lib/useCitas.ts`, `lib/useInventario.ts`.
2. Correr la suite completa y anotar el estado base (hoy: 300 tests / 30 suites en verde; hay ~10 fallos e2e de Playwright PREEXISTENTES en `main` — no intentar arreglarlos ni contarlos como regresión).

## E1 · Esquema y migración

**Archivos:** `db/schema/appointments.ts`, `db/schema/inventory.ts`, nueva `drizzle/0018_*.sql`.

1. Añadir las 6 columnas de §2.1 a los modelos Drizzle (nombres snake_case exactos de la tabla de §2.1).
2. `drizzle-kit generate`; revisar que el SQL solo contenga `ALTER TABLE ... ADD COLUMN` con los defaults correctos. Sin RLS nueva (columnas sobre tablas ya protegidas).
3. Aplicar en local; `SELECT` de humo sobre las 4 tablas.

**Verificación:** suite verde sin cambios de comportamiento (las columnas son aditivas con default).

## E2 · Tipos compartidos

**Archivos:** `packages/shared/src/dtos.ts` (y `enums.ts` si se decide tipar `origen`).

1. `MovimientoInventarioItem { id, productoId, productoNombre, tipoMov, cantidad, motivo, costoTotal: string|null, stockResultante: number|null, gastoId: string|null, creadoEn }`.
2. `VentaProductoHistorial { id, fecha, origen: 'cita'|'directa', citaId?, atencionId?, clienteNombre?, especialistaId?, especialistaNombre?, productoId, productoNombre, cantidad, precioUnitario, total, comision, costoUnitario, margen }` y `HistorialVentasResp { items, totales: { total, comision, costo, margen } }`.
3. `LiquidacionResultado` += `comisionServicios: number; comisionProductos: number`.
4. `pnpm --filter @orkalis/shared build` (dual CJS+ESM) y typecheck de api y web.

## E3 · Configuración

**Archivos:** `config-module/registry.ts`, `config-module/validation.ts`, `pages/admin/ConfigScreen.tsx`.

1. Registrar las 3 claves de §2.2 (usar el helper `def({...})` con `enumValores` para el tipo).
2. Validación cruzada: `comision_producto_valor` ≤ 100 cuando el tipo efectivo es `porcentaje` (mirar cómo `validation.ts` valida repartición=100 y calcar el patrón).
3. UI: en `ConfigFinancieros` (`ConfigScreen.tsx:292`), nueva tarjeta "Comisión por venta de productos": selector Porcentaje/Monto fijo por unidad + campo numérico, guardados con `setConfig`; texto de ayuda "0 = todo el ingreso del producto queda para el negocio". El toggle de stock negativo va como `SettingRow` en la misma sección Financieros (es una regla de venta), no en Módulos.
4. Gating visual (§2.5): la tarjeta de comisión y el toggle de stock negativo solo se muestran si `modulo.inventario` está activo (hook `moduloActivo`), y con candado si el plan no incluye el módulo (calcar el patrón de candados de la sección Módulos, `ConfigScreen.tsx` líneas ~220-233).

**Verificación:** test de config existente + uno nuevo: guardar tipo/valor por `PUT /config/...` y leer efectivos; rechazo de porcentaje > 100.

## E4 · Motor de cálculo

**Archivos:** `finanzas/calculo.ts`, `finanzas/calculo.spec.ts`.

1. Implementar §2.3 tal cual (respetar `round2` en cada paso, como hace el resto del archivo).
2. Tests nuevos (mínimo): comisión 10 % sobre 2 líneas; valor_fijo con tope (monto fijo > precio unitario → comisión = valor de la línea); `comisionProductoValor=0` reproduce EXACTAMENTE los resultados actuales (regresión); `!particionPorEspecialista` → comisión 0 y todo al salón; `!inventarioActivo` → productos ignorados (ya existe, ampliar); suma invariante `ganProf + ganSalon + comisionBancaria = total` en todos los casos nuevos.

## E5 · InventarioService (costo, compras, stock negativo, historiales)

**Archivos:** `operacion/inventario.service.ts`, `operacion/operacion.controllers.ts`, `operacion/dto/operacion.dto.ts`, `operacion/operacion.spec.ts` (o spec nuevo `inventario.spec.ts` siguiendo el patrón de specs con BD real del repo).

1. **`movimiento()` — promedio ponderado (D1):** en entradas con `costoTotal > 0`, recalcular `producto.costo` con la fórmula de D1 (stock previo clamp a ≥ 0) en el MISMO update de stock; guardar `costo_total` y `stock_resultante` en la fila de movimiento (siempre, para todo tipo de movimiento). El gasto variable sigue igual pero con el `costoTotal` real. Salida manual: respetar D7 (leer `inventario.permitir_stock_negativo` vía `ConfigResolverService` — inyectarlo; el servicio ya recibe `ModuloGate` que lo usa internamente, pero aquí se necesita el resolver directo).
2. **`crear()` — stock inicial con traza:** si `cantidad > 0`: insertar movimiento `entrada` motivo `'Stock inicial'` con `costo_total = cantidad × costo` y `stock_resultante = cantidad`; si además `costo > 0` y el flag nuevo `generaGasto` del DTO (default `true`) está activo, crear el gasto variable `'Compra de inventario'` enlazado (mismo patrón que ya usa `movimiento()`).
3. **`vender()` — comisión de config (D2/D3):** resolver tipo/valor con `ConfigResolverService` (negocio + sucursal del producto), calcular con la MISMA fórmula del motor (extraer a helper exportado en `calculo.ts` — p. ej. `comisionProducto(cantidad, valorUnit, tipo, valor)` — y usarlo en ambos sitios para que jamás diverjan), snapshot `costo_unitario` desde `producto.costo`, respetar D7, y registrar `stock_resultante` en el movimiento de salida. Quitar `comisionProf` de `VentaDto`.
4. **`listarMovimientos()` y `listarVentas()`:** los dos GET de §2.4. El historial de ventas hace las dos consultas dentro de una `runInTenantTx`, mapea a `VentaProductoHistorial` (`margen = total − costoUnitario×cantidad − comision`… **decisión:** margen = `total − costo` SIN restar comisión en el item; los `totales` sí traen `comision` aparte para que la vista muestre "margen bruto" y "comisión" como columnas separadas), mezcla y ordena por fecha desc. Ventas en cita: `atencion_producto` ⋈ `atencion` (fecha = `atencion.creado_en`, especialista) ⋈ `cita` (clienteId → nombre con join a `cliente`).
5. Controller: rutas y roles de §2.4 (el GET de productos con override de roles, calcado de `ServiciosController.listar`).
6. **Gating (§2.5):** `listarMovimientos()` y `listarVentas()` llaman `this.assert(ctx)` igual que todos los métodos existentes del servicio — ningún método nuevo de `InventarioService` queda fuera del gate.

**Verificación (tests):** promedio ponderado con 2 compras a costos distintos (10 uds a 1 000 + 10 uds a 2 000 → costo 1 500); entrada sin costo no recalcula; crear con stock inicial genera gasto + movimiento; venta directa toma comisión de config (y 0 por defecto); venta con stock insuficiente falla con flag OFF y pasa (stock negativo) con flag ON; historial une ambas fuentes sin duplicar (1 venta directa + 1 venta en cita → 2 items, totales correctos); **con el módulo desactivado (config OFF o plan Básico), TODOS los endpoints de `InventarioController` responden 403** (el spec existente `operacion.spec.ts` ya tiene el patrón de probar el gate — reutilizarlo).

## E6 · AtencionService (venta en cita, trazabilidad, reversión)

**Archivos:** `finanzas/atencion.service.ts`, `agendamiento/dto/agendamiento.dto.ts`, `agendamiento/agendamiento.controller.ts`, `finanzas/atencion.spec.ts`.

1. `resolverParametros()`: leer también las 3 claves nuevas (añadir al `Promise.all`), y **cerrar el hueco latente de §1.3**: `inventarioActivo` deja de ser `config.resolverModulo(...)` a secas y pasa a ser **plan ∧ config**. Cómo: inyectar `ModuloGate` en `AtencionService` y usar `estaActivo(ctx, 'modulo.inventario')` — `ModuloGate` vive en `OperacionModule`; hay que exportarlo desde ese módulo e importarlo en `FinanzasModule` (verificar que no se cree ciclo de módulos Nest; si lo hubiera, alternativa equivalente sin ciclo: `PlanService.moduloPermitido(plan, clave)` + `config.resolverModulo`, que son las dos mitades de la misma regla y ya son inyectables).
2. `completar()`: pasar los parámetros nuevos al motor; persistir `atencion.comision_productos = r.comisionProductos`; en cada línea de `atencion_producto` guardar `costo_unitario` (leído del producto en la MISMA consulta que ya trae `cantidad, precioVenta` — añadir `costo`) y `comision` (de `r.comisionesPorLinea[i]`); **insertar movimiento `salida`** por línea con motivo `'Venta en cita'` y `stock_resultante` (D5); validación de stock: respetar D7 (con flag ON, permitir negativo). **Gating (§2.5):** si llegan `productos[]` con el módulo NO disponible → `BadRequestException('El módulo de inventario no está activo.')` (hoy se ignoran en silencio); sin `productos[]`, completar no toca nada de inventario y funciona igual con o sin módulo.
3. `revertir(ctx, citaId, reponerStock = true)`: si `reponerStock`, reponer e **insertar movimiento `entrada`** motivo `'Reversión de cobro'` por línea; si no, no tocar stock (la salida original queda como registro fiel). El resto (borrar `atencion_producto`, `atencion`, `atencion_pago` en cascada, reabrir cita) no cambia. **Revertir NO se gatea por módulo** (D11): debe funcionar aunque el módulo se haya apagado después del cobro.
4. DTO `RevertirDto { reponerStock?: boolean }` y pasarlo desde el controller.

**Verificación (tests):** completar con 2 productos → stock baja, 2 movimientos `salida` con `stock_resultante` correcto, `atencion.comision_productos` y `gan_prof` cuadran con el motor, líneas con costo y comisión snapshot; revertir repone y deja movimientos `entrada`; revertir con `reponerStock=false` NO repone; completar sin productos → comisión 0 y comportamiento idéntico al actual (regresión); idempotencia intacta (segundo completar → 409); **gating: completar con `productos[]` y módulo OFF (por config Y por plan Básico con config ON — los dos casos) → 400; completar sin productos con módulo OFF → funciona; revertir una atención con productos tras apagar el módulo → repone stock igual.**

## E7 · Liquidaciones, reportes y ganancias (desglose)

**Archivos:** `operacion/liquidaciones.service.ts`, `operacion/reportes.service.ts`, `negocio/equipo.service.ts`, specs correspondientes.

1. **Liquidaciones:** `computar()` lee además `atencion.comision_productos`; por especialista: `comisionServicios = Σ(ganProf − comisionProductos)`, `comisionProductos = Σ atencion.comision_productos + Σ venta_producto.comisionProf`; `bruto` NO cambia de fórmula (sigue `Σ ganProf + Σ venta.comisionProf` — invariante `bruto = comisionServicios + comisionProductos`). El descuento bancario queda como está. CSV: dos columnas nuevas.
2. **Ganancias del especialista (`equipo.service.ts:194`):** `ganServicios = Σ(ganProf − comision_productos)`; `comisiones = Σ venta.comisionProf + Σ atencion.comision_productos`. El DTO no cambia (los campos ya existen) → `GananciasSpec` del panel del especialista queda correcto sin tocarlo.
3. **Reportes `analisis`:** el agregado de `atencion` lee también `comision_productos`; `ventasProducto` del response pasa a incluir AMBAS fuentes (`Σ venta_producto.total + Σ atencion.total_productos`… **ojo:** `atencion` no guarda `total_productos` — leerlo de `Σ atencion_producto.valor×cantidad` en una consulta propia). `ingresosSalon`/`ganProfesionales` ya cuadran solos porque la comisión viaja dentro de `ganProf`. KPI "Ventas de producto" de `ReportesFinScreen` mostrará por fin las ventas en cita.
4. **`financiero` y `panel`:** revisar y documentar en comentario que NO deben sumar `atencion_producto` a los ingresos (ya está dentro de `atencion.total`) — solo el KPI informativo `valorProductos` del panel puede ampliarse con ventas en cita si se quiere coherencia visual.

5. **Sin gate de lectura (D11/§2.5):** liquidaciones, `analisis`, `financiero`, `panel` y `ganancias()` leen los datos de productos SIEMPRE (son contabilidad histórica); no añadirles `ModuloGate`. El único gate de liquidaciones sigue siendo el existente (`modulo.particion_por_especialista`).

**Verificación (tests):** liquidación con 1 atención (servicio + producto con comisión) + 1 venta directa → bruto = suma de partes, desglose exacto; `ganancias()` separa bien; `analisis` NO duplica ingresos (total del reporte = atencion.total + ventas directas); **con el módulo apagado DESPUÉS de registrar ventas, los reportes y la liquidación siguen mostrando esas ventas/comisiones históricas**.

## E8 · Frontend — Inventario (recarga con costo, kardex)

**Archivos:** `pages/admin/InventarioScreen.tsx`, `lib/useInventario.ts`.

1. **`MovementModal`:** para entradas, campo "Costo total de la compra" (COP, obligatorio si el switch de gasto está ON; default = `cantidad × costo actual` como sugerencia editable); nota bajo el campo: "El costo del producto se actualizará al promedio ponderado". Enviar `costoTotal` real.
2. **`ProductModal` (crear):** switch "Registrar la compra inicial como gasto" (default ON, visible solo si cantidad > 0 y costo > 0) → `generaGasto` del DTO.
3. **Kardex:** opción "Ver movimientos" en el menú de fila → `Sheet`/`Dialog` con la lista de `GET /inventario/movimientos?productoId=` (fecha, tipo, cantidad ±, costo si compra, stock resultante, motivo). Hook nuevo `useMovimientos(productoId)` en `useInventario.ts`.
4. Stock negativo: si la config lo permite y `cantidad < 0`, la celda de cantidad y el `StockDot` en rojo con tooltip "Stock negativo: regulariza con una recarga".

**Verificación:** typecheck web + revisión manual con `pnpm dev` (crear producto con stock inicial → gasto aparece en Finanzas; recarga a costo distinto → costo promedio cambia; kardex muestra todo).

## E9 · Frontend — Venta en el cobro y reversión

**Archivos:** `pages/admin/agenda-ui.tsx` (CobroModal, TRANSICIONES), `pages/spec/spec-cobro.tsx`, `pages/spec/spec-agenda.tsx`, `lib/useCitas.ts`, componente nuevo compartido (p. ej. `ui/ProductosVenta.tsx`).

1. **`ProductosVenta` (compartido):** sección plegada "+ Agregar productos vendidos" dentro del cobro. Carga `GET /inventario/productos?sucursalId=` (si responde 403 → módulo inactivo o plan sin módulo → **no renderizar nada**, ni error). Buscador + lista de productos tipo `venta` activos con precio y stock; stepper de cantidad con tope en el stock (o sin tope + aviso rojo "quedará en −N" si la config de stock negativo está activa — el flag llega en la respuesta del listado o se infiere del error del backend; decisión ejecutora: incluir `permitirStockNegativo` en la respuesta del GET de productos para no adivinar). Subtotal por línea y total de productos.
2. **`CobroModal` y `CobroSpec`:** total mostrado y pasado a `PagoSplit` = servicios + productos (los dos modales calculan hoy el total de servicios — sumarles el subtotal); enviar `productos: [{productoId, cantidad}]` en `completarCita`. El desglose "Servicios $X · Productos $Y" visible sobre el split.
3. **Reversión con pregunta (D8):** en el sheet del especialista (`spec-agenda.tsx:152`), casilla "Reingresar los productos al inventario" (marcada; visible solo si la atención tuvo productos — si no se sabe sin otra consulta, mostrarla siempre con texto condicional "si los hubo"). Añadir la acción "Revertir cobro" al menú del admin para citas completadas (`TRANSICIONES` en `agenda-ui.tsx:32` + `GConfirm` con la misma casilla). `revertirCita(id, reponerStock)` en `useCitas.ts`.

**Verificación:** e2e manual en los TRES paneles (admin, recepción, especialista): completar una cita con 1 producto → stock baja, total correcto, pago dividido cuadra; revertir desde admin sin reponer → stock no cambia. Gotcha e2e del repo: los botones dentro de modales admin pueden no exponer nombre accesible vía `getByRole` (ver memoria `e2e-gfield-accessible-name`).

## E10 · Frontend — Finanzas (pestaña "Inventario y ventas", VentaModal)

**Archivos:** `pages/admin/FinanzasScreen.tsx`, pantalla nueva `pages/admin/VentasInventarioScreen.tsx` (lazy, como las otras), `pages/admin/finanzas-modals.tsx`, `lib/useGastos.ts` (o hook nuevo `useVentas.ts`).

1. **Pestaña nueva** "Inventario y ventas" en `FinanzasScreen` (solo con `modulo.inventario` activo, patrón del tab existente de Inventario en Gestión; si además el plan no lo incluye, los GET responden 403 → mostrar el estado vacío estándar, no un error), con:
   - KPIs del rango: Ingresos por productos, Costo de lo vendido (CMV), Margen bruto, Unidades vendidas (de `totales` del historial).
   - **Historial de ventas** (tabla): filtros de rango (`RangeCalendar` reutilizable ya existente), especialista, producto, origen (Todas/En cita/Directas); columnas fecha, producto, cant., origen (chip con enlace mental a la cita: mostrar cliente si existe), especialista, total, comisión, margen. Fuente: `GET /inventario/ventas`.
   - **Compras e inversión en inventario**: tabla de movimientos `entrada` con costo (fecha, producto, cantidad, costo total, motivo) + KPI "Invertido en el rango" (`Σ costo_total`). Fuente: `GET /inventario/movimientos?tipo=entrada`.
   - **Top productos** del rango (por unidades y por ingreso) — derivable en el cliente desde el historial; sin endpoint extra.
2. **`VentaModal`:** eliminar `COMISION_PRODUCTO = 0.1` y todo su uso; mostrar "Comisión (según configuración): $X" calculada con los valores efectivos de `useConfig` (el admin los tiene) SOLO como vista previa — la verdad la pone el servidor; adaptar `registrarVenta` al DTO sin `comisionProf`.

**Verificación:** typecheck + manual: una venta directa y una venta en cita aparecen juntas en el historial con origen distinto y los totales cuadran con Análisis.

## E11 · Cierre — regresión, commit y despliegue

1. Suite completa de api en verde (los ~10 e2e Playwright preexistentes rotos en `main` no cuentan). `pnpm -r typecheck` (o el script equivalente del repo) y build de `shared`, `api` y `web`.
2. Regresión funcional mínima local (`pnpm dev` + API con Twilio vaciado): flujo completo — crear producto con stock inicial → recargar a otro costo → vender en cita → ver historial/liquidación/ganancias del especialista → revertir sin reponer.
3. Commits pequeños por etapa o un commit por bloque (backend/frontend), mensajes en español siguiendo el estilo del repo (`feat(inventario): ...`). Push a `main` **solo tras la aprobación final de EL USUARIO**; Railway despliega solo y el entrypoint aplica la migración 0018.
4. Smoke en producción: crear un producto de prueba en un negocio de prueba, venta en cita, revisar historial; borrar (desactivar) el producto de prueba.

---

# PARTE IV — GOTCHAS DEL REPO PARA LA EJECUTORA

1. **`@orkalis/shared` es dual CJS+ESM**: tras tocar `dtos.ts`, correr su build (hace dos `tsc`) o api/web verán tipos viejos.
2. **Migraciones**: se generan con `drizzle-kit generate` y solo se extienden a mano cuando hay RLS/CHECK/seed (aquí NO hace falta). En producción las aplica el entrypoint del contenedor.
3. **Rutas Nest por orden de declaración**: si se añade una ruta `GET /inventario/:algo`, debe ir DESPUÉS de `/inventario/movimientos` y `/inventario/ventas` (con las rutas propuestas no hay colisión, pero no reordenar a la ligera).
4. **RLS**: todo acceso de negocio va por `runInTenantTx(ctx, ...)`; jamás usar `adminDb` para datos de tenant. `adminDb.execute()` devuelve un **array** (no `{rows}`) y los timestamps de SQL crudo llegan como **string**.
5. **Twilio real en `.env` local**: vaciar `TWILIO_*` al levantar la API o correr tests para no enviar SMS reales (memoria `twilio-real-en-env-local`).
6. **`Input` del design system** usa `onChange` de evento React estándar (`e.target.value`), no `(valor) => ...`.
7. **Iconos**: solo existen las claves de `ui/icons.ts` (p. ej. `trash-2`, `image`; NO existe `camera`). Verificar antes de usar.
8. **Popover/menús en tarjetas**: usar el `Popover` de `ui/ui.tsx` (ya portaleado con `position: fixed`) para cualquier menú/desplegable nuevo — no posicionar con `absolute` dentro de tarjetas con `overflow: hidden`.
9. **Módulo inactivo = 403** (`ModuloGate.assertActivo` lanza `ForbiddenException`): en paneles sin acceso a `GET /config` (recepción/especialista) el 403 del listado de productos ES la señal de "sin módulo" — tratarlo como estado normal, no como error.
10. **No duplicar ingresos**: la regla D6 es la más fácil de romper. Ante cualquier duda en reportes, verificar con un caso a mano: 1 atención de $50 000 con producto de $20 000 + 1 venta directa de $10 000 → ingresos totales $80 000, ni un peso más.

# PARTE V — CRITERIOS DE ACEPTACIÓN (checklist final)

- [ ] Crear producto con stock inicial genera gasto variable (opt-out) y movimiento "Stock inicial".
- [ ] Recargar stock pide el costo real, actualiza el costo promedio ponderado y genera gasto + movimiento con `costo_total` y `stock_resultante`.
- [ ] La eliminación sigue siendo lógica (ya existía) y no rompe historiales.
- [ ] En el cobro de la cita (admin, recepción y especialista) se pueden añadir productos: stock en vivo, total = servicios + productos, pago divisible en varios métodos.
- [ ] La comisión por venta de producto sale de configuración (%, o monto fijo por unidad con tope), la calcula el servidor, y con valor 0 todo va al negocio (default). El 10 % hardcodeado desapareció.
- [ ] Liquidaciones, reporte de análisis y "Tus ganancias" del especialista separan comisión por servicios vs por productos, sin doble conteo de ingresos.
- [ ] Historial de ventas unificado (cita + directa) con filtros por rango, especialista, producto, cliente y origen; subsección "Compras e inversión" con lo invertido en el rango; kardex por producto.
- [ ] Stock insuficiente bloquea por defecto; con `inventario.permitir_stock_negativo` ON permite vender y muestra el negativo en rojo.
- [ ] Revertir un cobro pregunta si reingresar los productos (default sí) y el admin también tiene la acción.
- [ ] Todo movimiento de stock (incluidos venta en cita y reversión) queda en `movimiento_inventario`.
- [ ] Atenciones y ventas antiguas (sin columnas nuevas) se leen sin errores y con desglose 0.
- [ ] **Gating (D11/§2.5):** con el módulo no disponible (toggle OFF **o** plan sin él aunque el toggle esté ON) no aparece NADA de productos en ningún panel, los endpoints de inventario responden 403, y completar con `productos[]` responde 400 claro — pero el cobro de servicios, sin productos, funciona exactamente igual que hoy.
- [ ] **Gating histórico:** apagar el módulo después de haber vendido no oculta ni borra nada: reportes, liquidaciones, ganancias del especialista e historiales siguen mostrando lo registrado; revertir un cobro con productos sigue funcionando; reactivar deja todo donde estaba.
- [ ] Activar/desactivar el módulo desde Configuración → Módulos surte efecto sin reiniciar nada (la caché del resolver ya se invalida por evento `config.updated`).
- [ ] Suite de api en verde + typecheck/build de los 3 paquetes; sin regresión en los tests existentes de cálculo, atención, operación y liquidaciones.
