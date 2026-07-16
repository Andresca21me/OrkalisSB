# FASE-04 · Onboarding del negocio

## Objetivo
Reconstruir el **asistente de onboarding** del prototipo: el alta guiada por pasos donde un negocio elige su **vertical** (barbería/salón), activa **módulos**, fija **restricciones/parámetros** iniciales y carga su **equipo**, terminando en una pantalla de "listo". Conectado al backend de negocio/sucursal/equipo/config existente.

## Prerrequisitos
- FASE-01, FASE-02 cerradas.
- Útil tener FASE-09 (config) en mente: el onboarding fija valores de configuración que luego se editan en Configuración.

## Fuente visual (prototipo)
- `onboarding-app.jsx` (`OnboardingApp`, `Stepper`, `StepShell`, `ChoiceCard`, `TeamStep`, `DoneStep`).
- Capturas en `scraps/` (`*-onb-*.png`) como referencia de estados intermedios.

## Pasos de Claude

### 1. Orquestador por pasos
- `pages/onboarding/OnboardingApp.tsx`: stepper con los pasos del prototipo. Estado del asistente acumulado; barra de progreso (`Stepper`). Navegación atrás/adelante con validación por paso.

### 2. Paso · Vertical del negocio
- `ChoiceCard` para **barbería vs. salón** (y los que el prototipo muestre). Determina catálogos/copys por defecto. Persistir vía `PATCH /negocios/:id/perfil` (perfil salón/barbería — `PerfilNegocio` de `@orkalis/shared`).

### 3. Paso · Módulos
- Toggles de módulos activables (p. ej. inventario, partición/comisiones, cierre, notificaciones) con `Switch`. Estos escriben en **configuración** (`PUT /config/:nivel/:ambitoId/:clave`) a nivel negocio. Mostrar descripción de cada módulo (voz del DS).

### 4. Paso · Restricciones / parámetros iniciales
- Parámetros financieros y de agenda iniciales que el prototipo pida en onboarding (horarios, antelación, repartición por defecto, etc.). Escribir vía config (`PUT /config/...`, `PUT /config/reparticion/...`). Validaciones de dominio (porcentajes 0–100, repartición que sume 100%).

### 5. Paso · Equipo
- `TeamStep`: alta de especialistas iniciales (nombre, rol, asignación a sucursal). `POST /especialistas` y `PUT /especialistas/:id/sucursales`. Permitir añadir/quitar filas.

### 6. Paso · Listo
- `DoneStep`: resumen de lo configurado + CTA a entrar al panel admin. Marcar el negocio como onboarded (si el backend lo modela; si no, derivarlo de que existen sucursal + equipo + config base).

## Backend: huecos a cubrir
- Confirmar que existe el flujo de **creación de negocio + primera sucursal** (`POST /negocios`, `POST /sucursales`) usable desde onboarding. **En v2 el alta self-service del sitio está diferida (FASE-12 solo visual)**, así que el onboarding es un **flujo independiente** para negocios ya creados (por el operador de plataforma o por seed), no se encadena desde el sitio.
- Si falta un flag `onboarding_completado`, decidir si se añade (migración pequeña) o se infiere.

## ⚠️ ACCIÓN DEL USUARIO
- Ninguna. (Punto de entrada decidido: onboarding independiente; el alta desde el sitio queda para una versión futura.)

## Verificación / Done
- El asistente recorre todos los pasos del prototipo con su look fiel.
- Vertical, módulos, parámetros y equipo se **persisten de verdad** (negocio/perfil, config, sucursal, especialistas) y son coherentes con lo que luego muestra Configuración (FASE-09).
- Validaciones de dominio activas (repartición 100%, porcentajes 0–100).
- Al terminar, el admin entra a un panel ya configurado.

## Trazabilidad
- RF-001..RF-007 (alta de negocio, perfil, sucursales, equipo), RF-008..RF-012 (configurabilidad, módulos on/off, herencia), ADR-002 (config en cascada), ADR-009 (módulos/plan), RNF-005 (fiel al prototipo).
