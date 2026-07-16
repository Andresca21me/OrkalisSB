# Guía Mercado Pago · paso a paso (lo que haces TÚ)

> Esta es la parte **manual** que solo puedes hacer tú desde el panel de Mercado Pago. Yo no tengo acceso a tu cuenta. Sigue los pasos en orden; al final de cada bloque dice **qué dato pegarme** o **dónde ponerlo**. Empezamos en **modo de pruebas (test)** y solo al final pasamos a producción.

---

## Contexto rápido (para que entiendas qué pides)

Mercado Pago **sí** tiene un producto de "Suscripciones" nativo (preapprovals), pero **no lo vamos a usar**: nuestro cobro depende del **plan + nº de especialistas** (monto variable), tiene **cuentas de cortesía** sin cobro y una lógica propia de **gracia/suspensión**. Por eso construimos **nuestra propia recurrencia** guardando la tarjeta del cliente y cobrándola nosotros cada mes. El flujo es:

1. Tu cliente ingresa la tarjeta → el **SDK de Mercado Pago** la **tokeniza** en el navegador (con tu **Public Key**). La tarjeta nunca toca nuestro backend (PCI).
2. Nuestro backend crea un **Customer** y le **guarda la tarjeta** (con tu **Access Token**) → quedamos con un `customer_id` + `card_id`.
3. Cada mes, **nuestro** sistema genera un **pago** (`POST /v1/payments`) cobrando esa tarjeta guardada. Eso es la "recurrencia".
4. Mercado Pago nos avisa el resultado por un **webhook/notificación** (verificamos la firma con tu **clave secreta de webhook**).

Por eso necesito de ti **3 datos** de Mercado Pago (test): **Public Key**, **Access Token** y la **clave secreta del webhook**. Los sacamos abajo.

> 💡 **Diferencia con Wompi:** en Mercado Pago **no** hay "llave privada + secreto de integridad" separados; el `Access Token` hace de credencial privada y la firma del webhook se valida con la **clave secreta del webhook**. Además, **la URL del API es la misma en test y en producción** (`https://api.mercadopago.com`): lo que cambia el ambiente es **qué credencial** usas (test vs producción), no la URL.

---

## PASO 1 · Crear la cuenta y una "Aplicación" en Mercado Pago 🧑‍💻

1. Entra a **https://www.mercadopago.com.co/** y crea una cuenta (o inicia sesión si ya tienes).
2. Ve al panel de desarrolladores: **https://www.mercadopago.com.co/developers/panel**.
3. Entra a **"Tus integraciones"** → **"Crear aplicación"**.
   - Nombre: p. ej. `Orkalis Suscripciones`.
   - Producto/Solución: elige **"Pagos online"** (CheckoutAPI / Bricks). No elijas "Suscripciones", porque manejamos la recurrencia nosotros.
   - Modelo de integración: **"Pagos por API / CheckoutAPI"**.
4. Crea la aplicación. Quedarás dentro de su tablero, donde están las **Credenciales** y la **configuración de Webhooks**.

> ✅ **Resultado:** tienes una aplicación creada con acceso a **Credenciales de prueba** y **Webhooks**.

---

## PASO 2 · Copiar las **credenciales de prueba (test)** 🧑‍💻

Dentro de tu aplicación, ve a **"Credenciales"**. Verás dos pestañas: **"Credenciales de prueba"** y **"Credenciales de producción"**. Usa la de **PRUEBA**.

Copia estos **2 valores del ambiente de prueba**:

| Dato en Mercado Pago | Empieza por | Para qué lo usamos |
|---|---|---|
| **Public Key** (prueba) | `TEST-...` | Tokenizar tarjetas en el navegador (frontend) |
| **Access Token** (prueba) | `TEST-...` | Crear customers, guardar tarjetas y cobrar (backend) |

> 🧑‍💻 **Pégame estos 2 valores cuando lleguemos a la FASE-02** (o ponlos tú directamente en `apps/api/.env`, ver PASO 5).
>
> ⚠️ El **Access Token** es sensible: **nunca** lo subas a Git (ya está cubierto por `.env` en `.gitignore`). La **Public Key** sí puede ir al frontend.

> 💡 **Sobre "usuarios de prueba":** para probar pagos de extremo a extremo, Mercado Pago recomienda crear **usuarios de prueba** (un vendedor de prueba y un comprador de prueba) desde **"Cuentas de prueba"** en el panel. Para nuestro flujo con **tarjetas de prueba** (PASO 4) normalmente basta con las credenciales de prueba de tu propia aplicación; si en FASE-05 hiciera falta un usuario de prueba vendedor, te guío a crearlo ahí.

---

## PASO 3 · Configurar la **URL del webhook (notificaciones)** 🧑‍💻

Mercado Pago nos avisa cuándo un pago fue **aprobado/rechazado** llamando a una URL nuestra.

1. En tu aplicación, ve a **"Webhooks"** (o **"Notificaciones"** → **"Webhooks / IPN"**). Configura el **modo de prueba**.
2. **URL a notificar** apuntando a nuestro backend:
   - **En producción/staging:** `https://TU-DOMINIO/api/pagos/webhook`
   - **En tu PC (desarrollo):** Mercado Pago necesita una URL **pública**; tu `localhost` no le sirve. Usa un túnel:
     1. Instala **ngrok** (https://ngrok.com/, gratis) o **cloudflared**.
     2. Con el backend corriendo en `:3000`, abre una terminal y ejecuta:
        ```
        ngrok http 3000
        ```
     3. ngrok te da una URL tipo `https://abcd-1234.ngrok-free.app`.
     4. En Mercado Pago pon: `https://abcd-1234.ngrok-free.app/api/pagos/webhook`
   - 💡 Si no quieres usar túnel todavía, **no pasa nada**: en FASE-05/06 también probamos el webhook **simulándolo** (yo te doy un comando `curl` firmado). El túnel solo hace falta para probar contra Mercado Pago real.
3. **Eventos a suscribir:** marca **"Pagos" (`payment`)**. (Opcional, no lo usamos: "Suscripciones".)
4. **Guarda.** Al guardar, Mercado Pago te muestra/genera una **"clave secreta"** del webhook (firma). **Cópiala** — es el 3.er dato que necesito.

| Dato en Mercado Pago | Para qué lo usamos |
|---|---|
| **Clave secreta del webhook** (firma) | Verificar la firma `x-signature` de cada notificación |

> 🧑‍💻 **Pégame esa clave secreta** junto con las otras 2 (o ponla en `.env`, PASO 5).
> ✅ **Resultado:** Mercado Pago sabe a qué URL avisarnos y tenemos la clave para verificar sus firmas. (Si usaste ngrok gratis, la URL cambia cada vez que reinicias ngrok; habrá que actualizarla en el panel.)

---

## PASO 4 · Tarjetas y datos de **prueba** 🧑‍💻 (para cuando probemos)

En modo prueba, Mercado Pago acepta **tarjetas de prueba** (no cobra dinero real). Las usaremos en FASE-05.

**Tarjetas de prueba (Colombia):**

| Marca | Número de prueba | CVV | Vencimiento |
|---|---|---|---|
| Mastercard | `5031 7557 3453 0604` | `123` | `11/30` (cualquiera futura) |
| Visa | `4509 9535 6623 3704` | `123` | `11/30` (cualquiera futura) |

**Cómo forzar el resultado (¡importante, es distinto a Wompi!):** en Mercado Pago el resultado del pago se controla con el **NOMBRE del titular** de la tarjeta, no con el número:

| Nombre del titular | Resultado del pago |
|---|---|
| `APRO` | **Aprobado** |
| `OTHE` | Rechazado (error general) |
| `FUND` | Rechazado (fondos insuficientes) |
| `CONT` | Pendiente |
| `CALL` | Rechazado (validar con el banco) |

> Ejemplo: tarjeta `5031 7557 3453 0604`, titular **`APRO`**, CVV `123`, vto `11/30` → pago **aprobado**. Cambiando el titular a **`OTHE`** → **rechazado**.
> ⚠️ Las tarjetas y nombres **exactos** los publica Mercado Pago en su doc de pruebas; cuando lleguemos a FASE-05 verificamos los vigentes en su doc oficial. Te lo recuerdo ahí.

---

## PASO 5 · Dónde van las credenciales (el `.env`) 🧑‍💻/🤖

Las credenciales van en **`apps/api/.env`** (no en el código):

```dotenv
MP_PUBLIC_KEY=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MP_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MP_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MP_ENV=sandbox
```

Y en el frontend (Vite) la Public Key, en **`apps/web/.env`** (o la raíz, según uses):

```dotenv
VITE_MP_PUBLIC_KEY=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> 🧑‍💻 **Tú:** pégame los 3 valores y yo los pongo en `apps/api/.env` (+ la Public Key en `apps/web/.env`), **o** edítalos tú mismo (tip: en este chat puedes escribir `! nano apps/api/.env` para abrirlo). Las variables las agrego al `env.validation.ts` en FASE-02.

---

## PASO 6 · (Solo al final) Pasar a **producción** 🧑‍💻 — FASE-12

Cuando todo funcione en pruebas:
1. Completa la **homologación/activación** de tu aplicación en producción si Mercado Pago la exige (datos del comercio, cuenta bancaria para los retiros, y en algunos casos la **certificación de calidad de la integración** que se aprueba desde el mismo panel de la aplicación).
2. En tu aplicación, ve a **"Credenciales de producción"** y copia la **Public Key** (`APP_USR-...`) y el **Access Token** (`APP_USR-...`).
3. Cambia en `apps/api/.env` las credenciales por las de **producción** y pon `MP_ENV=production`. Actualiza `VITE_MP_PUBLIC_KEY` con la Public Key de producción. (La URL del API **no cambia**: sigue siendo `https://api.mercadopago.com`.)
4. Configura el **webhook de producción** apuntando a tu dominio real y copia su **clave secreta de producción** a `MP_WEBHOOK_SECRET`.
5. Haz **una compra real pequeña** de prueba y verifica el cobro, el retiro/acreditación y la notificación.

> Te acompaño en estos pasos en la **FASE-12**. **No** toques producción antes de que el modo prueba esté 100 % verde.

---

## Resumen de lo que me pasarás tú (checklist)

- [ ] FASE-02: las **3 credenciales de prueba** → **Public Key**, **Access Token** y **clave secreta del webhook** → para el `.env`.
- [ ] FASE-02/05: la **URL pública del webhook** (ngrok) **o** decidir que probamos el webhook simulado.
- [ ] FASE-05: confirmar las **tarjetas de prueba** vigentes y los **nombres de titular** que fuerzan el estado (de la doc de Mercado Pago).
- [ ] FASE-12: las **credenciales de producción** (`APP_USR-...`) + activación/homologación + webhook de producción y su clave secreta.
