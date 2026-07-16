# FASE-09 · Cambios de plan ↔ cupos (endurecer y documentar)

> Parte de `PLAN-MENSAJERIA`. Abre `PLAN-MENSAJERIA.md` + este archivo.

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

## Trazabilidad
ADR-009, RF-006, `Plan-Ejecucion-Pagos-Suscripciones/FASE-08/09`, Parte V del plan.

## Resultado esperado
Cambios de plan que actualizan los límites de forma predecible y probada.
