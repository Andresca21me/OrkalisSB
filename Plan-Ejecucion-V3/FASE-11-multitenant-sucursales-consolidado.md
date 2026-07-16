# FASE-11 · Multi-tenant, sucursales y consolidado

## Objetivo
Probar de forma transversal el **aislamiento multi-tenant desde el frontend** (un negocio nunca ve datos de otro, en ninguna pantalla) y la jerarquía **negocio → sucursal**: filtro por sucursal vs vista **consolidada**, y especialista operando en **varias sedes**. Es la fase que blinda ADR-001 a nivel de UI, más allá del check puntual de la v2.

## Prerrequisitos
- FASE-00, FASE-01. Dos tenants del seed (barbería multi-sede + salón). Conviene tener FASE-04/06/07/09 para reusar sus Page Objects.

## Pantallas / rutas bajo prueba
- Todas las pantallas con datos por tenant/sede: agenda admin, clientes, equipo, finanzas, recepción, especialista, reserva pública.

## Casos de prueba

### Aislamiento entre tenants
1. **Clientes**: barbería ve "Juan Pérez" y NO "Laura Castro"; salón al revés (migrado de la v2, ampliado).
2. **Agenda/citas**: las citas de la barbería no aparecen para admin/recepción/especialista del salón, y viceversa.
3. **Equipo**: el equipo del salón (Valentina/Sara) no aparece en la barbería.
4. **Finanzas**: los números de un tenant no incluyen al otro (ingresos/gastos aislados).
5. **Reserva pública cruzada**: el enlace de una sucursal de la barbería solo ofrece sus especialistas/servicios; no expone datos del salón.
6. **Negativo por API desde el front**: un token de la barbería usado contra un recurso del salón (id de otro tenant) → 403/404/vacío; la UI no muestra el dato (verifica que RLS/guards protegen aunque se manipule).

### Jerarquía negocio → sucursal (HU-ADM-002)
7. **Filtro por sucursal**: en *Sede Centro*, agenda/finanzas/reportes muestran solo datos de Centro.
8. **Vista consolidada**: en "Todo el negocio", los indicadores agregan Centro + Norte sin filtración entre sedes (los totales = suma de sedes).
9. **Cambio de sede recalcula**: alternar Centro↔Norte cambia los datos visibles de forma consistente en cada pantalla que tiene selector de sucursal.
10. **Especialista en dos sedes**: Carlos aparece en la agenda y disponibilidad de Centro y de Norte; su agenda lo muestra operando en una sede a la vez (coordinar con FASE-04 caso 19).
11. **Dato de una sede no aparece en otra**: una cita/gasto de Centro no se ve al filtrar por Norte (refuerza FASE-03 caso 6).

## Datos de prueba
- Barbería (Centro/Norte) y Salón. Tokens de ambos tenants (oráculo) para el caso negativo 6.

## Huecos de testabilidad
- Selector de sucursal/consolidado del Shell: `data-testid="sucursal-selector"`, opciones `sucursal-opt-{id}`, consolidado `sucursal-consolidado`.
- Reutiliza los `data-testid` de cada pantalla ya definidos en sus fases.

## Verificación / Done
- Ningún tenant ve datos de otro en ninguna pantalla (positivos + negativo por manipulación de id).
- Filtro por sucursal y consolidado correctos (consolidado = suma de sedes).
- Especialista multi-sede coherente.
- `specs/11-multitenant/*` verde y estable.

## Trazabilidad
- HU-ADM-002; ADR-001 (aislamiento/RLS verificado desde el front). Generaliza `isolation.spec.ts` de la v2.
