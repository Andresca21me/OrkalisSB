# FASE-10 · Operador · cortesía (beneficios sin cobro) y gestión

## Objetivo
Dar al **operador de plataforma** la capacidad de asignar a una cuenta los **beneficios de un plan sin generar cobro** (cuentas de cortesía para que el desarrollador/equipo pruebe), además de gestionar su método de pago y suscripción.

## Prerrequisitos
- FASE-00 (estado `cortesia`), FASE-08 (límites por plan).

## Pasos

### 🤖 Backend
1. **`POST /plataforma/negocios/:id/cortesia`** (solo operador): `{ plan, numEspecialistas }` → transición `dar_cortesia`: estado `cortesia`, fija plan/numEspecialistas, **sin** crear cobro y **excluida** del cron (FASE-06).
2. **`POST /plataforma/negocios/:id/cortesia/quitar`**: transición `quitar_cortesia` → `suspendida` (o re-evaluar prueba/activa si tuviera método). 
3. **`GET /plataforma/negocios/:id`** (detalle) ya existe: agregar el estado `cortesia`, el método de pago (últimos 4) y el `proximo_cobro`.
4. Reutilizar `suspender`/`reactivar`/`generarCobro` existentes; asegurar que respetan la máquina de estados (FASE-00).

### 🤖 Frontend (consola del operador)
5. En `PlataformaApp` (tabla + detalle): agregar acción **"Dar cortesía"** (elige plan + nº especialistas) y **"Quitar cortesía"**; mostrar el badge `Cortesía` y, en el detalle, el método de pago y próximo cobro.

## ✅ Verificación
- E2E: el operador da **cortesía Pro** a un tenant → el tenant entra con acceso **Pro** (inventario, etc.), **sin** cobro generado y **excluido** del cron.
- E2E: quitar cortesía → la cuenta queda `suspendida` (o el estado que corresponda).
- Solo el operador puede usar estos endpoints (RBAC).

## Trazabilidad
- Regla de negocio #6 (cortesía para pruebas). HU-PLT-001/002. ADR-P6.
