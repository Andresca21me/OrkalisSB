# Guía de go-live · Mercado Pago (pagos reales)

> Paso a producción de la pasarela. Autocontenida y accionable. **Aún NO aplicada**
> (seguimos en sandbox). Cuando quieras cobrar de verdad, sigue estos pasos.
>
> Regla de oro: **la URL de la API de MP no cambia** entre prueba y producción
> (`https://api.mercadopago.com`). Lo que decide el ambiente es la **credencial**
> (`TEST-…` → sandbox, `APP_USR-…` → producción).

---

## 0. Estado actual (sandbox)
- `apps/api/.env`: `MP_PUBLIC_KEY=TEST-…`, `MP_ACCESS_TOKEN=TEST-…`, `MP_WEBHOOK_SECRET=…`, `MP_ENV=sandbox`
- `apps/web/.env`: `VITE_MP_PUBLIC_KEY=TEST-…`
- Ambos `.env` están **gitignored** (nunca se suben al repo). Verificable con `git check-ignore apps/api/.env`.
- Sin `MP_ACCESS_TOKEN`, el `MercadoPagoClient` corre en **modo INACTIVO** (no llama a MP; simula respuestas). Útil para entornos sin pasarela.

## 1. Prerrequisitos (cuenta de Mercado Pago)
- [ ] Cuenta **activada para producción**: datos legales completos + **cuenta bancaria** para retiros.
- [ ] Si MP lo exige para tu integración: pasar la **certificación de calidad** de la integración desde el panel antes de habilitar credenciales de producción.
- Si en el panel solo ves "Credenciales de prueba", es que falta este paso.

## 2. Obtener las 3 credenciales de producción
En el panel de desarrolladores de Mercado Pago → **Tus integraciones → [tu aplicación]**:
- **Public Key** (producción): `APP_USR-…` → tokeniza la tarjeta en el navegador.
- **Access Token** (producción): `APP_USR-…` → credencial **privada** del backend (mueve dinero real).
- **Clave secreta del Webhook**: se genera al configurar la URL de notificaciones (paso 4).

## 3. Poner las variables (exacto)
> Reemplaza los valores `TEST-…` por los `APP_USR-…`. Son 5 variables en 2 archivos.

**`apps/api/.env`:**
```
MP_PUBLIC_KEY=APP_USR-...        # public key de producción
MP_ACCESS_TOKEN=APP_USR-...      # access token de producción (SECRETO)
MP_WEBHOOK_SECRET=...            # clave secreta del webhook (paso 4)
MP_ENV=production
```

**`apps/web/.env`:**
```
VITE_MP_PUBLIC_KEY=APP_USR-...   # la MISMA public key de producción
```

Variables que lee el código (referencia): `env.validation.ts` valida `MP_PUBLIC_KEY`,
`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` (opcionales) y `MP_ENV` (`sandbox`|`production`,
default `sandbox`). El front usa `import.meta.env.VITE_MP_PUBLIC_KEY`.

## 4. Configurar el Webhook de producción
- **URL a registrar en MP:** `https://<TU-DOMINIO>/api/pagos/webhook`
  (controlador `MercadoPagoWebhookController` → `@Controller('pagos')` + `@Post('webhook')`, con prefijo global `api`).
- **Evento a suscribir:** `payment`.
- MP te mostrará una **Clave secreta** para ese webhook → cópiala a `MP_WEBHOOK_SECRET`.
- La firma se valida con HMAC-SHA256 sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
  (`mercadopago.client.verificarFirma`). **El secreto NO cambia si rotas el túnel**; solo cambia la URL.

**¿Dónde corre la API? (define `<TU-DOMINIO>`)**
- **API desplegada** (recomendado para producción): usa el dominio real, p. ej. `https://api.tudominio.com`.
- **Local para probar**: expón `:3000` con **ngrok de dominio ESTÁTICO**:
  ```
  ngrok http 3000 --domain=TU-DOMINIO-ESTATICO.ngrok-free.app
  ```
  y registra `https://TU-DOMINIO-ESTATICO.ngrok-free.app/api/pagos/webhook`. Con dominio
  estático no tienes que reconfigurar el webhook cada vez que reinicias ngrok.

## 5. Reiniciar y validar
- [ ] Reiniciar la **API** (para recargar `.env`) y el **front** (Vite lee `VITE_*` al arrancar).
- [ ] Validar las credenciales contra producción (como se hizo con las de prueba):
  - crear un customer real (`POST` a MP responde 201),
  - verificar que la **firma del webhook** acepta una válida y rechaza una manipulada.
- [ ] Confirmar en logs que MP **ya no** dice "inactivo" (eso solo pasa sin `MP_ACCESS_TOKEN`).

## 6. Compra real pequeña (smoke de producción)
- [ ] Con un **monto pequeño** (un plan barato o algo reembolsable), completa un **primer pago real** por el brick (tarjeta presente).
- [ ] Verifica: **cobro aprobado** en el panel de MP, **acreditación/retiro** a tu cuenta, y que llega la **notificación del webhook** (la cuenta pasa a `activa`).
- [ ] Reembolsa la prueba desde el panel de MP si aplica.
- [ ] (Recomendado) Monitoreo/alertas de **cobros fallidos** y de la **corrida diaria del cron**.

## 7. Notas importantes
- **En producción cada cobro es REAL.** No pruebes con montos grandes.
- La **limitación del sandbox** ("Card not found" al cobrar tarjeta guardada) **NO aplica en producción**: la **recurrencia** (cron mensual con tarjeta guardada) ya funciona con tarjetas reales.
- El **primer pago / recuperación / prorrateo de subida** siguen siendo cobro **con tarjeta presente** (brick), igual que en sandbox.
- **Seguridad de las claves**: van SOLO en los `.env` (gitignored). Nunca las subas al repo, ni las pegues en código, ni las imprimas en logs.
  - Si me pasas las claves por chat para que las acomode, ten en cuenta que quedan en el transcript; la alternativa más segura es que las pegues tú en los `.env` y yo solo ponga `MP_ENV=production`, reinicie y verifique.

## 8. Rollback a sandbox
Si algo sale mal, vuelve a las de prueba: pon de nuevo los valores `TEST-…` en las 5 variables, `MP_ENV=sandbox`, reinicia API+front. Sin cambios de código.

---

**Trazabilidad:** cierra el 🧑‍💻 de `FASE-12-pruebas-y-produccion.md` (pasos 5–8) y complementa el checklist de `_HALLAZGOS-Y-PRODUCCION.md §3`.
