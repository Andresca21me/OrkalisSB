# FASE-01 · Autenticación, sesión y RBAC

## Objetivo
Probar exhaustivamente el control de acceso desde el frontend: login de los cinco roles, credenciales inválidas, persistencia y expiración de sesión (refresh), logout, y **guardas de ruta** (un rol no entra al panel de otro). Incluye los estados de **cuenta suspendida** y el redireccionamiento por rol. Es la base que protege todo lo demás.

## Prerrequisitos
- FASE-00 (fixtures de login). Seed + API arriba.

## Pantallas / rutas bajo prueba
- `LoginPage` (`/login`) — `apps/web/src/pages/LoginPage.tsx`.
- Guardas en `apps/web/src/App.tsx` (`Protegido`, `Inicio`, `cuentaSuspendida`).
- Aterrizajes: `/admin`, `/especialista`, `/recepcion`, `/plataforma`.

## Casos de prueba
1. **Login por rol → panel correcto** (parametrizado por los 5 roles):
   - Dado un email/clave válidos del rol, Cuando entro, Entonces aterrizo en su ruta (`/admin`, `/especialista`, …) y veo un elemento característico (admin: nav "Agenda"; operador: heading "Negocios"; etc.).
2. **Credenciales inválidas**: clave incorrecta → mensaje de error del DS, sigo en `/login`, sin token en `localStorage`.
3. **Campos requeridos**: enviar vacío no navega; el botón/inputs reflejan validación.
4. **Persistencia de sesión**: tras login, recargar la página mantiene la sesión (no vuelve a `/login`).
5. **Refresh transparente (401→refresh)**: con el access token caducado/manipulado en `localStorage`, una acción que llama a la API **no** expulsa al usuario (se renueva con el refresh) — observable porque la vista sigue cargando datos. Si no se puede forzar caducidad realista, interceptar un 401 único y verificar reintento.
6. **Logout**: desde el menú de perfil, "Cerrar sesión" limpia tokens y lleva a `/login`; volver atrás no recupera el panel.
7. **Guarda de ruta por rol (RBAC)**: logueado como especialista, navegar a `/admin` → redirige (no muestra admin). Igual para cada combinación rol↔ruta ajena.
8. **Sin sesión → rutas protegidas**: visitar `/admin` sin login redirige a `/login`; visitar `/` sin sesión muestra el **sitio público**, no el panel.
9. **Redirección de `/login` con sesión activa**: ya logueado, ir a `/login` redirige al panel del rol.
10. **Cuenta suspendida**: con un tenant suspendido (sembrar vía operador o API), su usuario al iniciar sesión ve el **aviso de cuenta suspendida** y **no** accede al panel (`cuentaSuspendida`). *(El efecto cruzado completo se prueba en FASE-13; aquí se valida la vista de login bloqueada.)*
11. **Estados de la pantalla de login**: botón en estado cargando durante el submit; el toggle de ver/ocultar contraseña funciona; foco visible en los campos.

## Datos de prueba
- Usuarios del seed (todos los roles). Para el caso 10, suspender la **Barbería** vía `POST /api/plataforma/negocios/:id/suspender` en `beforeAll` y **reactivar** en `afterAll` (o re-sembrar) para no afectar otras fases.

## Huecos de testabilidad
- Mensaje de error de login: asegurar que sea localizable por texto/rol (`getByText(/incorrect/i)`).
- Aviso de "cuenta suspendida": si no tiene texto/rol estable, añadir `data-testid="cuenta-suspendida"`.

## Verificación / Done
- Los 5 roles entran a su panel; ninguno entra al ajeno.
- Sesión persiste al recargar; refresh transparente no expulsa; logout limpia.
- Cuenta suspendida bloquea el acceso desde login.
- Suite `specs/01-auth/*` verde y estable; tenant restaurado tras la fase.

## Trazabilidad
- ADR-003 (RBAC, OTP), HU-PLT-002 (parcial, login suspendida), RNF de seguridad de sesión. Generaliza el `auth.spec.ts` de la v2.
