# FASE-14 · Sitio, no-regresión y cierre

## Objetivo
Cerrar la v3: probar el **sitio de marketing** (navegación, precios, comparativa y **calculadora de precios** — lógica de cliente, no backend), ejecutar una pasada de **no-regresión** de responsive y accesibilidad sobre las pantallas clave, correr la **suite completa** como gate, y producir el **informe de hallazgos** y el cierre del tablero. Es la fase de "gate" de la v3.

## Prerrequisitos
- FASES 00–13 cerradas (o con sus hallazgos documentados). Entorno limpio (re-sembrado).

## Pantallas / rutas bajo prueba
- `SiteApp` y `site-*` (`apps/web/src/pages/site/`): landing, precios, comparativa, calculadora. (El funnel de alta/checkout Wompi es **solo visual** en v2 → se prueba como maqueta, sin transacción.)
- Pasada de regresión sobre: login, reserva, agenda admin, app especialista (móvil).

## Casos de prueba

### Sitio de marketing
1. **Navegación**: landing → precios → comparativa → calculadora y de vuelta; los enlaces/CTA funcionan y las secciones cargan.
2. **Precios**: la tabla de planes muestra los precios del registry de planes; coherentes con `site-data`.
3. **Calculadora de precios**: variar plan / nº de especialistas recalcula el cargo en vivo y coincide con la fórmula (base + adicional por especialista) — verificación de la lógica de cliente.
4. **Comparativa**: la matriz de funciones por plan se renderiza sin errores de clave/fragmento (regresión del fix v2).
5. **Funnel visual (maqueta)**: signup/checkout muestran sus estados visuales pero **no** procesan (marcado como diferido); verificar que no rompe ni promete cobro real.
6. **Animaciones/fondo**: el hero anima; con `prefers-reduced-motion` la animación se neutraliza (regresión a11y v2-FASE-14).

### No-regresión responsive (RNF-003)
7. **Anchos clave**: 360, 768, 1024, 1280, 1440 en login, reserva (móvil), agenda admin (escritorio) → sin **scroll horizontal** accidental ni solapes; el nav admin colapsa a hamburguesa < 920px.
8. **Safe-area móvil**: reserva pública y app del especialista respetan `safe-area-inset` (no se cortan controles abajo).

### No-regresión accesibilidad (RNF a11y)
9. **Diálogos**: en un modal representativo (p. ej. nuevo cliente, cobro), `Esc` cierra, el foco queda atrapado y se restaura al cerrar; `role="dialog"`/`aria-modal` presentes (regresión del hook `useDialogA11y`).
10. **Foco visible**: tabular por el login muestra el anillo de foco 2px en cada control.
11. **Estados con copy del DS**: errores de API se muestran como `ErrorState`/toast, nunca stack traces (muestreo en 2–3 pantallas).

### Gate y cierre
12. **Suite completa verde**: `pnpm --filter web e2e` corre **todas** las fases; estable (sin flakes, ≤1 retry).
13. **Informe de hallazgos**: consolidar en `_MATRIZ-TRAZABILIDAD §3` todos los defectos con severidad; actualizar el resumen de cobertura (HU cubiertas / 32, flujos cruzados / 11).
14. **Tablero**: marcar `PLAN-V3.md §6` completo. Bajo fix-forward, los defectos puntuales ya quedaron **corregidos** durante sus fases; aquí solo se listan los hallazgos **escalados** (los que requerían feature/rediseño/migración y se consultaron al USUARIO — p. ej. exportación PDF si estaba ausente, funnel Wompi, push en vivo) como entradas pendientes de decisión.

## Datos de prueba
- Solo lectura para el sitio (estático/cliente). Entorno re-sembrado para la pasada de regresión.

## Huecos de testabilidad
- Calculadora: `data-testid="calc-plan"`, `calc-especialistas`, `calc-total`.
- Reutiliza los `data-testid` ya creados para la pasada de regresión.

## Verificación / Done
- Sitio (nav, precios, calculadora, comparativa) cubierto; funnel verificado como maqueta.
- Responsive (5 anchos, sin scroll horizontal, safe-area) y a11y (diálogos, foco, copy de error) sin regresiones.
- Suite completa verde y estable; informe de hallazgos y resumen de cobertura completos.
- `PLAN-V3.md §6` en ✅; deudas documentadas.

## Trazabilidad
- RNF-003 (responsive/safe-area), RNF-005 (fidelidad), RNF-016 (gate), a11y. Cierra la matriz de trazabilidad de la v3.
