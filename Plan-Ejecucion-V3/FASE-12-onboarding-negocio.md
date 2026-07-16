# FASE-12 · Onboarding del negocio

## Objetivo
Probar el flujo de **alta y onboarding** del negocio por la UI: elegir vertical (salón/barbería), activar módulos y restricciones por defecto, dar de alta el equipo inicial, y finalizar aterrizando en el panel admin con los **defaults del perfil** (terminología, categorías, módulos). Verificar el flujo completo paso a paso y sus validaciones.

## Prerrequisitos
- FASE-00, FASE-01. ⚠️ El onboarding **crea** un negocio: usar datos únicos y, si deja residuo, limpiar/re-sembrar. Confirmar con `_DATOS-Y-CREDENCIALES` cómo se dispara (ruta `/onboarding/*`, requiere admin sin negocio o un nuevo registro).

## Pantallas / rutas bajo prueba
- `OnboardingApp` (`/onboarding/*`) — `apps/web/src/pages/onboarding/OnboardingApp.tsx`.

## Casos de prueba

### Flujo feliz (HU-ADM-001 esc. 1)
1. **Paso vertical**: elegir "Barbería" → el asistente avanza y precarga defaults del perfil.
2. **Paso módulos**: activar/desactivar módulos por defecto; la selección se conserva al avanzar/retroceder.
3. **Paso restricciones**: configurar las restricciones iniciales (horarios/reglas básicas).
4. **Paso equipo**: dar de alta al menos un especialista inicial.
5. **Paso listo / finalizar**: completar → aterriza en `/admin` con el negocio creado, la **terminología de barbería** y los módulos elegidos activos.
6. **Perfil salón**: repetir eligiendo "Salón" → defaults/terminología propios del salón.

### Navegación y validación del asistente
7. **Atrás/adelante conserva estado**: retroceder y avanzar no pierde lo seleccionado.
8. **Validación por paso**: no se puede avanzar sin completar lo requerido (p. ej. vertical sin elegir, equipo vacío si es obligatorio).
9. **Estados**: indicadores de carga al guardar cada paso; error de guardado → mensaje del DS, no stack trace.

### Reflejo posterior
10. **Defaults aplicados en admin**: tras el onboarding, las categorías/terminología y los módulos activos coinciden con lo elegido (verificable en Gestión/Config).

## Datos de prueba
- Negocio con nombre/usuario únicos. Coordinar con `_DATOS-Y-CREDENCIALES §7` para limpieza/re-siembra si el onboarding deja un tenant extra.

## Huecos de testabilidad
- Pasos del asistente: `data-testid="onb-paso-{n}"`, opciones de vertical `onb-vertical-{barberia|salon}`, toggles de módulo `onb-modulo-{clave}`, navegación `onb-siguiente|onb-atras|onb-finalizar`.

## Verificación / Done
- El onboarding completo crea el negocio y aterriza en admin con los defaults del perfil.
- Navegación y validaciones del asistente cubiertas; ambos perfiles probados.
- `specs/12-onboarding/*` verde; residuo limpiado/re-sembrado.

## Trazabilidad
- HU-ADM-001 (alta y onboarding por perfil). Jerarquía negocio→sucursal (semilla).
