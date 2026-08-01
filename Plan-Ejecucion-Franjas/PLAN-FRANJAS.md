# PLAN-FRANJAS · Intervalo configurable y franjas ancladas a las citas — Orkalis

> **Para quién es este documento.** Para el dueño del producto (EL USUARIO) y para la IA ejecutora. Convierte la generación de franjas de disponibilidad — hoy una rejilla fija de 15 min — en un sistema **configurable** (intervalo por negocio) e **inteligente** (las franjas se re-anclan al minuto exacto en que termina cada cita, sin huecos artificiales).
>
> **Regla de oro:** este es el PLAN. **No se escribe código hasta que EL USUARIO apruebe.** Implementación fase por fase (F1…F5); no se avanza si la verificación de la fase no pasa.
>
> **Estado del análisis:** completo, sobre el código real tras `475d65c`.

---

## 0. Decisiones de producto (a confirmar por EL USUARIO)

| # | Decisión | Propuesta |
|---|----------|-----------|
| D1 | **Intervalo configurable** | Nueva clave `agendamiento.intervalo_franjas` (enum: 10, 15, 20, 30, 60 min; default **15** en ambos verticales → cero cambio de comportamiento hasta que el admin lo toque). Vive en el registry de configuración como todas las demás y se edita en **Configuración → Reservas** con un selector. Nivel Negocio (aplica a todas las sedes). |
| D2 | **Anclaje a segmentos libres (el corazón del cambio)** | Hoy la rejilla arranca en la apertura y avanza de 15 en 15 **ignorando dónde terminan las citas**: una cita que termina 10:20 bloquea la franja de 10:15 y la siguiente oferta es 10:30 → 10 min muertos. Propuesta: calcular los **segmentos libres** del día (ventanas − citas − retenciones) y, dentro de cada segmento, generar franjas desde su inicio exacto avanzando por el intervalo configurado. El inicio de un segmento es la apertura **o el minuto exacto en que termina la cita anterior** — exactamente lo que pide EL USUARIO. |
| D3 | **Encaje de cola** | Además de la rejilla, ofrecer siempre el **último inicio posible** de cada segmento (`fin − duración`) cuando no coincide con la rejilla. Ejemplo: hueco de 50 min entre dos citas, servicio de 50 min, intervalo 30 → la rejilla solo ofrecería el inicio; sin esta regla un hueco de 50 min no aceptaría un servicio de 45 que arranque a los 5 min… con ella, el hueco se puede llenar por completo. Es la regla que convierte los "espacios muertos" en vendibles. |
| D4 | **Buffer entre citas** | Nueva clave `agendamiento.buffer_min` (número, default **0** = comportamiento actual). Minutos de limpieza/descanso que se suman al final de cada cita al calcular ocupación. Con buffer 5, una cita que termina 10:20 hace que el siguiente segmento arranque 10:25. Solo afecta la **generación** de franjas (la validación anti-solape de confirmación no cambia: el EXCLUDE de BD sigue protegiendo solo el solape real). |
| D5 | **Antelación mínima de reserva** | Hoy el único filtro es "solo futuro" (`inicio > ahora`): un cliente puede reservar para dentro de 3 minutos. Nueva clave `agendamiento.antelacion_reserva_min` (número, default **0** = como hoy) que descarta franjas que empiecen antes de `ahora + N min`. Complementa la antelación de cancelación que ya existe. |
| D6 | **Franjas "recomendadas" (v2, opcional)** | Marcar/priorizar las franjas que NO fragmentan la agenda (pegadas a una cita existente o a un borde de ventana), con un badge «Recomendada» en la reserva pública. Empuja a los clientes a compactar la agenda sin imponerles nada. **Propuesta: dejarla para una iteración posterior** — el anclaje de D2+D3 ya elimina la fragmentación artificial; medir antes de añadir UI. |

---

# PARTE I — DIAGNÓSTICO

**Dónde vive todo.** `apps/api/src/agendamiento/disponibilidad.service.ts` es la única fuente de franjas: la consumen la reserva pública (`GET /public/:sucursalId/disponibilidad`), el panel admin (`GET /citas/disponibilidad`, modal de nueva cita) y el panel del especialista. **Un solo cambio en el backend cubre las tres superficies**; el front solo pinta lo que recibe.

**El algoritmo actual** (`slotsDeEspecialista`):

```ts
const GRANULARIDAD_MIN = 15;                       // ← hardcoded
for (let t = v.desde; t + duracion <= v.hasta; t += GRANULARIDAD_MIN) {
  // descarta si choca con citas/retenciones o si ya pasó
}
```

Problemas concretos:
1. **Intervalo fijo**: un negocio de cortes de 20 min quisiera rejilla de 20; uno de servicios largos, de 30 o 60. No hay dónde configurarlo.
2. **Rejilla ciega a las citas**: con apertura 9:00 y una cita 9:45–10:20 (servicio de 35 min), las candidatas 10:15 choca y la siguiente oferta es 10:30. Los 10 min entre 10:20 y 10:30 se pierden **todo el día, en cada cita cuya duración no sea múltiplo del intervalo**. Es exactamente el desfase que describe EL USUARIO.
3. **Sin antelación de reserva**: se ofrece una franja que empieza en 1 minuto.

**Lo que ya está bien y no se toca:**
- `ventanasEfectivas()` (horario sede × ventanas del especialista) sigue siendo la única fuente de ventanas.
- La validación al confirmar es `cubierta(ventanas)` + constraint EXCLUDE `cita_no_solape` — **no valida alineación a la rejilla**, así que cualquier franja ofrecida sigue siendo confirmable. Cambiar la generación no puede romper la confirmación.
- Retenciones (`retencion_franja`) cuentan como ocupado; con D2 el segmento libre re-ancla también tras una retención.

**Nota de comportamiento** (esperada, no bug): al cancelarse una cita, las franjas de esa zona se re-anclan a la nueva realidad (el hueco vuelve a la rejilla del segmento). La disponibilidad siempre se calculó en vivo; esto no cambia.

---

# PARTE II — DISEÑO

## 2.1 Función pura `franjas.calculo.ts` (nueva)

Extraer el cálculo a `apps/api/src/agendamiento/franjas.calculo.ts`, puro y testeable (mismo patrón que `gastos.calculo.ts`):

```ts
export interface Ocupado { ini: number; fin: number }   // minutos del día

/**
 * Inicios posibles dentro de las ventanas, anclados a los segmentos libres:
 * 1. Fusionar ocupados (citas + retenciones + buffer) y restarlos de las ventanas
 *    → segmentos libres.
 * 2. En cada segmento: inicios en `seg.desde + k·paso` mientras quepa la duración.
 * 3. Encaje de cola: añadir `seg.hasta − duracion` si no cayó en la rejilla (D3).
 */
export function iniciosEnVentanas(
  ventanas: Ventana[],
  ocupados: Ocupado[],
  duracion: number,
  paso: number,
  bufferMin: number,
): number[]
```

Detalles del algoritmo:
- **Fusión de ocupados**: ordenar por inicio y unir solapes/adyacencias; a cada ocupado se le suma `bufferMin` al fin ANTES de fusionar (el buffer también aplica entre dos citas ya existentes al validar dónde cabe una nueva).
- **Segmentos libres**: recorte de cada ventana contra los ocupados fusionados. El inicio de un segmento interior es exactamente `fin de la cita anterior (+buffer)` → cumple el requerimiento 2 al minuto.
- El **encaje de cola** también respeta el buffer implícitamente (el segmento ya lo descuenta).
- La franja generada es `[inicio, inicio + duracion)`; el buffer NO alarga la franja mostrada al cliente (él ve la duración real de su servicio); solo separa la generación.

`slotsDeEspecialista` queda en: cargar ventanas + ocupados + config, llamar la función pura, mapear a instantes UTC y filtrar `inicio > ahora + antelacionReservaMin`.

## 2.2 Claves de configuración (registry + validación)

| Clave | Tipo | Default | Descripción |
|---|---|---|---|
| `agendamiento.intervalo_franjas` | enum `['10','15','20','30','60']` | `'15'` | Cada cuántos minutos se ofrecen horas de inicio. |
| `agendamiento.buffer_min` | numero (0–60) | `0` | Minutos de margen tras cada cita antes de la siguiente. |
| `agendamiento.antelacion_reserva_min` | numero (0–1440) | `0` | Minutos mínimos de antelación para reservar. |

Las tres con `nivelMinimoEdicion: Negocio`, defaults idénticos en salón y barbería (los defaults reproducen el comportamiento actual → despliegue sin sorpresas para negocios existentes). Validación cruzada en `validation.ts`: buffer y antelación no negativos, tope duro.

La lectura se hace **una vez por petición de disponibilidad** (no por especialista) vía `ConfigService.efectivo(...)`, igual que hace `public-agendamiento` con `antelacion_cancelacion_horas`.

## 2.3 UI de Configuración → Reservas

En `ConfigReservas` (donde ya viven antelación de cancelación y retención de franja):
- **Intervalo de franjas**: `Select` con «Cada 10/15/20/30/60 minutos» + hint «Las horas de inicio que se ofrecen al reservar. Tras una cita, las franjas continúan desde el minuto exacto en que termina.»
- **Margen entre citas**: número con sufijo `min` + hint «Tiempo de limpieza o descanso que se reserva después de cada cita.»
- **Antelación para reservar**: número con sufijo `min` + hint «Con cuánta anticipación mínima puede reservar un cliente.»

Con su `ProvControl` de procedencia/herencia como el resto de claves.

## 2.4 Qué NO cambia

- DTOs y endpoints de disponibilidad: misma forma (`{inicio, fin, especialistaId}`). El front no necesita cambios para D1–D5.
- Validación de confirmación (ventanas + EXCLUDE). El buffer NO se valida al confirmar en v1 — si el admin fuerza una cita manual pegada, la BD solo protege el solape real. (Endurecerlo sería D-futuro.)
- Agregación `'any'`: sigue siendo «primer especialista libre por hora de inicio»; con el anclaje, cada especialista aporta inicios según SUS citas, lo que naturalmente ofrece más variedad de horas.

---

# PARTE III — FASES

**F1 · Config**: registry (3 claves) + validación + UI en ConfigReservas. Verificación: jest de config, guardado/herencia en UI local.

**F2 · Motor de franjas**: `franjas.calculo.ts` (pura) + jest exhaustivo: rejilla base, re-anclaje tras cita (caso 9:45–10:20 → siguiente franja 10:20), fusión de solapes, buffer, encaje de cola, segmento más corto que la duración, cita cruzando el borde de ventana, día sin ventanas.

**F3 · Integración**: `slotsDeEspecialista` usa la función pura + lee las 3 claves + antelación de reserva. Verificación: jest de disponibilidad existente (con defaults debe pasar **sin tocar ningún test actual** salvo los que asuman la rejilla ciega) + tests nuevos.

**F4 · E2E + móvil**: spec e2e (cambiar intervalo en Config → la reserva pública ofrece la nueva rejilla; crear cita de duración no múltiplo → la siguiente franja ofrecida arranca al terminar). Revisión visual: más franjas por día con intervalos cortos → confirmar que la grilla de horas de BookingPage y el modal admin scrollean bien en 390 px.

**F5 · Deploy**: commit + push (Railway). Sin migraciones de BD (la config usa la tabla `configuracion` existente).

---

# PARTE IV — IDEAS ADICIONALES (solicitud de propuestas)

Sobre las tres áreas que pidió EL USUARIO. Las tres primeras YA están integradas en el plan (D3, D4, D5); el resto son candidatas a v2 para no inflar esta entrega:

**Optimización del tiempo entre citas**
1. *(en plan, D3)* **Encaje de cola**: todo hueco que quepa el servicio se ofrece completo, aunque la rejilla no caiga ahí.
2. *(en plan, D4)* **Buffer configurable**: el margen deja de ser "el redondeo de la rejilla" (implícito y aleatorio) y pasa a ser una decisión explícita del negocio.
3. *(v2)* **Duración real por especialista**: permitir que un especialista declare su propia duración para un servicio (el senior tarda 30, el junior 45). Hoy la duración es del servicio; afinarla compacta la agenda de verdad.

**Manejo de espacios muertos**
4. *(v2)* **Detector de huecos inutilizables**: en la agenda del día (admin/especialista), señalar fragmentos libres menores que el servicio más corto del especialista («hueco de 10 min a las 3:50 — considera reagendar la cita de las 4:00 a las 3:50»). Primero solo informativo.
5. *(v2, D6)* **Franjas «Recomendadas»**: badge en la reserva pública sobre las franjas pegadas a citas/bordes, ordenadas primero. Cero fricción, compacta por diseño.
6. *(v2)* **Relleno por cancelación**: al cancelarse una cita que deja un hueco exacto entre otras dos, ofrecer al admin «avisar a lista de espera» (requiere lista de espera, módulo aparte).

**Ajuste automático durante el día**
7. *(ya cubierto por D2)* El re-anclaje es automático y en vivo: cada nueva cita (o cancelación) redefine los segmentos libres en la siguiente consulta de disponibilidad; no hay nada que "recalcular" en lote ni filas materializadas — mismo principio que las ocurrencias de gastos.
8. *(v2)* **Compactación asistida**: sugerencia puntual («si mueves la cita de las 11:15 a las 11:00 liberas un bloque de 45 min») cuando el día tiene ≥N fragmentos muertos. Solo sugerencia; mover siempre es decisión humana + aviso al cliente.

**Recomendación**: aprobar D1–D5 para esta entrega (F1–F5) y decidir D6/ideas 3–8 tras verla en producción.
