# FASE-00 · Prerrequisitos y cuentas externas

## Objetivo
Dejar listo el entorno local de desarrollo y **todas las cuentas/credenciales externas** que las fases posteriores necesitarán, para que Claude nunca se quede bloqueado a mitad de camino esperando una clave.

## Prerrequisitos
Ninguno. Esta es la primera fase.

---

## ⚠️ ACCIÓN DEL USUARIO — Parte A: Instalar herramientas locales
El USUARIO (o Claude, si tiene permiso de instalar) debe tener en la máquina de desarrollo:

1. **Node.js LTS** (versión 20 o superior). Verificar: `node -v`.
2. **pnpm** (gestor de paquetes del monorepo): `npm install -g pnpm`. Verificar: `pnpm -v`.
3. **Docker** + **Docker Compose** (para Postgres local). Verificar: `docker -v` y `docker compose version`.
4. **Git**. Verificar: `git -v`.
5. Editor con soporte TypeScript (VS Code recomendado).

> Si alguno falta, Claude debe **pedirle al USUARIO** que lo instale antes de seguir. No continúes sin Node, pnpm y Docker.

---

## ⚠️ ACCIÓN DEL USUARIO — Parte B: Crear cuentas externas (modo prueba/sandbox)
No se necesita pagar nada todavía; todo arranca en modo prueba. El USUARIO debe crear estas cuentas y **guardar las claves en un lugar seguro** (gestor de contraseñas). Claude las pedirá en la fase correspondiente.

### B.1 Railway (hosting) — se usa en FASE-14
- Crear cuenta en **railway.app**.
- No hace falta crear el proyecto aún; solo tener la cuenta.

### B.2 Twilio (SMS para OTP y recordatorios) — se usa en FASE-11
- Crear cuenta de prueba en **twilio.com**.
- Obtener y guardar: **Account SID**, **Auth Token**, y un **número de teléfono Twilio** (trial).
- (Opcional, para email) Crear cuenta **SendGrid** y guardar su **API Key**.

### B.3 Wompi (pasarela de suscripción) — se usa en FASE-12
- Crear cuenta en **wompi.co** y entrar al **ambiente de pruebas (sandbox)**.
- Obtener y guardar las llaves de sandbox: **llave pública** (`pub_test_...`), **llave privada** (`prv_test_...`) y el **secreto de eventos/webhook** (`events secret`).

> **IMPORTANTE:** El USUARIO **no debe pegar las claves en el chat ni en el código**. Las pondrá él mismo en los archivos `.env` cuando la fase lo indique (Claude le dirá exactamente qué variable llenar). Claude trabaja con valores de marcador (placeholders) hasta entonces.

---

## Pasos de Claude
En esta fase Claude **no escribe código de la app todavía**. Solo:

1. Confirmar con el USUARIO que la Parte A (herramientas) está completa, ejecutando los comandos de verificación (`node -v`, `pnpm -v`, `docker -v`).
2. Crear el repositorio Git si no existe:
   - En la raíz del proyecto (`OrkalisSB/`), inicializar git: `git init`.
   - Crear `.gitignore` raíz con al menos: `node_modules/`, `dist/`, `.env`, `.env.*` (excepto `.env.example`), `coverage/`, `*.log`, `.DS_Store`, `.turbo/`, `build/`.
3. Crear un archivo `CREDENCIALES-PENDIENTES.md` en la raíz del proyecto que liste, en forma de checklist, qué claves faltan por entregar y en qué fase se usarán (Railway, Twilio SID/Token/Número, SendGrid, Wompi pub/prv/webhook). Este archivo es el recordatorio vivo de lo que el USUARIO debe entregar. **No contiene valores, solo el checklist.**
4. Anotar en `CREDENCIALES-PENDIENTES.md` que las claves se cargarán en `apps/api/.env` (backend) cuando llegue cada fase.

> No publiques `CREDENCIALES-PENDIENTES.md` con valores reales. Es solo una lista de "qué falta".

---

## Verificación / Done
- `node -v` ≥ 20, `pnpm -v` y `docker -v` responden correctamente.
- Existe `OrkalisSB/.gitignore` con las reglas de arriba y `.env` está ignorado.
- El USUARIO confirma que tiene creadas las cuentas Railway, Twilio y Wompi (sandbox) y que guardó las claves (aunque todavía no las entregue).
- Existe `CREDENCIALES-PENDIENTES.md` como checklist sin valores.

## Trazabilidad
- RNF-012 (secretos fuera del código), ADR-007 (SMS/Twilio), ADR-008 (Railway/PaaS gestionado), decisión de pasarela (Wompi).
