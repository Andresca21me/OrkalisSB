# FASE-12 · Sitio web marketing + maqueta de alta/checkout (SOLO VISUAL en v2)

## Objetivo
Construir el **sitio web corporativo** y el **funnel de alta** tal como el prototipo, **solo a nivel visual**: Landing, Precios, Comparativa, Calculadora, **Alta (signup)**, **Checkout (Wompi)**, Bienvenida y Soporte. En la v2 estas páginas se ven y navegan fielmente al prototipo, **pero NO procesan nada**: el signup no crea cuenta y el checkout Wompi no cobra. La funcionalidad (alta self-service real + pasarela Wompi) se **difiere a una versión posterior**.

> **Alcance acordado (FASE-00 decisión #1): SOLO VISUAL.** Nada de claves Wompi ni cableado de pago en v2. El objetivo es que el sitio exista visualmente completo y listo para "encender" en la siguiente versión.

## Prerrequisitos
- FASE-01, FASE-02 cerradas.
- (No requiere FASE-04 ni claves Wompi en v2, al ser solo visual.)

## Fuente visual (prototipo)
- `site-app.jsx` (orquestador del sitio).
- `site-pages.jsx` (`LandingPage`, `PricingPage`, `ComparePage`, `CalculatorPage`).
- `site-funnel.jsx` (`SignupPage`, `CheckoutPage`, `WelcomePage`, `PlanSummary`, `SField/SInput/SSeg`).
- `site-support.jsx` (soporte/ayuda), `site-ui.jsx`, `site-data.js` (referencia).

## Pasos de Claude

### 1. Estructura y rutas públicas
- `pages/site/` con rutas públicas (`/`, `/precios`, `/comparativa`, `/calculadora`, `/alta`, `/checkout`, `/bienvenida`, `/soporte`). Top nav marketing + footer navy. Voz del DS (Ruler+Sage, CTAs específicos, sin emoji).

### 2. Landing / Precios / Comparativa / Calculadora
- `LandingPage`: hero ("Tu empresa en control…"), feature grid, prueba social, CTA. Sin imágenes foto; motivos geométricos.
- `PricingPage`: planes **Básico/Pro/Premium/Empresarial** con su modelo **plan + nº especialistas + cupos** (`[[modelo-cobro-suscripcion]]`, ADR-009).
- `ComparePage`: tabla comparativa de planes.
- `CalculatorPage`: calculadora de precio según especialistas/cupos → estima el cobro mensual (misma lógica que el backend de suscripción; consumir endpoint de cálculo si existe, no duplicar reglas).

### 3. Alta (signup) — maqueta
- `SignupPage`: datos del negocio + plan elegido (`PlanSummary`), con todas las validaciones de formato del lado cliente y los **estados visuales** (lleno, error de validación, enviando). El submit **NO** llama al backend: muestra el avance visual hacia el checkout (o un aviso "disponible próximamente" si se prefiere), sin crear cuenta. Dejar el punto de integración claramente marcado con un `TODO(v-next)` para encender en la siguiente versión.

### 4. Checkout (Wompi) — maqueta
- `CheckoutPage`: replicar visualmente el resumen de compra y el paso de pago del prototipo (`PlanSummary`, campos, estados). **NO** integrar el widget Wompi ni `VITE_WOMPI_PUBLIC_KEY` en v2. El botón de pago muestra el estado visual (procesando/éxito maquetado) sin transacción real. Marcar el cableado real con `TODO(v-next)`.

### 5. Bienvenida
- `WelcomePage`: pantalla de confirmación visual del prototipo. CTA presente, pero al no haber alta real, enlaza a login (o muestra el estado maquetado). El encadenado real con Onboarding se activa en la versión que encienda el alta.

### 6. Soporte
- `site-support.jsx`: páginas de ayuda/contacto/estado, con la voz y el layout del prototipo (contenido estático).

### 7. Calculadora — solo visual
- `CalculatorPage`: la calculadora puede operar con la **fórmula de precios en el front** como ilustración (plan + nº especialistas + cupos, según ADR-009), o mostrar valores fijos del prototipo. Al ser maqueta, **no** requiere endpoint de cálculo del backend; dejar `TODO(v-next)` para conectarla a la lógica real cuando se encienda el alta.

### 8. Seguridad
- Solo claves públicas `VITE_*` (ninguna de Wompi en v2). Nada de secretos en cliente (RNF-012).

## Backend: huecos a cubrir
- **Ninguno en v2** (fase solo visual). Para la versión futura quedan anotados (en `_HUECOS-BACKEND.md`, sección "diferidos"): alta self-service (`POST /negocios` + suscripción pendiente), endpoint de cálculo de precio, creación de transacción + webhook Wompi y consulta de estado.

## ⚠️ ACCIÓN DEL USUARIO
- Confirmar contenidos de marketing (textos/planes) o aprobar los del prototipo. (No se requieren claves Wompi en v2.)

## Verificación / Done
- Sitio público navegable y **fiel al prototipo** (landing, precios, comparativa, calculadora, alta, checkout, bienvenida, soporte), con la voz del DS.
- Signup y checkout se ven y navegan completos, con sus estados visuales, **sin** crear cuentas ni cobrar.
- Cada punto de integración real está marcado con `TODO(v-next)`.
- Cero claves/secretos de Wompi en el front; cero llamadas de pago.

## Trazabilidad
- RNF-005 (fiel al prototipo), ADR-009 (modelo de cobro, reflejado en precios/calculadora), RNF-012 (sin secretos). La funcionalidad de alta/Wompi (RF-001..RF-004) se difiere explícitamente a una versión posterior.
