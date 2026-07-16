# FASE-08 · Admin · gestión (equipo, servicios, inventario)

## Objetivo
Probar la gestión operativa del negocio y sus **efectos cruzados**: equipo (alta/baja, asignación a sucursales y su reflejo en el enlace público y la agenda), servicios (repartición por % y por **valor fijo** y su efecto en el payout al completar), e inventario (stock, **alertas de stock bajo**, registrar venta que descuenta stock y genera comisión/gasto).

## Prerrequisitos
- FASE-00, FASE-01. Seed barbería (equipo, 4 servicios con repartición, 3 productos con uno en stock bajo). FASE-04 útil para completar turnos y ver el payout.

## Pantallas / rutas bajo prueba
- `GestionScreen` → `EquipoScreen`, `ServiciosScreen`, `InventarioScreen` (`apps/web/src/pages/admin/`).

## Casos de prueba

### Equipo (HU-ADM-005)
1. **Listar equipo**: muestra especialistas con su(s) sucursal(es); estados carga/vacío/error.
2. **Alta de especialista**: crear uno nuevo y asignarlo a una sede → aparece en la agenda y en el enlace público de esa sede.
3. **Asignar a dos sucursales**: asignar a *Centro* y *Norte* → reservable en ambas (verificable en disponibilidad pública de cada sede).
4. **Baja lógica de especialista**: dar de baja → **deja de aparecer** en el enlace público y en nuevas asignaciones, **pero** su historial/ganancias se conservan (verificable en reportes/liquidaciones).
5. **Efecto en suscripción**: nº de especialistas activos alimenta el cobro (coordinar con FASE-13/suscripción; aquí basta verificar el conteo en la UI de suscripción).

### Servicios y repartición (HU-ADM-006)
6. **Listar/crear servicio**: crear "Corte clásico" con precio y duración.
7. **Repartición por valor fijo**: configurar $15.000 fijo al profesional → al **completar** ese servicio (vía FASE-04), el profesional recibe exactamente $15.000 y el resto al salón (verificar en cobro/ganancias/liquidación).
8. **Repartición por porcentaje**: configurar % → el payout se reparte según el %.
9. **Servicio sin repartición personalizada**: usa la repartición estándar de la sucursal.
10. **Validación de repartición**: porcentajes que no suman 100% (o valor fijo > precio) → el editor lo rechaza.

### Inventario (HU-ADM-007)
11. **Listar inventario**: productos con stock; el de **stock bajo** (Shampoo profesional) aparece marcado y en el panel de alertas.
12. **Entrada de compra**: registrar entrada con costo → el stock aumenta y opcionalmente genera un **gasto variable** (verificable en finanzas).
13. **Registrar venta**: vender un producto → el stock **baja**, se genera comisión al profesional y el ingreso entra a finanzas.
14. **Alerta dinámica**: bajar el stock de un producto por debajo del mínimo lo marca "Stock bajo" en vivo (tras recargar).
15. **Inventario desactivado**: si el módulo está off (FASE-10), la sección no aparece y no exige productos — verificación de enlace con config.

## Datos de prueba
- Equipo/servicios/productos del seed + nuevos con nombres únicos. Para el payout (caso 7/8) completar un turno del servicio configurado.
- Re-sembrar tras esta fase si se alteró mucho el catálogo/stock.

## Huecos de testabilidad
- Equipo: `data-testid="esp-row-{id}"`, acciones `esp-nuevo|baja|editar`, selector de sucursales `esp-sucursales`.
- Servicios: editor de repartición `data-testid="repart-tipo-{pct|fijo}"`, `repart-valor`, `servicio-guardar`.
- Inventario: `producto-row-{id}`, `producto-stock`, badge `producto-stockbajo`, `inv-registrar-venta`, `inv-entrada`.

## Verificación / Done
- Alta/baja/asignación de equipo se reflejan en agenda y enlace público.
- Las dos formas de repartición producen el payout correcto al completar.
- Inventario: stock, alertas, venta (descuenta + comisiona) y entrada (gasto) cubiertos.
- `specs/08-gestion/*` verde y estable.

## Trazabilidad
- HU-ADM-005, 006, 007; flujos cruzados equipo/servicio→reserva/finanzas (`_MATRIZ §2`). ADR-009 (nº especialistas).
