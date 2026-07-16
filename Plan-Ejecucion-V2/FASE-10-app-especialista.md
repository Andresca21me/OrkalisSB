# FASE-10 · App del Especialista (móvil-first)

## Objetivo
Construir la **App del Especialista** tal como el prototipo: experiencia móvil-first ("modo conductor") con **Mi día**, **Agenda** (día/semana), **Detalle de turno**, **Cobro**, **Walk-in**, **Ganancias** y **Perfil**. Conectada al agendamiento y al motor financiero, con el flujo de turno en vivo y guard de pago. **Se entrega como web responsive para todos los dispositivos** (decisión FASE-00 #2): móvil-first, pero adaptándose con gracia a tablet y escritorio (no app nativa).

## Prerrequisitos
- FASE-01, FASE-02 (contenedor móvil + tab bar + safe-area).
- FASE-05 (modales/acciones de cita reutilizables).
- Decisión FASE-00 #2: **web responsive para móvil/tablet/escritorio** dentro de `apps/web` (no nativa, no PWA-only).

## Fuente visual (prototipo)
- `spec-app.jsx` (`SpecApp`, `buildTurnos`, frame/tab bar).
- `spec-screens-a.jsx` (`ScreenLogin`, `ScreenMiDia`, `CurrentTurnoHero`, `DayStat`).
- `spec-screens-b.jsx` (`ScreenAgenda`, `DayTimeline`, `WeekView`, `TimelineSkeleton`, `ScreenDetalleTurno`).
- `spec-screens-c.jsx` (`ScreenCobro`).
- `spec-screens-d.jsx` (`ScreenWalkin`).
- `spec-screens-e.jsx` (`ScreenGanancias`, `ScreenPerfil`).
- `spec-ui.jsx`, `specialist-data.js` (referencia).

## Pasos de Claude

### 1. Shell de la spec app (responsive)
- `pages/spec/SpecApp.tsx`: en **móvil**, tab bar inferior (Mi día / Agenda / Ganancias / Perfil) + safe-area; en **tablet/escritorio**, la navegación se promueve a barra lateral/superior y el contenido aprovecha el ancho (timeline más amplia, columnas). Mismo código, layout adaptativo por breakpoints. Toggle de **disponibilidad** y **sucursal activa** en cabecera (como el prototipo).

### 2. Mi día
- `ScreenMiDia`: turno actual destacado (`CurrentTurnoHero`), próximos turnos del día, y `DayStat` (nº turnos, completados, ganancia del día si partición ON). Datos: `GET /citas?especialistaId=me&fecha=hoy`.

### 3. Agenda (día/semana)
- `ScreenAgenda`: `DayTimeline` (línea de tiempo por hora) y `WeekView` (vista semanal). Skeleton de carga (`TimelineSkeleton`). `GET /citas` con rango día/semana del especialista.

### 4. Detalle de turno y flujo en vivo
- `ScreenDetalleTurno`: datos del turno (cliente, servicios, hora, estado). Acciones de la máquina de estados: **iniciar** (`POST /citas/:id/iniciar`) → **en progreso** → **completar** (abre Cobro) / **cancelar** / **no asistió**.

### 5. Cobro
- `ScreenCobro`: registrar **servicios reales** prestados + **método de pago** (`MetodoPago`) y completar (`POST /citas/:id/completar`) — **guard de pago** (ADR-006). Al éxito, toast "Ganancias calculadas" y vuelve a Mi día.

### 6. Walk-in
- `ScreenWalkin`: crear turno sin reserva. **En vivo** → entra "En progreso" (`POST /citas/walk-in`); **retroactivo** → directo a "Completada" con cobro (`POST /citas/walk-in/retroactivo`).

### 7. Ganancias
- `ScreenGanancias`: resumen hoy/semana/mes (ingresos, comisiones, neto). **Oculto si la partición está OFF.** Datos del endpoint de ganancias por especialista (ver hueco backend).

### 8. Perfil
- `ScreenPerfil`: datos del especialista, disponibilidad, cerrar sesión. `GET /auth/me` + ajustes de disponibilidad.

### 9. Datos
- Hooks `useMisTurnos`, `useMisGanancias`. Móvil con safe-area y gestos simples; sin sidebar.

## Backend: huecos a cubrir
- **Ganancias por especialista** (hoy/semana/mes): si no existe, añadir `GET /reportes/especialista?periodo` (o derivar de liquidaciones) — **reusar el del LiquidationPanel** de FASE-07.
- `GET /citas` con filtro **`especialistaId=me`** y rango día/semana; ampliar si falta.
- Toggle de **disponibilidad del especialista**: confirmar endpoint (`disponibilidad`) o añadirlo.

## ⚠️ ACCIÓN DEL USUARIO
- Ninguna decisión pendiente (entrega web responsive ya acordada). El login de especialista de prueba lo provee el seed de FASE-00.

## Verificación / Done
- Mi día, Agenda día/semana, Detalle, Cobro, Walk-in, Ganancias y Perfil fieles al prototipo.
- Flujo de turno en vivo ejecuta transiciones reales con guard de pago al completar.
- Walk-in en vivo y retroactivo crean turnos en el estado correcto.
- Ganancias se oculta con partición OFF; cifras en COP/es-CO.
- **Responsive verificado en móvil, tablet y escritorio**: safe-area en móvil, navegación promovida y mejor uso del ancho en pantallas grandes; todos los estados (datos/cargando/vacío/error).

## Trazabilidad
- RF-025..RF-035 (turnos, estados, walk-in), ADR-005 (máquina de estados), ADR-006 (cobro/guard de pago/partición), RNF-003 (móvil/safe-area), RNF-005.
