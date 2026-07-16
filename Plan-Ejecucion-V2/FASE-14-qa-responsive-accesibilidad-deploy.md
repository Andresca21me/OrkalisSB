# FASE-14 · QA integral: responsive, accesibilidad, E2E y despliegue

## Objetivo
Cerrar la v2 con calidad: verificar que **toda** la app replica el prototipo, es responsive y accesible, pasa pruebas **end-to-end por rol** contra la API real, cumple rendimiento, y se despliega. Es la fase de "gate" antes de dar la v2 por terminada.

## Prerrequisitos
- FASES 01–13 cerradas (las que apliquen según el alcance de FASE-00).

## Fuente visual (prototipo)
- Todas las apps del prototipo como **referencia de comparación 1:1** (incluidas las capturas de `scraps/` y `.thumbnail`).

## Pasos de Claude

### 1. Auditoría visual de fidelidad
- Recorrer cada pantalla construida y compararla lado a lado con su equivalente del prototipo: layout, tipografía (Plus Jakarta/DM Sans/JetBrains Mono), color (navy/azul/teal), radios, sombras, densidad, motion (120–260ms, sin bounce), foco visible. Corregir desviaciones. Dejar un checklist de paridad por pantalla.

### 2. Responsive
- Verificar breakpoints: admin/recepción (escritorio/tablet, sidebar 240px → colapsa en tablet), reserva pública y spec app (móvil-first con **safe-area-inset**). Probar en anchos clave (360, 768, 1024, 1280, 1440). Sin scroll horizontal accidental.

### 3. Accesibilidad
- Foco visible 2px `#1A73E8` en todo control; navegación por teclado en diálogos (atrapar foco, Esc cierra); roles/labels ARIA en formularios y modales; contraste AA; `prefers-reduced-motion`. Skeleton en vez de spinners de página completa.

### 4. Estados y errores
- Confirmar que **toda** lista/pantalla tiene datos/cargando/vacío/error, y la reserva además conflicto. Errores de API se muestran con copy del DS, no stack traces. Manejo de 401→refresh, 403, 409 (conflicto), 5xx.

### 5. Pruebas E2E por rol (Playwright o similar)
- Flujos críticos contra la API real:
  - **Cliente:** reserva completa con OTP + caso de concurrencia (sin doble reserva).
  - **Admin:** login → panel → crear cita → completar con cobro → ver reporte.
  - **Especialista:** iniciar → cobrar → completar; walk-in.
  - **Recepción:** tablero → reasignar → walk-in → cobro.
  - **Onboarding/Alta:** (si FASE-12) signup → checkout sandbox → onboarding.
- Incluir prueba de **aislamiento multi-tenant** desde el front (un negocio no ve datos de otro).

### 6. Rendimiento
- Code-splitting por ruta/app (público, admin, spec, site cargan por separado). Lazy de gráficos. Medir bundle y first load; skeletons para percepción. Imágenes/íconos optimizados (Lucide tree-shaken).

### 7. Despliegue
- Build de `apps/web` con `VITE_API_URL` y `VITE_WOMPI_PUBLIC_KEY` por entorno. Servir el front (Railway/estático+CDN según ADR-008) con TLS. Verificar CORS contra la API. CI: build + typecheck + E2E como **gate** (RNF-016). Actualizar `DEPLOY.md`.

### 8. Cierre
- Marcar el tablero de progreso del `PLAN-V2.md` completo. Listar deudas conocidas (p. ej. PDF diferido, panel plataforma minimal) para una posible v2.1.

## Backend: huecos a cubrir
- Cerrar cualquier hueco residual de `_HUECOS-BACKEND.md` que las fases hayan diferido. Confirmar que CORS y rate-limit del backend aceptan el origen del front desplegado.

## ⚠️ ACCIÓN DEL USUARIO
- Proveer credenciales/variables de **entornos** (staging/prod): `VITE_API_URL`, Wompi prod, dominio/TLS.
- Aprobar la auditoría visual final (paridad con el prototipo).

## Verificación / Done
- Checklist de paridad visual por pantalla: todo ✅.
- Responsive y accesibilidad cumplen en los anchos/criterios definidos.
- Suite E2E por rol pasa en CI como gate; prueba de aislamiento multi-tenant pasa.
- Front desplegado por entorno con TLS, hablando con la API por HTTPS, CORS OK.
- `DEPLOY.md` actualizado; tablero de `PLAN-V2.md` en ✅; deudas documentadas.

## Trazabilidad
- RNF-003 (responsive/safe-area), RNF-005 (fidelidad al prototipo), RNF-016 (pruebas como gate), RNF-018 (navegadores), ADR-001 (aislamiento verificado desde el front), ADR-008 (deploy), RNF-012 (sin secretos).
