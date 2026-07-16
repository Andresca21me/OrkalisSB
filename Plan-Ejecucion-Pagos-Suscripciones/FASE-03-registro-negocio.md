# FASE-03 · Registro de un negocio nuevo (alta pública)

## Objetivo
Permitir que un negocio **se registre solo** desde el sitio: crea su tenant (`negocio` + `admin` + `suscripcion`) y elige plan, perfil y nº de especialistas. Convierte el **funnel maqueta** del sitio en un alta real. (La elección "prueba vs pagar" se cablea aquí y se completa en FASE-04/05.)

## Prerrequisitos
- FASE-00/01. (FASE-02 solo si el alta es "pagar ya".)

## Pasos

### 🤖 Backend
1. **Endpoint público** `POST /auth/registro` (`@Public()`): recibe `{ negocioNombre, perfil, plan, numEspecialistas, admin: { nombre, email, password }, modo: 'prueba' | 'pago' }`.
   - Validar: email **único global** (ya hay índice), password ≥ 8, plan válido, `numEspecialistas ≥ incluidos`.
   - En una transacción: crear `negocio` (perfil), `suscripcion` (plan, numEspecialistas, estado según `modo`), `sucursal` inicial, `usuario` admin (rol Admin), `usuarioSucursal`, y la **config de módulos por defecto del perfil**.
   - Si `modo='prueba'`: `estado='prueba'`, `trial_fin = now + 15 días`. Devuelve sesión (tokens) → entra directo.
   - Si `modo='pago'`: `estado='prueba'` temporal **pero** marca "pendiente de primer pago" y devuelve un `registroId`/sesión para ir al checkout (FASE-05). (No se le da acceso pleno hasta el pago — ver FASE-05.)
2. **Anti-abuso:** throttle estricto del endpoint público de registro (es público).

### 🤖 Frontend (sitio)
3. **`SignupPage`** (`site-pages.tsx`, hoy maqueta): formulario real (negocio, perfil, plan preseleccionado del funnel, nº especialistas, datos del admin) y **dos botones**:
   - **"Empezar prueba gratis (15 días)"** → `modo='prueba'` → registra → entra al panel.
   - **"Pagar y empezar ya"** → `modo='pago'` → registra → va a `/checkout` (FASE-05).
4. Tras el alta en modo prueba, redirigir a `/admin` (o al onboarding) ya logueado.

## ✅ Verificación
- E2E: registro en modo prueba crea el tenant y aterriza logueado; `estado='prueba'`, `trial_fin ≈ now+15d`.
- E2E: email duplicado → error claro; password corta → validación.
- Aislamiento: el nuevo tenant no ve datos de otros (RLS).

## Trazabilidad
- HU-ADM-001. `_MODELO §4` (transición registro). ADR-001 (tenant nuevo aislado).
