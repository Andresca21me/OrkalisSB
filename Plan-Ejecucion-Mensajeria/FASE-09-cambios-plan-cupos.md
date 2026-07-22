# FASE-09 · Cambios de plan ↔ cupos (endurecer y documentar)

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.
>
> **Estado: ✅ implementada** (259 tests verdes). Sin acciones manuales.

## Objetivo
Garantizar y probar que **upgrade / downgrade / cambio de nº de especialistas / renovación / cancelación** se comportan correctamente respecto a los cupos de mensajería (Parte V del plan). Corregir la inconsistencia de catálogo Empresarial.

## Prerrequisitos / Dependencias
- FASE-03 (cupos por ciclo).

## Cambios técnicos (Pasos de Claude)
1. **Validar comportamiento** (sin reescribir la lógica de cambio de plan, que ya existe en `pago-suscripcion.service.ts` y `suscripcion.service.ts`):
   - Upgrade → cupo sube de inmediato (denominador), consumo se conserva.
   - Downgrade / bajar nº especialistas → cupo baja; si consumo ≥ nuevo cupo: marketing bloqueado, transaccional blando + alerta (D2). Aplica al ciclo actual.
   - Renovación (aniversario) → nuevo ciclo, consumo reinicia a 0 (FASE-03).
   - Cancelación/Suspensión → `tieneAcceso()=false` corta el acceso; los envíos dependientes del guard se detienen.
2. **Confirmar** que ninguna ruta de cambio de plan toca `consumo_mensajeria` (correcto: solo cambia el cupo).
3. **Corregir inconsistencia** `apps/web/src/pages/site/site-data.ts`: Empresarial `included` 2 → 15 (alinear con `plan-registry.ts`).
4. **Documentar** en `PLAN-MENSAJERIA.md` (tabla Parte V) cualquier ajuste fino que surja.

## Archivos afectados
- `apps/api/src/pagos/pago-suscripcion.service.ts` (solo si hace falta ajuste)
- `apps/api/src/negocio/suscripcion.service.ts`
- `apps/api/src/notificaciones/cupos.service.ts`
- `apps/web/src/pages/site/site-data.ts`

## ⚠️ Acción requerida del desarrollador
- Ninguna.

## Riesgos y mitigaciones
- **Casos límite de ciclo en downgrade** (a mitad de ciclo) → cubrir con pruebas; el cupo nuevo aplica ya, el cobro nuevo va al próximo ciclo (ya definido por prorrateo existente).
- **Dos rutas de cambio de plan** conviviendo → asegurar que ambas recalculan cupo igual; preferir la de prorrateo (la del frontend).

## Criterios de aceptación (Done)
- Cada caso de la tabla de Parte V se comporta como está descrito, con pruebas automatizadas.
- `site-data.ts` coherente con el backend.

## Pruebas
- Matriz cambios de plan × cupos (upgrade/downgrade/nº esp./renovación/cancelación).
- Consumo conservado dentro del ciclo; reinicio en renovación.

## Qué se verificó (y qué se encontró)
La lógica de cambio de plan **no se reescribió**: se cubrió con una matriz de pruebas (`notificaciones/cupos-plan.spec.ts`). La propiedad de fondo que lo hace funcionar es que **el cupo es derivado**: `CuposService` lo calcula al leer desde `plan` + `num_especialistas`, así que las dos rutas de cambio (prorrateo de pagos y `PATCH /suscripcion/plan`) actualizan el límite **sin tener que saber nada de mensajería**.

| Caso | Comportamiento verificado |
|---|---|
| Upgrade | Cupo sube en el acto; el consumo del ciclo se conserva; mismo ciclo |
| Más especialistas | Cupo escala por cada uno sobre los incluidos |
| Downgrade a mitad de ciclo | Cupo baja ya; el consumo gastado NO se borra y puede quedar por encima; `restante` nunca es negativo |
| Sobre cupo tras downgrade | Marketing `sin_cupo` (bloqueo duro), transaccional sigue (D2) |
| Renovación (aniversario) | Consumo arranca en 0 en el ciclo nuevo; el cupo no cambia por renovar |
| Cancelación / suspensión | `tieneAcceso()` false → el guard corta el acceso y con él los envíos |

**Confirmado (paso 2):** ninguna ruta de cambio de plan escribe en `consumo_mensajeria`. Solo `CuposService` (contador) y `plataforma.service` (lectura) la tocan; hay una prueba que cambia de plan dos veces y comprueba que los contadores quedan intactos.

**Bug encontrado y corregido (paso 3):** `site-data.ts` decía que **Empresarial incluía 2 especialistas** cuando el backend incluye **15**. No era cosmético: el simulador de precio de la landing le sumaba al visitante 13 especialistas extra a 25 000 COP cada uno — **325 000 COP/mes de sobreprecio mostrado** en el plan más caro. Corregido a 15 y protegido con una prueba que compara ambos catálogos (verificada por mutación: al revertir el número, la prueba falla).

> **Causa de fondo pendiente:** el catálogo está **duplicado** entre `plan-registry.ts` (backend) y `site-data.ts` (landing). La prueba impide que vuelvan a divergir en silencio, pero la solución definitiva es mover los números compartidos a `@orkalis/shared` y que ambos los consuman. No entra en esta fase.

## Trazabilidad
ADR-009, RF-006, `Plan-Ejecucion-Pagos-Suscripciones/FASE-08/09`, Parte V del plan.

## Resultado esperado
Cambios de plan que actualizan los límites de forma predecible y probada.
