# FASE-01 · Design System y librería de componentes

## Objetivo
Construir en `apps/web/src/ui/` la **librería de componentes primitivos** de Orkalis, fiel al design system del prototipo, para que **todas** las pantallas de las fases siguientes se monten con ellos (cero estilos inventados ad-hoc). Al terminar, existe un set reutilizable, tipado y documentado de: tokens aplicados, `Icon` (Lucide), `Button`, `IconButton`, `Input`, `Select`, `Checkbox`, `Switch`, `Badge`, `Tag`, `Avatar`, `Card`, `KpiCard`, `Tabs`, `Alert`, `Tooltip`, `Dialog`/`Modal`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState`, y los gráficos base.

## Prerrequisitos
- FASE-00 cerrada (arquitectura de carpetas y librería de gráficas decididas).
- Tokens del DS ya copiados en `apps/web/src/styles` (verificar que coinciden con `_ds/.../tokens/*`; si difieren, **regenerar desde `_ds`**, que es la fuente de verdad).

## Fuente visual (prototipo)
- `_ds/orkalis-design-system-*/styles.css` y `tokens/*` (verdad de tokens).
- `_ds/orkalis-design-system-*/readme.md` (reglas: color, tipografía, radios, sombras, motion, focus, iconografía).
- `ork-ui.jsx`, `admin-ui.jsx`, `spec-ui.jsx`, `site-ui.jsx`, `screens-common.jsx`, `tokens.css` (implementaciones de referencia de Button, Card, Badge, Toast, Skeleton, EmptyState, ErrorState, Icon, etc. tal como el prototipo las usa).

## Pasos de Claude

### 1. Tokens y fundamentos
- Verificar/regenerar `apps/web/src/styles/{colors,typography,spacing,radius-elevation,fonts}.css` desde `_ds`. Cargar **Plus Jakarta Sans / DM Sans / JetBrains Mono** (fonts.css del DS).
- `styles/base.css`: defaults de elementos del DS (reset, color de texto, foco visible 2px `#1A73E8` con 2px offset — **nunca** remover focus).
- Confirmar variables clave usadas por el prototipo: `--brand`, `--brand-hover`, `--brand-pressed`, `--surface-page/card/sunken`, `--border-subtle`, `--text-primary/secondary/tertiary/disabled`, `--radius-sm/md/lg`, `--dur-fast`, `--ease-out`, `--space-*`. La UI de las fases las consume; deben existir y mapear a los tokens del DS.

### 2. Icono (Lucide)
- `ui/Icon.tsx`: wrapper sobre `lucide-react` (instalar el paquete; el prototipo lo carga por CDN, en producción se instala). Props: `name`, `size` (16 inline/tabla, 20 nav/botón, 24 header), `color` (default `currentColor`). Stroke 2px fijo, escalar la caja, no el trazo.
- Reusar el mapa de nombres ya existente en `ui/icons.ts` si sirve; si no, mapear directo a Lucide.

### 3. Primitivos (uno por archivo o agrupados en `ui/ui.tsx`, según ya exista)
Replicar **apariencia y variantes** del prototipo:
- **Button**: variantes `primary | secondary | ghost | danger`, tamaños `sm | md | lg`, `fullWidth`, `iconLeft/iconRight`, estado `loading` y `disabled`. Hover azul más claro, press más oscuro, sin scale.
- **IconButton**: cuadrado, mismas variantes.
- **Input / TextField**, **Select**, **Checkbox**, **Switch**: con label, error, helper; radios 4px; foco visible.
- **Badge** (estado) y **Tag/Chip** (pill): colores semánticos (success/warning/error/info) y `tint`.
- **Avatar**: iniciales + color por nombre (como el prototipo).
- **Card**: 1px borde `#E2E8F0`, `shadow-sm` reposo → `shadow-md` hover, radios 8/12px. Variantes light/dark (navy).
- **KpiCard**: número en Plus Jakarta + delta con flecha ↑/↓ (teal positivo, rojo negativo) y label.
- **Tabs**: pestañas del admin/spec (subrayado activo, transición rápida).
- **Alert**: banner semántico (usado en agenda/cuenta).
- **Tooltip**: hover, sombra `lg`.
- **Dialog / Modal**: overlay, sombra `lg`, foco atrapado, cierre con Esc, scroll interno; base de todos los modales (cliente, servicio, producto, etc.).
- **Toast**: cola con auto-dismiss ~2,6s, tonos success/info/warning/error (como `fireToast` del prototipo), sombra `xl`.
- **Skeleton**: shimmer gray-100→gray-200; helpers `Skeleton w/h/r`.
- **EmptyState** y **ErrorState**: icono Lucide + título + body + acción, con el copy/estilo de `screens-common.jsx` (voz del DS: "Aún no tienes…", reintento).

### 4. Gráficos base
- Crear wrappers sobre la librería elegida en FASE-00 (recharts por defecto): `LineChartMini`, `BarChart`, `Donut`/`Sparkline`, con la paleta del DS (azul marca, teal solo para +datos, slate neutros). Se reusan en Panel y Finanzas.

### 5. Localización y formato
- Confirmar `lib/format.ts`: dinero **COP** (`Intl.NumberFormat('es-CO', { currency: 'COP' })`), fechas/horas `es-CO`, porcentajes, números tabulares con `tnum`. Helper de etiqueta de fecha tipo "Hoy · lunes 9 de junio" (como `dateLabelFromKey` del prototipo).

### 6. Catálogo de verificación (Storybook ligero o página `/_ui`)
- Montar una ruta interna de desarrollo que renderice **todos** los primitivos en sus variantes/estados, para comparar 1:1 contra los cards del `_ds` y las pantallas del prototipo. No se despliega a prod.

## Backend: huecos a cubrir
Ninguno (fase puramente de UI/tokens).

## ⚠️ ACCIÓN DEL USUARIO
Ninguna obligatoria. Opcional: revisar el catálogo `/_ui` y confirmar que los componentes "se ven como el prototipo" antes de seguir.

## Verificación / Done
- Cada primitivo existe, está tipado y se ve **idéntico** a su equivalente en el prototipo/`_ds` (color, radio, sombra, tipografía, foco, hover/press).
- Lucide es el único set de iconos; no quedan emojis ni glyphs (salvo flechas ↑/↓ de deltas).
- `/_ui` muestra todos los componentes en todos sus estados (incl. cargando/vacío/error).
- Fuentes Plus Jakarta / DM Sans / JetBrains Mono cargan; números de datos usan mono + `tnum`.
- `pnpm --filter web build` pasa sin errores de tipos.

## Trazabilidad
- RNF-005 (DS = fuente visual), Definición §6, DS readme (color/tipografía/radios/sombras/motion/focus/iconografía), RNF-004 (formato es-CO/COP).
