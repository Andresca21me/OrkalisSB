# Guía manual del piloto · Lo que hace Andrés

> Todo lo que **no** puede hacer Claude: paneles externos, decisiones, la barbería y el
> deploy a producción. Se ejecuta **en orden, de la Parte A a la I**. La Parte J es opcional.
> Cada parte dice **cuándo** hacerla y **cómo saber que quedó bien** (✅).
>
> Regla de oro: **nunca pegues una clave en el chat** con Claude. Las claves van
> directo a Railway.

---

## Parte A · Accesos (mié 11-nov, noche · 10 min)

1. **Que Claude pueda subir código a GitHub.** Cuando Claude te pida conectar el
   repositorio `Andresca21me/OrkalisSB` con permiso de escritura, **apruébalo** en la
   ventana que aparece en claude.ai.
   - Si no aparece o falla: no pasa nada. Claude deja los commits listos y tú los subes en
     la Parte E desde tu PC.
2. **Confirma que entras a todo:**
   - [railway.app](https://railway.app) → proyecto de Orkalis → ves los servicios
     **OrkalisSB** (API), **web** y **Postgres**.
   - [console.twilio.com](https://console.twilio.com).
   - [app.sendgrid.com](https://app.sendgrid.com).
   - `https://orkalis.com/login` con tu **usuario operador** (el que entra a `/plataforma`).

✅ Entras a las 4. Si no tienes usuario operador o no recuerdas la clave, avísale a
Claude **antes** de la Parte D: se crea con el script `db:operador` (ver Anexo 1).

---

## Parte B · Datos de la barbería (jue 12-nov, **antes del mediodía**)

Mándale este mensaje a la barbería (cópialo tal cual) y espera la respuesta:

> Hola, para dejarles Orkalis listo para mañana necesito:
> 1. **Servicios:** nombre, precio y duración de cada uno (ej. Corte – $25.000 – 30 min).
> 2. **Barberos:** nombre, celular, correo (si van a entrar a su propio panel) y qué
>    servicios hace cada uno.
> 3. **Horario** de atención por día (ej. Lun–Sáb 9 a.m.–8 p.m., Dom cerrado).
> 4. **Logo** (imagen) y un **color** de la marca.
> 5. **Cómo pagan a los barberos:** porcentaje para el barbero vs. para la barbería, y si
>    descuentan algo por pagos con tarjeta o transferencia.
> 6. **Correo y celular del dueño o administrador** (con ese correo se crea la cuenta).
> 7. ¿Quién va a la capacitación mañana y a qué hora les queda bien?

✅ Tienes los 7 puntos. **Si a las 2 p.m. falta algo**, la configuración se corre y avisas
al cliente que el arranque pasa al sábado.

---

## Parte C · Verificaciones de producción (jue 12-nov, tarde · 45 min)

### C1. Railway: variables del servicio API
Railway → **OrkalisSB** → **Variables**. Comprueba:
- [ ] Existen las 5: `TWILIO_WA_TPL_CONFIRMACION`, `TWILIO_WA_TPL_RECORDATORIO`,
      `TWILIO_WA_TPL_AVISO`, `TWILIO_WA_TPL_AVISO_ESPECIALISTA`, `TWILIO_WA_TPL_MARKETING`
      (cada una empieza por `HX…`). Si falta alguna, ese tipo de mensaje sale por SMS.
- [ ] Existe `TWILIO_WHATSAPP_FROM` (= `+573155909339`, sin `whatsapp:`).
- [ ] `APP_URL` = `https://orkalis.com`. **Importante:** los enlaces que manda la FASE-01 se
      arman con ella.
- [ ] Borra las que ya no se usan: `TWILIO_VERIFY_SERVICE_SID` y `TWILIO_WHATSAPP_NUMBER`
      (si existen).

### C2. Railway: copias de seguridad de la base de datos
Railway → servicio **Postgres** → pestaña **Backups**.
- Si la ves: activa las copias **diarias**, pulsa **Backup now** para tener una de hoy y
  anota la fecha.
- Si **no** aparece la pestaña (depende del plan de Railway): avísale a Claude; se arma un
  respaldo manual con `pg_dump` antes del deploy. **No hagas el deploy de la Parte E sin
  una copia de hoy.**

✅ Hay una copia de seguridad con fecha de hoy.

### C3. Twilio
- **Messaging → Settings → Geo permissions:** Colombia ✅ habilitada.
- **Saldo:** arriba a la derecha. Recarga si tienes menos de **15 USD**. En
  **Billing → Low balance alert** pon una alerta de 10 USD a tu correo.
- **Messaging → Senders → WhatsApp senders:** `+573155909339` en estado **Online**.

### C4. SendGrid
**Settings → Sender Authentication:** el dominio `orkalis.com` aparece **Verified**.
Si no, los correos de verificación y de "olvidé mi contraseña" caen en spam y el alta de la
barbería se traba. Si no está verificado, avísale a Claude antes de la Parte D.

### C5. Monitor de caídas (gratis, 5 min)
1. Crea una cuenta en [uptimerobot.com](https://uptimerobot.com).
2. **Add New Monitor** → tipo **HTTP(s)** → URL `https://api.orkalis.com/api/health` →
   cada **5 minutos** → alerta a tu correo (y a tu celular si la app lo permite).

✅ El monitor aparece en verde ("Up").

---

## Parte D · Configurar la barbería (jue 12-nov, tarde-noche · 1–2 h)

> Hazlo con el dueño en llamada o en persona: en el paso D1 tiene que abrir un enlace que le
> llega a **su** correo.

**D1. Crear la cuenta.** Entra a `https://orkalis.com/alta` (en una ventana de incógnito,
para no mezclar con tu sesión de operador):
- Nombre del negocio, tipo **Barbería**, correo **del dueño**.
- El dueño abre el correo "Verifica tu correo" y pulsa el enlace. La pantalla avanza sola.
- Plan: **Pro**, con el número de barberos real. Elige **empezar con la prueba de 15 días** (no pagar ahora).
- Contraseña: que la ponga el dueño.

**D2. Cortesía, para que no se bloquee a mitad del testeo.** La prueba gratis dura 15
días: vencería el **27-nov**, antes del fin del testeo (30-nov), y la cuenta quedaría
bloqueada.
- En tu ventana normal: `https://orkalis.com/plataforma` → busca la barbería → **Dar
  cortesía** → plan **Pro**, nº de barberos real → guardar.
- ✅ La barbería aparece con la etiqueta **Cortesía**.

**D3. Configurar** (con la sesión del dueño, en `/admin`):
1. **Servicios:** cargar los de la Parte B (nombre, precio, duración, categoría).
2. **Equipo:** crear a cada barbero con su celular y sus servicios. Si va a entrar a su
   panel, usar **Invitar** con su correo; cada barbero activa su cuenta desde el correo.
   Si el dueño también atiende, usar **"Este soy yo"**.
3. **Configuración → Horario** de atención.
4. **Configuración → Marca:** logo y color.
5. **Configuración → Financieros:** porcentaje barbero/barbería y descuento por pago
   electrónico según el punto 5 de la Parte B.
6. **Configuración → Módulos:** activar los que la barbería va a usar (inventario, cierre
   de período, partición por especialista).

**D4. Prueba de punta a punta (todavía sin publicar el enlace):**
- **Configuración → Reservas (enlaces y QR)** → copia el enlace de reserva.
- Ábrelo en tu celular y reserva una cita con **tu número**.
- ✅ Te llega el WhatsApp de confirmación y la cita aparece en la Agenda del admin.
- Cancela esa cita de prueba desde la Agenda.

---

## Parte E · Deploy y prueba de humo (vie 13-nov, **antes de la capacitación** · 45 min)

> Requisito: Claude te confirmó que **FASE-00 a FASE-03 + FASE-06** están en verde.

**E1. Copia de seguridad de hoy:** repite C2 (Backup now).

**E2. Subir el código.**
- Si Claude tiene acceso de escritura: ya abrió un *Pull Request* de
  `piloto/endurecimiento` hacia `main`.
- Si no: en tu PC, en la carpeta
  `Documentos\SaaS\SaaS_salonBelleza\_orkalis-auditoria\OrkalisSB`, abre una terminal y
  corre los comandos que te dé Claude. Termina en `git push origin piloto/endurecimiento`.
  Luego en GitHub pulsa **Compare & pull request**.

**E3. Revisa que el CI del Pull Request esté en verde** (✔️ verde en la pestaña *Checks*).
Si está en rojo, **no** hagas merge: mándale a Claude el nombre del paso que falló.

**E4. Merge** del Pull Request → Railway despliega solo la API y la web. Espera unos 5 minutos.

**E5. Logs de la API** (Railway → OrkalisSB → Deployments → el último → **View logs**):
- ✅ Aparecen `Migraciones aplicadas.` y `Orkalis API escuchando`.
- ❌ Si ves un error rojo, pasa al **Plan de reversa** (abajo).

**E6. Token de métricas** (FASE-03):
1. En Windows, abre **PowerShell** y pega:
   ```powershell
   $b = New-Object byte[] 48; [Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   ```
2. Copia el resultado → Railway → OrkalisSB → Variables → **New variable**
   `METRICS_TOKEN` = (lo copiado). Railway reinicia la API.
3. Guárdalo en tu gestor de contraseñas (lo usarás en la Parte H).

**E7. Prueba de humo** (en tu celular, con el enlace de la barbería):
- [ ] Reservar con tu número → llega el WhatsApp de confirmación.
- [ ] En la misma página, **"Ver mi cita"** → abre tu cita.
- [ ] Desde **otro** navegador o en incógnito: "Buscar por celular" con tu número → la
      pantalla **no** muestra la cita, dice que te enviaron un enlace, y te llega un SMS
      con el enlace. Al abrirlo, ves la cita y puedes cancelarla.
- [ ] Probar "Buscar" con el celular de otra persona (con su permiso) → no ves su cita.
- [ ] `https://api.orkalis.com/api/metrics` en el navegador → **ya no** muestra datos
      (404/401).
- [ ] Login con contraseña mala 6 veces (con un usuario de prueba, **no** el del dueño) →
      el 6.º dice "Demasiados intentos".

**Plan de reversa** (solo si E5 o E7 fallan de forma grave):
Railway → OrkalisSB → **Deployments** → el deploy anterior → **⋯ → Redeploy**. Haz lo mismo
en el servicio **web**. Las migraciones de este plan solo **agregan** columnas, así que la
versión anterior funciona con la base ya migrada. Avísale a Claude con lo que viste en los
logs.

---

## Parte F · Capacitación (vie 13-nov, mañana · 1–2 h)

Lleva el celular y el portátil. Orden sugerido:

| Min | Tema | Quién |
|---|---|---|
| 0–10 | Qué es Orkalis y qué vamos a medir en estas 3 semanas | Todos |
| 10–35 | **Agenda:** crear una cita a mano, cliente nuevo al vuelo, mover, cancelar, no asistió | Dueño / recepción |
| 35–55 | **Atender:** iniciar el turno, cobrar (efectivo / tarjeta / transferencia), vender un producto | Barberos |
| 55–70 | **Panel del barbero** desde su celular: su agenda y sus ganancias | Barberos |
| 70–90 | **Finanzas:** gastos, liquidación de la quincena, exportar CSV | Dueño |
| 90–105 | Cómo reservan los clientes (enlace y QR) y qué mensajes les llegan | Todos |
| 105–120 | Cómo reportar un problema (Parte H) y dudas | Todos |

✅ Cada persona hizo al menos **una** acción real de su rol durante la sesión.

Acuerda **un solo canal** para reportar problemas (por ejemplo, un grupo de WhatsApp
"Orkalis – soporte") y pide que cada reporte traiga **qué hicieron, qué esperaban y una
captura**.

---

## Parte G · Abrir el enlace público (sáb 14-nov)

**Solo si** E7 salió completa. Si no, se abre cuando quede y el testeo no se mueve.
1. Configuración → Reservas (enlaces y QR) → descarga el **QR** y pásalo a la barbería para imprimir
   (mostrador y espejo).
2. La barbería pone el enlace en la **bio de Instagram** y en su **estado de WhatsApp**.
3. ✅ Durante el día llega la primera reserva hecha por un cliente real (míralo en la Agenda).

---

## Parte H · Seguimiento diario (14-nov → 30-nov · 10 min/día)

**Cada día:**
1. **Métricas** (en PowerShell, con tu token de E6):
   ```powershell
   $t = "PEGA-AQUI-TU-METRICS_TOKEN"
   Invoke-RestMethod -Headers @{ Authorization = "Bearer $t" } https://api.orkalis.com/api/metrics | ConvertTo-Json -Depth 5
   ```
   Anota en una tabla diaria: `reservas_creadas`, `mensajes_fallidos`, `errores_5xx`,
   `login_bloqueados`. (Los contadores se reinician cuando la API se redespliega: anota
   también la fecha del último deploy.)
2. **Registro de mensajes** de la barbería (Configuración → Registro de mensajes):
   ¿algo en rojo ("fallido")?
3. **Grupo de soporte:** pasa cada reporte a una lista con fecha, gravedad
   (bloquea / molesta / sugerencia) y estado.
4. Una vez por semana, abre la página de reserva con el navegador en **F12 → Consola**: si
   aparecen avisos rojos de "Content Security Policy", mándale una captura a Claude
   (FASE-04).

**Checkpoints con la barbería:**
- **Dom 15 y lun 30-nov:** cierre de quincena. Revisa **con el dueño** que la liquidación
  de cada barbero cuadre con sus cuentas en papel. Descarga los dos CSV (análisis y
  liquidación) y ábrelos en Excel (FASE-05).
- **Vie 20 y vie 27-nov:** llamada de 15 min: ¿qué les gusta?, ¿qué les estorba?, ¿lo
  siguen usando todos?

**Escala a Claude de inmediato si:** un cliente ve datos de otro, la API cae más de 10
minutos (te avisa UptimeRobot), los mensajes empiezan a fallar en serie o la liquidación
no cuadra.

---

## Parte I · Cierre e informe (1–2 dic)

Recoge y pásale a Claude estos datos para redactar el informe del **mié 2-dic**:
- [ ] Tabla diaria de la Parte H.
- [ ] Lista de reportes con su estado.
- [ ] Resultado de los dos cierres de quincena (¿cuadraron?).
- [ ] Respuestas del dueño: ¿lo usaron solos?, ¿lo pagarían?, ¿cuánto?

Criterios para dar el testeo por **superado**:
- Cero incidentes de datos o de aislamiento entre negocios.
- Más del 95 % de los mensajes entregados.
- Las dos quincenas cuadran.
- La barbería lo usó sin ayuda en la última semana.

---

## Parte J (después del piloto) · Enlace de gestión también por WhatsApp

Hoy el enlace para ver o cancelar la cita llega **por SMS**. Normalmente son 2 segmentos,
porque el enlace es largo. Pasarlo a WhatsApp requiere **dos cosas**, y no son para esta
semana:
1. **Código** (Claude, post-piloto): llevar el evento `enlace_gestion` por el enrutador de
   canal.
2. **Plantilla de Meta** (tú): Twilio → **Messaging → Content Template Builder → Create
   new** → tipo *Text*, categoría **Utility**, nombre `orkalis_enlace_gestion`, cuerpo:
   `Hola, aquí puedes ver o cancelar tu cita en {{1}}: {{2}}`. Cuando quede **Approved**,
   Claude te dirá en qué variable de Railway pegar su `HX…`.

---

## Anexo 1 · Crear o restablecer el usuario operador

Solo si en la Parte A no pudiste entrar a `/plataforma`.

**Ruta recomendada (sin terminal):** recuperar el correo del operador que ya existe.
1. Railway → servicio **Postgres** → pestaña **Data** → tabla **`usuario`**.
2. Busca la fila con `rol` = `operador_plataforma` y copia su `email`. Si hay un campo de
   consulta SQL:
   ```sql
   SELECT email, activo FROM usuario WHERE rol = 'operador_plataforma';
   ```
3. `https://orkalis.com/login` → **"¿Olvidaste tu contraseña?"** con ese correo → abre el
   enlace que llega → contraseña nueva.

**Solo si no existe ningún operador o está inactivo:** crearlo con el script dentro del
contenedor de la API (`railway ssh` → `OPERADOR_EMAIL=… OPERADOR_PASSWORD='…' node
dist/db/operador.js`). Ojo: `railway ssh` necesita que tu PC resuelva `ssh.railway.com`.
Si falla con "Could not resolve hostname", es el DNS de tu red; avísale a Claude antes de
seguir.
