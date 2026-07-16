# FASE-09 · Admin · finanzas y liquidaciones

## Objetivo
Probar el centro financiero: **Análisis** (ingresos, gastos, ganancia neta, margen), **Reportes** con gráficos y **exportación CSV/PDF**, **control quincenal / cierre de período** (archivar y reiniciar contadores), registro de **gastos** (fijos/variables), y **liquidaciones** por especialista con el **descuento del 2%** por transferencia. Verificar que las atenciones/ventas/gastos se reflejan en los números (flujo cruzado operación → finanzas) y el caso de **período sin datos**.

## Prerrequisitos
- FASE-00, FASE-01. Seed con **quincena liquidable** (atenciones de ~11–12 días atrás) y gastos. FASE-08 útil (ventas/gastos generados).
- ⚠️ Fase **destructiva** (cierre de período): correr al final o re-sembrar en `beforeAll` (ver `_DATOS-Y-CREDENCIALES §7`).

## Pantallas / rutas bajo prueba
- `FinanzasScreen` → `AnalisisScreen`, `ReportesFinScreen`, `QuincenalScreen`, `finanzas-modals` (venta/gasto). Recharts se carga lazy al abrir (verificar que aparece).

## Casos de prueba

### Análisis (HU-ADM-010 soporte)
1. **Análisis con datos**: ingresos, gastos, ganancia neta y margen se muestran con valores coherentes (formato COP `es-CO`).
2. **Gráficos cargan (lazy)**: al abrir la pestaña, el chart (recharts) aparece tras su carga diferida; sin errores.
3. **Período sin datos**: seleccionar un período sin actividad → indicadores en **cero**, sin gráficos vacíos confusos ni errores.
4. **Cambio de período/sucursal**: filtrar por sede o por rango recalcula los números.

### Gastos (HU-ADM-008)
5. **Registrar gasto fijo**: alta de un gasto fijo recurrente → entra en los egresos del período.
6. **Registrar gasto variable**: alta de gasto variable (p. ej. insumos) → afecta egresos.
7. **Eliminar gasto**: eliminar un gasto fijo lo marca inactivo y deja de afectar períodos futuros **sin** alterar históricos.
8. **Reflejo en análisis**: un gasto nuevo reduce la ganancia neta del período (cruzado, tras recargar).

### Reportes y exportación (HU-ADM-010)
9. **Exportar CSV**: la exportación dispara una descarga con contenido (verificar el `download` de Playwright y que no esté vacío).
10. **Exportar PDF**: ídem PDF con ingresos/gastos/ganancia/margen. *(Si la exportación PDF falla por un bug puntual, corregir sobre la marcha. Si el PDF **no existe** como feature, es un hallazgo a **escalar** —no se implementa por cuenta propia— y se verifica el CSV mientras tanto.)*

### Quincenal / cierre (HU-ADM-011)
11. **Ver control quincenal**: la pantalla lista la quincena liquidable del seed con sus totales.
12. **Cerrar mes/quincena**: ejecutar el cierre archiva servicios/citas/gastos del período y **reinicia** los contadores; el histórico queda consultable.
13. **Cierre desactivado**: si el módulo de cierre está off (FASE-10), la opción **no aparece** y la operación es acumulada.

### Liquidaciones (HU-ADM-009)
14. **Liquidación con transferencia**: generar la liquidación de un especialista por transferencia → aplica el **descuento del 2%** sobre las ganancias brutas y detalla servicios y ventas con su comisión.
15. **Liquidación con partición desactivada**: si el negocio desactiva la partición por especialista, el módulo de liquidación **no está disponible** y lo indica claramente (coordinar con FASE-10).
16. **Reflejo del payout**: la liquidación refleja el payout de los servicios configurados en FASE-08 (valor fijo vs %).

## Datos de prueba
- Quincena liquidable del seed (no hay que crearla). Gastos nuevos con descripción única. Especialista Carlos para la liquidación.

## Huecos de testabilidad
- Análisis/KPIs financieros: `data-testid="fin-ingresos|gastos|neta|margen"`.
- Exportar: `data-testid="fin-export-csv|fin-export-pdf"` (Playwright captura el `download`).
- Cierre: `data-testid="quincenal-cerrar"`; liquidación: `data-testid="liq-generar"`, `liq-metodo-transferencia`, `liq-descuento`.

## Verificación / Done
- Análisis, gastos, reportes (CSV; PDF o hallazgo), quincenal/cierre y liquidaciones (2%) cubiertos.
- Período sin datos no rompe.
- Operación (atención/venta/gasto) se refleja en los números.
- `specs/09-finanzas/*` verde; entorno re-sembrado si hubo cierre.

## Trazabilidad
- HU-ADM-008, 009, 010, 011; flujos cruzados operación→finanzas (`_MATRIZ §2`). RNF-004 (COP/es-CO).
