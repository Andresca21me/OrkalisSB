# FASE-13 · Frontend (integración de la demo de Claude Design)

## Objetivo
Montar la aplicación web React en `apps/web` **integrando la demo de interfaz que entregará el USUARIO (Claude Design)** como base visual (fuente de verdad del diseño, RNF-005), y conectarla a la API por los cuatro frentes: **panel admin**, **app del especialista**, **enlace público de reservas** y **vista de recepción**. Responsive, móvil-first donde aplica, español/COP/`es-CO`.

## Prerrequisitos
- La **demo de Claude Design** entregada por el USUARIO (ver acción del usuario).
- Endpoints de FASE-05 a FASE-12 disponibles (al menos auth + agendamiento para el flujo principal).
- `@orkalis/shared` (enums/DTOs) de FASE-01.

---

## ⚠️ ACCIÓN DEL USUARIO (PRIMERO, antes de que Claude escriba)
1. **Entregar la demo de Claude Design**: copiar sus archivos dentro de `apps/web/` (o indicar a Claude dónde está la carpeta de la demo para moverla). Decir qué framework/herramienta usa (Vite + React es lo esperado; si es otra cosa, avisar).
2. Indicar el **design system**: paleta, tipografías, componentes, tokens. Si la demo ya los trae, basta con señalarlo.
3. Confirmar si la demo cubre todas las pantallas o solo algunas (para saber qué hay que construir sobre su estilo).

> Claude **no** debe inventar un diseño propio ni pisar el de la demo. Debe **partir de la demo** y extender con sus mismos componentes/estilo. Si la demo no existe aún, **detenerse** y pedirla antes de construir UI.

---

## Pasos de Claude

### 1. Integrar la demo y configurar el workspace web
- Asegurar que `apps/web` use **Vite + React + TypeScript** (o lo que traiga la demo) y consuma `@orkalis/shared` (tipos/DTOs/enums compartidos — ADR-008).
- Configurar variables de entorno del front (`VITE_API_URL`) y un cliente HTTP central (fetch/axios) que adjunte el **access token** y maneje **refresh** (FASE-05).
- Configurar **localización**: español, moneda **COP**, formato **`es-CO`** (números, fechas, dinero) en un util central (RNF-004).

### 2. Auth y enrutamiento por rol
- Pantallas de **login** (usuarios internos); guardar tokens de forma segura; refresco automático.
- Enrutamiento que muestra el panel según rol (admin / especialista / recepcionista / operador de plataforma).
- Manejo del estado **cuenta suspendida** (aviso, sin acceso) — FASE-05/12.

### 3. Panel de administración (escritorio/tablet)
- Onboarding del negocio (perfil salón/barbería), gestión de **sucursales** (CRUD, activar/desactivar, selector sucursal vs. consolidado).
- **Configuración**: módulos on/off y parámetros financieros, mostrando **procedencia** (heredado/sobrescrito) y opción de clonar de otra sucursal (FASE-06, RF-010).
- Equipo (especialistas + asignación a sucursales), catálogo de **servicios** (con repartición), **inventario** (si módulo ON), **gastos**, **liquidaciones**, **reportes** con gráficos y **exportar CSV/PDF**.

### 4. App del especialista (móvil-first, estilo "conductor")
- Agenda del **día/semana** ordenada por hora.
- **Flujo de turno en vivo**: iniciar → en progreso → completar (modal de cobro: servicios reales + método de pago, guard de pago) / cancelar / no asistió.
- **Resumen de ganancias** (hoy/semana/mes), oculto si partición OFF.
- Toggle de disponibilidad y sucursal activa.
- **Safe-area** para dispositivos con notch (RNF-003).

### 5. Enlace público de reservas (sin login, móvil/escritorio)
- Flujo de la secuencia (FASE-08): elegir **sucursal** (si negocio multi-sede) → especialista → servicio → ver **franjas libres en tiempo real** → seleccionar franja → ingresar teléfono → **OTP** → confirmación inmediata.
- Manejo del caso **"franja ya tomada"** con alternativas (sin doble reserva, RF-020).
- Cancelar/reagendar desde el enlace según reglas de antelación (RF-022).
- Sin cuenta, sin instalar nada.

### 6. Vista de recepción (tablet/escritorio)
- Agenda del día de la sucursal por especialista; crear/editar/reasignar citas; registrar **walk-ins** y cobro al final; **exportar resumen diario** (PDF).

### 7. Responsive y navegadores
- Responsive en todos los paneles; app del especialista y enlace público **optimizados para móvil** (RNF-003).
- Funciona en Chrome, Safari, Edge, Firefox recientes, escritorio y móvil (RNF-018).

---

## Verificación / Done
- La UI **respeta la demo de Claude Design** (mismos componentes/estilo), no un diseño inventado.
- Login funciona; cada rol ve su panel; cuenta suspendida muestra aviso.
- Flujo público completo end-to-end contra la API: disponibilidad → retención → OTP → confirmación; caso de concurrencia muestra alternativas.
- App del especialista ejecuta el flujo de turno con guard de pago.
- Todo en español, COP y `es-CO`; responsive y con safe-area en móvil.

## Trazabilidad
- RNF-003, RNF-004, RNF-005, RNF-018. RF-015 a RF-032 (cara visual), RF-008..012 (UI de config), RF-042..045 (reportes/export). Definición §6 (Claude Design = fuente de verdad visual), ADR-008 (tipos compartidos).
