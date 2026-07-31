# PLAN-FINANZAS · Transparencia financiera, arqueo por transacción y cierres — Orkalis

> **Para quién es este documento.** Para el dueño del producto (EL USUARIO) y para la IA ejecutora. Convierte el área de finanzas en un módulo **transparente, auditable y detallado**: desglose por transacción en ambos paneles, la Liquidación viviendo en Finanzas, y un flujo de **cierre quincenal/mensual** de verdad.
>
> **Regla de oro:** este es el PLAN. **No se escribe código hasta que EL USUARIO apruebe.** Implementación fase por fase (F1…F7); no se avanza si la verificación de la fase no pasa. **La lógica de cálculo actual (`calculo.ts`) no se toca** salvo lo listado explícitamente en §D3/§D6.
>
> **Estado del análisis:** completo, sobre el código real tras `4aced08`.

---

## 0. Decisiones de producto (a confirmar por EL USUARIO)

| # | Decisión | Propuesta |
|---|----------|-----------|
| D1 | **Fuente del desglose** | Los números ya existen y están congelados por transacción (`atencion` + `snapshot_param` + `atencion_producto.comision` + `atencion_pago`). El rediseño **expone** lo que ya se persiste; lo único nuevo que se persiste es el **desglose por línea de servicio** (tabla `atencion_servicio`), porque hoy la regla aplicada a cada servicio no queda guardada. Atenciones antiguas: el detalle por servicio se reconstruye de forma aproximada y se marca como tal. |
| D2 | **Quién ve qué** | El **ticket total y sus componentes** los ven Admin y Recepcionista. La **ganancia del especialista por transacción** la ven el Admin y el PROPIO especialista (nunca un compañero, nunca recepción). El endpoint de ganancias pasa a validar que un especialista solo consulte las suyas (hoy no lo valida — se corrige). |
| D3 | **Doble descuento bancario (BUG actual)** | Hoy la comisión bancaria se descuenta DOS veces: al salón en el cobro (`calculo.ts`, prorrateada por pagos reales) y OTRA vez al especialista en la liquidación (recalculada sobre el método "dominante"). Propuesta: **la absorbe el salón** (como en el cobro) y la liquidación **elimina su descuento recalculado** → `neto = bruto`. La columna "Descuento" de liquidación queda en 0 y desaparece de la UI. Si EL USUARIO prefiere que el especialista comparta la comisión bancaria, se hace configurable — pero nunca doble. |
| D4 | **El período manda en Finanzas** | Un **selector de período único y global** en la cabecera de Finanzas (quincena 1–15 / quincena 16–fin / mes / rango libre, navegable a períodos pasados) que **aplica a todas las pestañas**. Es el reflejo del pago quincenal/mensual de los salones. |
| D5 | **Liquidación se muda a Finanzas** | Deja Gestión → Equipo y pasa a ser pestaña de Finanzas (mismo gate `modulo.particion_por_especialista`). Gana: períodos por quincena, filas expandibles con `comisionServicios`/`comisionProductos` (datos que ya llegan y se descartan) y lista de transacciones por especialista. Se corrige que **`POST /liquidaciones/csv` persiste sin avisar** (pasa a exportar el preview, sin efecto). |
| D6 | **Cierre de período de verdad** | `POST /cierres` pasa a: calcular el rango **en el backend** (quincena/mes de un ancla, zona Bogotá), rechazar **solapes** con cierres existentes, archivar el **ReporteAnalisis completo + la liquidación del período** (hoy archiva 7 números y la UI enseña otros), y usar el `tipo` correcto (hoy la UI siempre manda `mensual` — bug). Sin lock contable en v1: revertir un cobro de un período cerrado se permite pero **avisa** ("este período ya tiene cierre; el archivo no cambia"). Gate por plan como hoy. |
| D7 | **Walk-in retroactivo (BUG actual)** | Hoy crea la cita `Completada` **sin `atencion`**: trabajo que jamás entra a reportes ni liquidaciones, y que infla la lista de "completadas" del especialista con $0. Se corrige: el retroactivo crea su atención con el método de pago que ya captura la UI. |
| D8 | **Coherencia de agregados** | `/reportes/financiero` y `/reportes/analisis` tienen dos definiciones distintas de "ganancia neta". El cierre y las pantallas usarán **una sola** (la de análisis: `ingresosSalon − egresos`); `/reportes/financiero` queda como alias documentado. |
| D9 | **Candado de comisión bancaria (aclaración de EL USUARIO)** | El % vive donde siempre (`finanzas.comision_bancaria`, Configuración → Financieros) y todo el cálculo lo refleja. Lo nuevo: mientras el negocio **no haya asignado** el valor (se distingue por la procedencia: sin fila propia = default, distinto de "asignado en 0"), los métodos de pago **electrónicos (tarjeta, transferencia, Nequi)** quedan bloqueados al cobrar, con alerta que explica por qué y (para el admin) enlace directo a Configuración → Financieros. Doble barrera: la UI deshabilita el método y el backend rechaza `completar` con `codigo: 'COMISION_BANCARIA_SIN_CONFIGURAR'` (la regla vive en el servidor). Asignar 0 explícitamente ES asignar (negocio que absorbe o no paga datáfono). |

---

# PARTE I — DIAGNÓSTICO (resumen)

**Lo que está bien:** el cálculo es correcto y ya congela casi todo por transacción: `atencion { total, gan_prof, gan_salon, comision_productos, snapshot_param }`, `atencion_producto.comision` por línea, `atencion_pago` por método. La función `calcularAtencion` es pura y auditable.

**Lo que falta (por eso "no se ve"):**
1. **Ningún endpoint de transacciones**: el desglose solo cruza HTTP en la respuesta de `POST /citas/:id/completar`… y ambos paneles la descartan.
2. `GET /citas` no trae nada del cobro real: el front **reconstruye mal** los montos (`turnoTotal` = solo servicios) y los pinta en verde-ganancia. La lista de "Turnos completados" del especialista muestra **bruto disfrazado de ganancia** y nunca cuadra con el total del hero.
3. La regla por servicio (split % / fijo) no se persiste — sin ella no se puede mostrar "`$40.000 × 60% = $24.000`" con honestidad histórica.
4. Filtros de fecha inconsistentes (calendario en Análisis, quincena fija del mes en curso en Quincenal, 4 meses en Liquidación) y **sin filtro por especialista/servicio** fuera de Inventario.
5. No hay primitivas de UI: ni tabla del design system, ni fila expandible; `Tooltip` es hover-only y de una línea. `RangeCalendar` está duplicado.
6. Bugs reales encontrados: doble descuento bancario (D3), cierre siempre "mensual" (D6), walk-in retroactivo sin atención (D7), `liquidaciones/csv` que persiste (D5), botón "Finanzas" del dashboard que navega a un id inexistente.

---

# PARTE II — CONTRATOS (DTOs / respuestas API)

Todos en `packages/shared/src/dtos.ts`. Montos `number` redondeados a 2 (los DTOs nuevos no arrastran strings de Drizzle).

## 2.1 Cobro embebido en la agenda — `CitaAgenda.cobro`

`GET /citas` hace `LEFT JOIN atencion` (+ conteo de productos + métodos) para citas completadas:

```ts
export interface CobroCita {
  atencionId: string;
  total: number;            // lo realmente cobrado (servicios + productos + tarifa)
  totalServicios: number;
  totalProductos: number;
  numProductos: number;     // > 0 pinta el badge "incluye productos"
  metodos: MetodoPago[];    // de atencion_pago, orden por monto desc
  /** Ganancia del especialista en ESTA cita. Solo viaja para el admin y para
   *  el propio especialista; null para recepción (D2). */
  miGanancia: number | null;
}
// CitaAgenda gana: cobro: CobroCita | null   (null = sin cobrar o estados previos)
```

## 2.2 Desglose completo de una transacción — `GET /citas/:id/atencion`

Roles: Admin, y Especialista solo si la cita es suya (D2). Fuente: `atencion` + `snapshot_param` + `atencion_servicio` (nueva) + `atencion_producto` + `atencion_pago`.

```ts
export interface DesgloseServicio {
  nombre: string;
  precio: number;                       // congelado (cita_servicio.precio_aplicado)
  regla: { tipo: 'porcentaje' | 'valor_fijo'; valor: number; origen: 'servicio' | 'global' };
  ganProf: number;                      // precio × regla (antes de deducción)
  /** true en atenciones anteriores al plan: la regla se reconstruyó con la
   *  configuración actual y puede no ser la que se aplicó. */
  aproximado?: boolean;
}
export interface DesgloseProducto {
  nombre: string; cantidad: number; precioUnitario: number; total: number;
  comision: number;                     // atencion_producto.comision (congelada)
}
export interface DesgloseAtencion {
  atencionId: string; citaId: string; fecha: string;
  clienteNombre: string | null;
  especialista: { id: string; nombre: string };
  servicios: DesgloseServicio[];
  productos: DesgloseProducto[];
  pagos: { metodo: MetodoPago; monto: number }[];
  // Ajustes del snapshot (nombres = claves de snapshot_param):
  tarifaCliente: number;                // suma al profesional y al total
  deduccionAdmin: number;               // resta al profesional, suma al salón
  comisionBancaria: number;             // la absorbe el salón (D3)
  totales: {
    total: number; totalServicios: number; totalProductos: number;
    ganProf: number;                    // atencion.gan_prof (incluye comisión productos)
    ganSalon: number;                   // atencion.gan_salon
  };
}
```

**Invariante que la UI muestra en la fila de cuadre:** `total = ganSalon + ganProf + comisionBancaria`.

## 2.3 Arqueo del admin — `GET /atenciones`

`GET /atenciones?desde&hasta&sucursalId?&especialistaId?&servicioId?&productoId?&metodo?` (Admin). Controller nuevo en `finanzas/`. Paginado (`limit` default 100, `offset`), ordenado por fecha desc.

```ts
export interface ArqueoFila {
  atencionId: string; citaId: string; fecha: string;
  clienteNombre: string | null;
  especialista: { id: string; nombre: string };
  servicios: string[];                  // nombres, para la fila colapsada
  numProductos: number;
  metodos: MetodoPago[];
  total: number; ganProf: number; ganSalon: number;
}
export interface ArqueoResp {
  filas: ArqueoFila[];
  hayMas: boolean;
  totales: {                            // del RANGO COMPLETO (no de la página)
    transacciones: number; total: number; totalServicios: number;
    totalProductos: number; ganProf: number; ganSalon: number; comisionBancaria: number;
  };
}
```
La fila expandida reutiliza `GET /citas/:id/atencion` (carga perezosa al expandir).

## 2.4 Detalle de ganancias del especialista — `GET /especialistas/:id/ganancias/detalle`

Roles Admin + Especialista (con el candado del `:id` propio, D2). Unifica atenciones **y ventas directas** — la tabla que pide EL USUARIO: Fecha · Cliente · Concepto · Bruto · Regla · Neto.

```ts
export interface TransaccionEspecialista {
  tipo: 'cita' | 'venta_directa';
  fecha: string;
  citaId: string | null; atencionId: string | null; ventaId: string | null;
  clienteNombre: string | null;
  concepto: string;                     // "Corte + Barba" | "Shampoo ×2"
  bruto: number;                        // valor de servicios (cita) o de la venta
  reglaResumen: string;                 // "60% + $8.000 prod." | "Fijo $20.000" | "10% producto"
  neto: number;                         // lo que ganó el especialista en la transacción
}
export interface GananciasDetalle extends GananciasEspecialista {
  transacciones: TransaccionEspecialista[];
}
```
(`GananciasEspecialista` actual no cambia: los 4 agregados siguen siendo la cabecera.)

## 2.5 Liquidación y cierre

- `LiquidacionResultado` no cambia (ya trae `comisionServicios`/`comisionProductos`); con D3, `descuento` pasa a 0 siempre.
- `POST /liquidaciones/preview` acepta `sucursalId` **opcional** (consolidado).
- `Cierre.datosArchivados` pasa de `ReporteFinanciero` a `{ analisis: ReporteAnalisis; liquidaciones: LiquidacionResultado[] }` (los viejos se leen con fallback).
- `POST /cierres` nuevo contrato: `{ tipo: 'quincenal'|'mensual', ancla: 'YYYY-MM-DD', sucursalId? }` — el backend deriva `desde/hasta` en zona Bogotá y valida solapes (409 con el cierre que choca).
- `GET /cierres?sucursalId?` con las filas ordenadas desc + gate de lectura coherente.

---

# PARTE III — COMPONENTES FRONTEND

## 3.1 Primitivas nuevas del design system

| Pieza | Qué es |
|---|---|
| `ui/DataTable.tsx` | Tabla del DS: columnas tipadas (`align`, `width`, render), `Card padding={0}` + scroll-x, zebra, pie de totales, y **fila expandible** (`expandable: (row) => ReactNode`, chevron, `aria-expanded`, colSpan). Reemplaza las 10 tablas a mano empezando por las de Finanzas. |
| `ui/PeriodPicker.tsx` | Selector de período: `Segmented` Quincena 1 · Quincena 2 · Mes · Rango, flechas ← → para navegar períodos anteriores (zona Bogotá), etiqueta clara ("1–15 jul 2026"). Devuelve `{ desde, hasta, tipo, ancla }`. Internamente reutiliza `ui/RangeCalendar` para el modo Rango y **elimina la copia privada** de `finanzas-ui.tsx`. |
| `Tooltip` (extender) | `multiline`, apertura por foco/teclado, y variante `<InfoTip>` (icono ⓘ + texto largo) para las fórmulas. |
| `DesgloseSheet` / `DesgloseDialog` | El MISMO contenido de desglose (2.2) en dos envoltorios: `Sheet` en el panel del especialista (móvil) y `Dialog` en el admin. Estructura: servicios línea a línea con su fórmula (`$40.000 × 60% = $24.000`), productos con su comisión, ajustes (tarifa +, deducción −, comisión bancaria −), pagos por método, y la fila de cuadre `Total cobrado = Negocio + Especialista (+ comisión bancaria)`. |

## 3.2 Panel del especialista

1. **Ganancias (`GananciasSpec`)** — la lista "Turnos completados" pasa a mostrar **el NETO del especialista** por fila (verde solo para el neto; el bruto en gris al lado: `$40.000 → $24.000`), suma que ahora SÍ cuadra con el hero. Debajo, sección "Ventas directas" si las hay. Tocar una fila abre el **DesgloseSheet**. Fuente: `GET /especialistas/:id/ganancias/detalle`.
2. **Mi día (`SpecApp`)** — el DayStat "Hoy" deja de sumar brutos: pasa a "**Ganado hoy**" con el neto real (del mismo detalle) y el bruto se reetiqueta donde aplique como "Facturado". El turno en curso sigue mostrando el precio a cobrar (eso sí es bruto y está bien).
3. **Detalle de turno (`spec-agenda`)** — en completadas, "Total cobrado" pasa a usar `cobro.total` real (con productos), añade la línea "Incluye N producto(s)" y el botón **"Ver mi ganancia"** → DesgloseSheet.
4. **Tras cobrar (`spec-cobro`)** — la respuesta de `completar` ya no se tira: se muestra un paso final "¡Cobrado!" con `Total`, `Tu ganancia` y "Ver desglose". Transparencia en el momento que más importa.

## 3.3 Panel del admin

1. **Agenda** — `AppointmentRow` y el Historial usan `cobro.total` (ticket real) para completadas, con badge 📦 "productos" cuando `numProductos > 0` y los métodos de pago como iconitos. "Ingresos" de `DayCounters` pasa a sumar `cobro.total`. Clic en una completada → **DesgloseDialog** (arqueo de esa cita).
2. **Finanzas reorganizado** — cabecera con **PeriodPicker global** (el período elegido aplica a TODAS las pestañas) + selector de sucursal existente. Pestañas:
   - **Resumen** (Análisis+Reportes fusionados): KPIs, desgloses agregados, tendencia, donuts y ranking — ahora con filtros por **especialista** y **servicio** (query params que `/reportes/analisis` ya puede recibir). Gastos siguen aquí.
   - **Transacciones** (nueva): el arqueo fila por fila (`DataTable` sobre `GET /atenciones`) con filtros especialista/servicio/producto/método, totales del rango al pie y **fila expandible** con la partición exacta.
   - **Liquidación** (movida desde Gestión → Equipo, gate `particion`): tabla por especialista con fila expandible (comisión servicios / comisión productos / transacciones del período vía 2.4), usa el período global (quincenas incluidas), consolidado o por sede, y CSV **sin** persistir.
   - **Cierre de período** (gate `cierre_periodo`, reemplaza "Control quincenal"): muestra el período global elegido con su resumen y su liquidación, botón "Cerrar quincena/mes" (tipo correcto según el período activo), histórico de cierres con detalle expandible del snapshot archivado, y aviso de solape. Texto guía: *"Cierra la quincena para dejar constancia de lo facturado y lo liquidado a cada especialista."*
   - **Inventario y ventas** (como hoy, adoptando el período global y `DataTable`).
3. **Dashboard** — se corrige el botón "Finanzas" (`onNav('gastos')` → `'finanzas'`).
4. **Gestión → Equipo** — pierde el tab Liquidación y la prop `particion`.

---

# PARTE IV — FASES DE EJECUCIÓN

| Fase | Contenido | Verificación para cerrar |
|---|---|---|
| **F1 · Persistencia y arqueo (backend)** | Migración: tabla `atencion_servicio` (atencion_id, servicio_id, nombre, precio, split_type, split_valor, origen_regla, gan_prof) poblada en `completar`; `liquidacion` gana `desde/hasta/comision_servicios/comision_productos`. Endpoints: `GET /atenciones` (2.3), `GET /citas/:id/atencion` (2.2, con reconstrucción marcada `aproximado` para filas viejas). Fix D7 (walk-in retroactivo crea atención), candado D9 en `completar` (+ flag `comisionBancariaConfigurada` legible por los paneles) y el botón del dashboard. | Specs: el desglose cuadra (`total = ganSalon + ganProf + comisionBancaria`) contra `calcularAtencion` en casos con productos, tarifa, deducción, pago dividido y sin partición; retroactivo aparece en reportes. |
| **F2 · Especialista (backend+UI)** | `GET /ganancias/detalle` (2.4) + candado del `:id` propio; `cobro` en `GET /citas` (2.1, con visibilidad D2); UI spec completa (§3.2: filas neto, DesgloseSheet, "Ganado hoy", pantalla post-cobro). | Spec: el neto listado suma exactamente `total` del agregado; un especialista pidiendo ganancias ajenas → 403. E2E spec panel. |
| **F3 · Agenda admin** | §3.3.1: ticket real + badge productos + DesgloseDialog. | E2E: cita cobrada con productos muestra ticket total y desglose que cuadra. |
| **F4 · Finanzas reorganizado** | PeriodPicker global + pestañas Resumen (con filtros especialista/servicio) y **Transacciones** (`DataTable` + fila expandible). `/reportes/analisis` acepta `especialistaId`/`servicioId`. | E2E: cambiar el período en la cabecera refresca todas las pestañas; arqueo filtra por especialista. |
| **F5 · Liquidación a Finanzas** | Mover panel, quincenas vía período global, filas expandibles con desglose y transacciones, consolidado, CSV sin persistir, **fix D3** (eliminar doble descuento). | Spec liquidación: `neto = bruto`, desglose por especialista cuadra con sus transacciones; E2E del traslado (Gestión ya no lo tiene, Finanzas sí). |
| **F6 · Cierres** | Nuevo contrato de `POST /cierres` (ancla + tipo, rangos backend, anti-solape 409), archivo `analisis + liquidaciones`, pestaña Cierre de período, aviso al revertir sobre período cerrado (D6). | Specs: quincena 1/2/mes derivan el rango Bogotá correcto; solape → 409; el snapshot leído del histórico = lo que se veía al cerrar. |
| **F7 · Verificación y despliegue** | Suites completas API + web, pasada E2E, build, deploy y humo en producción (un cierre de quincena de prueba). | Todo verde + humo confirmado por EL USUARIO. |

---

# PARTE V — RIESGOS Y BORDES

1. **Historia previa al plan**: las atenciones viejas no tienen `atencion_servicio`; su desglose por servicio se reconstruye con la regla ACTUAL del servicio y se marca `aproximado` (la UI lo dice: "regla actual, puede diferir de la aplicada"). Los totales congelados (`total/ganProf/ganSalon/snapshot`) siempre son exactos.
2. **Rendimiento**: `GET /atenciones` pagina (100) y los totales del rango van por agregación SQL aparte; el `LEFT JOIN` de `GET /citas` solo añade columnas a citas completadas del día consultado.
3. **Partición apagada / plan Básico**: `ganProf = 0` — las vistas del especialista muestran "Tu negocio no reparte por especialista" en lugar de ceros mudos; Liquidación y Cierre mantienen sus gates de plan∧config (y el detalle de ganancias explica el porqué del 0).
4. **Reversiones**: `revertir` sigue borrando la atención (v1); con D6 avisa si el período ya está cerrado. Un lock contable duro queda para una fase futura si EL USUARIO lo pide.
5. **Recepcionista**: ve tickets, nunca reparto (D2) — el DTO simplemente no incluye `miGanancia` para ese rol.
