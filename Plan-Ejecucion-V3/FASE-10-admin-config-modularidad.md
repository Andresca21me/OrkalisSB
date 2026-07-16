# FASE-10 · Admin · configuración y modularidad

## Objetivo
Probar la **configurabilidad como módulo de primera clase**: activar/desactivar módulos (inventario, partición por especialista, cierre de período) a nivel de negocio o sucursal y verificar que **la UI reacciona en consecuencia en toda la app**; los parámetros financieros con **herencia** negocio→sucursal y su validación (repartición = 100%); gestión de **usuarios internos**; **agenda/notificaciones**; y el **perfil del negocio** (cambio de vertical conservando datos). Es la fase con más efectos cruzados de configuración.

## Prerrequisitos
- FASE-00, FASE-01. Idealmente FASE-08/09 (para observar cómo módulos off ocultan inventario/cierre/liquidación). ⚠️ Destructiva (cambia config): re-sembrar al final.

## Pantallas / rutas bajo prueba
- `ConfigScreen` y `config-*` (`apps/web/src/pages/admin/`): módulos, agenda, notificaciones, sucursales, usuarios, financieros, suscripción, perfil/developer. Config vive en el menú de perfil (no en el nav).

## Casos de prueba

### Módulos (HU-ADM-003)
1. **Desactivar inventario (negocio)**: apagar el módulo → la sección Inventario desaparece de Gestión y Finanzas deja de exigir productos (verificable en FASE-08/09 al recargar).
2. **Reactivar inventario**: vuelve a aparecer con sus datos.
3. **Desactivar partición por especialista**: el módulo de **liquidación** deja de estar disponible y el resumen de **ganancias** del especialista lo indica (cruzado con FASE-04/09).
4. **Cierre de período por sucursal**: desactivar "Cierre de período" solo en *Sede Norte* → *Norte* opera sin cierre; las demás sedes conservan el comportamiento del negocio (config por sucursal distinta a la del negocio).

### Parámetros financieros y herencia (HU-ADM-004)
5. **Sucursal hereda del negocio**: una sucursal sin override usa la repartición del negocio (p. ej. 60/40).
6. **Override por sucursal**: definir parámetros propios en una sede y verificar que aplica solo a esa sede.
7. **Validación 100%**: ingresar 70% profesional + 40% salón → el sistema rechaza el guardado e indica que debe sumar 100%.
8. **Herencia desde otra sucursal**: si la UI permite heredar de otra sede, verificarlo.

### Usuarios internos (RBAC desde config)
9. **Crear usuario por rol**: dar de alta un recepcionista/especialista con login → puede iniciar sesión (verificable haciendo login con el nuevo usuario).
10. **Editar/desactivar usuario**: desactivar un usuario le impide iniciar sesión.

### Agenda / notificaciones / cupos
11. **Config de agenda**: cambiar parámetros (p. ej. aprobación manual) → una reserva nueva entra como "Solicitada" en vez de "Confirmada" (cruzado con FASE-02/03).
12. **Cupos de mensajería**: la pantalla muestra el consumo vs el cupo del plan; estados coherentes.

### Perfil del negocio (HU-ADM-001 esc. 2)
13. **Cambio de vertical**: cambiar de "Salón" a "Barbería" → ajusta terminología/defaults **pero conserva** los datos operativos ya cargados.

### Suscripción (vista admin)
14. **Resumen de suscripción**: plan, nº especialistas, cargo y cupos; estado de error manejado (regresión del fix v2-FASE-14).

## Datos de prueba
- Barbería (multi-sede para la config por sucursal). Usuario nuevo con email único para el caso 9/10.
- Re-sembrar al final: esta fase cambia módulos/config que otras fases asumen activos.

## Huecos de testabilidad
- Toggles de módulo: `data-testid="modulo-{clave}-toggle"` (inventario, particion, cierre).
- Financieros: `data-testid="repart-profesional"`, `repart-salon`, error `repart-error`.
- Usuarios: `data-testid="usuario-nuevo|rol|activo"`.
- Perfil: `data-testid="negocio-perfil"`.

## Verificación / Done
- Activar/desactivar módulos cambia la UI en toda la app (inventario, partición/liquidación, cierre), incluso a nivel de sucursal.
- Herencia y validación financiera (100%) cubiertas.
- Alta/baja de usuarios afecta el login real.
- Cambio de vertical conserva datos.
- `specs/10-config/*` verde; entorno re-sembrado.

## Trazabilidad
- HU-ADM-001 (esc. 2), 002, 003, 004; RBAC; flujos cruzados config→toda la app (`_MATRIZ §2`).
