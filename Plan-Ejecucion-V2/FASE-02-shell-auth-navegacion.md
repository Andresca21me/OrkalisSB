# FASE-02 · Shell, autenticación y navegación por rol

## Objetivo
Montar el **esqueleto de navegación** de la aplicación tal como el prototipo: **Login** (con estados de cuenta suspendida/bloqueada), enrutamiento que lleva a cada rol a su panel, el **Shell** de escritorio (sidebar navy de 240px + topbar con selector de sucursal/consolidado) para admin/recepción, y el contenedor móvil (con safe-area y tab bar inferior) para especialista y reserva pública. Al terminar, un usuario inicia sesión, ve el chrome correcto de su rol y puede navegar entre secciones vacías (las pantallas se llenan en fases posteriores).

## Prerrequisitos
- FASE-01 cerrada (primitivos disponibles).
- `lib/api.ts` + `lib/auth.tsx` de v1 (refresh JWT) conservados y funcionando.

## Fuente visual (prototipo)
- `login-app.jsx` (login, `SuspendedNotice`, `LockedNotice`, logo claro/oscuro, `LoginField`, `Spinner`).
- `admin-app.jsx` + `admin-ui.jsx` (sidebar navy, topbar, selector de sucursal vs. consolidado, tabs Panel/Agenda/Clientes/Gestión/Finanzas, navegación con deep-link a Gestión).
- `spec-app.jsx` + `spec-ui.jsx` (frame móvil, tab bar inferior del especialista).
- `screens-common.jsx` (`AppHeader`, `FooterBar`, safe-area).

## Pasos de Claude

### 1. Login y estados de cuenta
- `pages/LoginPage.tsx` (reescribir el actual): formulario `correo + contraseña` con el layout del prototipo (logo, campos `LoginField`, botón primario, spinner en envío). Llama `POST /auth/login`, guarda tokens, redirige según rol.
- Estados especiales (de `login-app.jsx`): **cuenta suspendida** (`SuspendedNotice` — aviso, sin acceso, CTA a soporte/pago) y **cuenta bloqueada** (`LockedNotice` — credenciales/intentos). El backend ya distingue `EstadoSuscripcion`; mapear el error/claim a la vista correcta.
- Manejo de error de credenciales inline (no toast genérico).

### 2. Routing por rol
- Mantener el patrón de `App.tsx`: rutas `/reservar/:sucursalId` (público), `/login`, `/admin/*`, `/especialista/*`, `/recepcion/*`, `/plataforma/*`, y (si FASE-12 entra) rutas públicas del sitio.
- `Protegido` por rol con `useAuth`; `Inicio` redirige según `usuario.rol` (Admin→/admin, Especialista→/especialista, Recepcionista→/recepcion, OperadorPlataforma→/plataforma).
- Si la cuenta del negocio está **suspendida**, interceptar y mostrar el aviso bloqueante en vez del panel (RF de suspensión / FASE-12 v1).

### 3. Shell de escritorio (admin / recepción)
- `ui/Shell.tsx` (reescribir): **sidebar navy `#0F1923` de 240px** con el logo Orkalis (mark monocromo), navegación activa en azul marca, y **contenido fluido 12-col, max 1280px**. Densidad Linear/Retool.
- **Topbar**: nombre del negocio, **selector de sucursal** con opción **"Consolidado"** (todas las sucursales) vs. una sucursal concreta — replicando `onPick`/`onConsolidated` del prototipo; el estado de sucursal/consolidado vive en contexto y lo consumen todas las pantallas admin. Avatar/menú de usuario con logout.
- Tabs/secciones del admin: Panel, Agenda, Clientes, Gestión (con sub-pestañas: Equipo/Servicios/Inventario), Finanzas, Configuración. Soportar **deep-link** a sub-pestaña (como `navTo(tab, sub)`).

### 4. Contenedor móvil (especialista / reserva pública)
- Layout móvil-first con **safe-area-inset** (notch, RNF-003): header (`AppHeader`) y, para la spec app, **tab bar inferior** (Mi día / Agenda / Ganancias / Perfil) como en `spec-ui.jsx`.
- La reserva pública usa header + footer con CTA fijo (`FooterBar`), sin tab bar.

### 5. Contexto de sesión y negocio
- Extender `lib/auth.tsx` para exponer: `usuario` (rol, nombre), `negocio` (perfil salón/barbería, módulos activos), `sucursalActiva | consolidado`. Cargar `GET /auth/me` + `GET /negocios`/`/sucursales` al entrar. Estos valores condicionan qué tabs/módulos se muestran (p. ej. Inventario oculto si el módulo está OFF — ver config en FASE-09).

## Backend: huecos a cubrir
- Confirmar que `GET /auth/me` devuelve rol, negocio, perfil y **módulos activos** suficientes para decidir navegación; si falta el estado de suscripción para el gate de suspensión, exponerlo (coordinar con FASE-12). Si hay hueco, añadir campo al payload de `me` (sin migración si ya está en BD).

## ⚠️ ACCIÓN DEL USUARIO
- Proveer credenciales de prueba de cada rol (admin, especialista, recepcionista, operador) contra la API de desarrollo, o sembrarlas.

## Verificación / Done
- Login funciona contra `POST /auth/login`; refresh automático sigue operando.
- Cada rol aterriza en su panel; rol equivocado no accede a rutas de otro rol.
- Cuenta suspendida y cuenta bloqueada muestran sus avisos del prototipo, sin dejar entrar.
- Sidebar navy 240px + topbar con selector sucursal/consolidado se ven como el prototipo; la selección persiste y es legible por las pantallas.
- Móvil: spec app tiene tab bar inferior y safe-area; reserva pública tiene footer CTA fijo.
- Navegación entre secciones (aún vacías) funciona, incl. deep-link a sub-pestañas de Gestión.

## Trazabilidad
- ADR-003 (auth/RBAC, OTP sin sesión para público), RNF-003 (safe-area móvil), RNF-005 (chrome fiel al prototipo), RF de suspensión (FASE-05/12 v1). DS readme (sidebar navy, focus).
