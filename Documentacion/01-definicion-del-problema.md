# Definición del Problema: Orkalis — Plataforma SaaS de Gestión para Salones y Barberías

**Proyecto:** Orkalis
**Versión:** 1.4
**Fecha:** 2026-06-08
**Estado:** Borrador
**Predecesor:** NOVA — Salón & Spa (software a la medida, mono-salón, modo demo)

> **Cambios v1.1:** se incorpora soporte **multi-sucursal** (negocio → sucursales, con herencia de configuración) y la **creación manual de turnos para walk-ins** (clientes sin cita previa). Afecta §2, §3, §4, §5, §6, §7 y §8.
>
> **Cambios v1.2:** **confirmación automática de reservas por defecto** (elimina la fricción de aceptar turno por turno; la aprobación manual pasa a ser opción configurable); **suscripción cobrada por número de sucursales**; se confirma que un especialista puede pertenecer a varias sucursales pero operar en una sola a la vez. Afecta §5, §6 y §8.
>
> **Cambios v1.3:** **registro retroactivo de walk-ins** (el turno ya ocurrió y se registra después, con horas pasadas y cobro al final); la **validación de citas depende del origen** (reserva pública = estricta hacia adelante; creación interna = relajada, admite pasado). Afecta §5, §6 y §8.
>
> **Cambios v1.4:** se generaliza el **cobro al finalizar el turno** como regla de toda la operación (no solo walk-ins): el precio del agendamiento es estimado y el monto/servicios/pago definitivos se consolidan al completar. Afecta §5 y §8.

---

## 1. Descripción del Problema

En Colombia, la enorme mayoría de salones de belleza y barberías gestionan su operación de forma **manual y fragmentada**. El agendamiento de citas ocurre casi siempre por **WhatsApp** o llamada: el cliente escribe, alguien revisa mentalmente o en una agenda de papel si hay disponibilidad, responde, y a veces la cita se pierde, se duplica o se olvida. No existe una vista de disponibilidad en tiempo real, ni confirmación automática, ni recordatorios, ni trazabilidad de quién atendió qué.

Esta fricción tiene tres consecuencias directas: **pérdida de citas** (mensajes no respondidos a tiempo), **ausentismo** (el cliente no recibe recordatorio y no llega), y **carga operativa** sobre el dueño o el recepcionista, que dedican horas a coordinar manualmente algo que debería ser automático.

Existió un primer intento de resolver la gestión interna: **NOVA**, un software a la medida construido para una peluquería específica. NOVA resolvió bien la parte administrativa (agenda interna, inventario, nómina, contabilidad, reportes), pero arrastra tres limitaciones de fondo que impiden convertirlo en producto:

1. **Es mono-tenant y a la medida.** Toda la lógica financiera, las comisiones, las categorías y los flujos están cableados a las reglas de *un* salón. No hay forma de que otro negocio lo adopte sin reescribir reglas.
2. **Es rígido.** Muchas funcionalidades (cierre quincenal/mensual, partición por especialista, inventario, deducciones, comisiones bancarias) están siempre activas y con porcentajes fijos. Un negocio que no maneja inventario, o que no quiere repartir por especialista, no puede "apagar" eso: el sistema le impone una operación que no es la suya.
3. **No incluye al cliente final.** Todo el agendamiento sigue dependiendo de que alguien del salón teclee la cita. La fricción del WhatsApp permanece intacta porque el cliente nunca toca el sistema.

**Orkalis** nace para resolver simultáneamente los tres niveles: digitalizar la gestión interna (heredando y mejorando lo bueno de NOVA), **eliminar la fricción del agendamiento dándole al cliente final una forma directa de reservar**, y hacerlo todo **configurable y multi-negocio**, de modo que cada salón o barbería adapte la plataforma a *su* operación —y no al revés— bajo un modelo SaaS.

---

## 2. Objetivo del Sistema

Orkalis permitirá:

- **Operar como plataforma SaaS multi-tenant**, donde cada salón o barbería suscrito gestiona sus propios datos de forma aislada y segura.
- **Soportar negocios con una o varias sucursales**, permitiendo al administrador ver y operar cada sucursal por separado, configurarla a su gusto, o **heredar** la configuración del negocio o de otra sucursal.
- **Ofrecer dos perfiles de negocio** (salón de belleza / barbería) que ajustan terminología, categorías y módulos por defecto, sin que ello implique sistemas distintos.
- **Permitir al cliente final agendar su propia cita** desde un enlace público, sin necesidad de crear cuenta ni de pasar por WhatsApp: escoge especialista, ve sus franjas libres en tiempo real y reserva.
- **Permitir al administrador o al especialista crear turnos manualmente** para clientes que llegan sin cita previa (*walk-ins*), atendiéndolos en el momento sin pasar por el flujo de reserva pública.
- **Dar al especialista una app de auto-servicio** estilo "conductor": ve sus citas del día y la semana, recibe automáticamente las nuevas reservas, e inicia, completa o cancela cada turno desde un flujo en vivo.
- **Permitir al administrador configurar la plataforma a su medida**: activar o desactivar módulos completos (inventario, cierre de período, partición por especialista, comisiones, etc.) y ajustar parámetros financieros sin tocar código.
- **Gestionar la operación interna completa**: agenda, clientes (CRM), inventario, catálogo de servicios, equipo de profesionales, ventas de productos, gastos, liquidaciones y reportes.
- **Calcular automáticamente la repartición del dinero** de cada servicio y venta según reglas configurables por negocio.
- **Notificar y recordar** citas a clientes y especialistas para reducir el ausentismo.
- **Generar reportes y exportaciones** (CSV/PDF) financieras, de liquidación y operativas.
- **Archivar y reiniciar períodos** (quincenal/mensual) de forma opcional, preservando el histórico.

---

## 3. Stakeholders

| Stakeholder | Tipo | Poder | Interés | Estrategia |
|---|---|---|---|---|
| **Equipo Orkalis** (desarrollo / operación de la plataforma) | Interno | Alto | Alto | Gestionar activamente: dueños de la visión y la arquitectura |
| **Dueño / Administrador del salón** (cliente suscrito) | Externo | Alto | Alto | Gestionar activamente: es quien paga la suscripción y configura su negocio |
| **Especialista / Barbero** | Externo | Medio | Alto | Mantener satisfecho e informado: su adopción diaria define el éxito real |
| **Cliente final** (quien agenda y recibe el servicio) | Externo | Bajo | Alto | Mantener informado: experiencia de reserva sin fricción es el diferenciador |
| **Recepcionista / Cajero** (rol operativo del salón, si existe) | Externo | Medio | Alto | Mantener satisfecho: opera la agenda y el cobro en el día a día |
| **Proveedor de pagos de suscripción** (pasarela) | Externo | Medio | Medio | Monitorear: dependencia para el cobro del SaaS |
| **Proveedor de notificaciones** (SMS / email / push) | Externo | Bajo | Medio | Monitorear: habilita recordatorios y confirmaciones |
| **Proveedor de infraestructura / hosting** | Externo | Medio | Bajo | Monitorear: SLA y costos operativos |

> **Nota sobre sucursales:** en negocios multi-sucursal, el administrador puede operar con visibilidad **acotada a una sucursal** o consolidada a nivel de negocio. La v1 mantiene un único rol de administrador con alcance configurable por sucursal; un rol dedicado de *encargado de sucursal* queda fuera de la v1 (ver §5).

---

## 4. Problemas Actuales

Problemas concretos que existen hoy, antes de Orkalis:

- El cliente debe agendar por **WhatsApp o llamada**; no hay autoservicio ni visibilidad de disponibilidad real.
- Las citas se **pierden, duplican u olvidan** por depender de coordinación manual.
- **Alto ausentismo** por falta de recordatorios automáticos.
- El especialista **no tiene una vista propia** y confiable de su agenda; depende de que le avisen.
- No hay **flujo en vivo del turno** (iniciar, completar tras el pago, cancelar por inasistencia) con trazabilidad.
- NOVA es **mono-salón**: ningún otro negocio puede adoptarlo sin reescribir su lógica.
- NOVA es **rígido**: módulos y porcentajes están siempre activos y fijos; no se adaptan a negocios con operaciones distintas (sin inventario, sin partición por especialista, sin cierre de mes, etc.).
- La distinción **salón vs. barbería** no existe; la terminología y las categorías están cableadas a un solo tipo de negocio.
- Los **clientes sin cita previa (walk-ins)** no se registran de forma ágil; su atención queda fuera de la trazabilidad o se anota improvisadamente.
- Los negocios con **varias sucursales** no pueden gestionarse de forma centralizada: cada local opera como una isla, sin visión consolidada ni configuración compartida o diferenciada por sucursal.
- No hay **modelo de suscripción ni aislamiento de datos** entre negocios: imposible operar como producto comercial.

---

## 5. Alcance

> Filosofía de la v1: **robusta**. Se prioriza una base bien cimentada y completa por encima de la velocidad de salida, sin atajos en seguridad, multi-tenancy ni en la máquina de estados del agendamiento.

### Incluye (v1.0)

**Plataforma y configuración**
- Arquitectura **multi-tenant** con aislamiento de datos por negocio.
- Modelo **multi-sucursal**: un negocio agrupa una o varias sucursales; los datos operativos (citas, equipo, inventario, ventas) se asocian a una sucursal. El negocio de una sola sede es el caso particular de una única sucursal.
- **Herencia de configuración**: cada sucursal puede usar la configuración por defecto del negocio, **sobrescribirla** localmente, o **heredar/clonar** la de otra sucursal. La resolución sigue una cadena: *valor de sistema → valor del negocio → valor de la sucursal*.
- **Vista consolidada y por sucursal**: el administrador puede filtrar agenda, reportes y finanzas por una sucursal específica o ver el negocio completo.
- **Onboarding** del salón: alta de negocio, selección de perfil (salón / barbería), alta de la(s) sucursal(es), configuración inicial.
- **Módulo de configurabilidad**: activar/desactivar módulos y ajustar parámetros financieros por tenant **y por sucursal**, con valores por defecto sensatos según el perfil.
- **Suscripción SaaS** con al menos un plan y control de estado de la cuenta (activa / suspendida).

**Agendamiento (núcleo diferenciador)**
- **Enlace público de reserva** por sucursal (y por especialista dentro de ella), **sin cuenta** para el cliente final; identificación por teléfono. En negocios multi-sucursal, un enlace de negocio permite al cliente elegir primero la sucursal.
- Visualización de **disponibilidad en tiempo real** por especialista y servicio.
- **Reserva con control de concurrencia** (bloqueo temporal de franja para evitar doble reserva).
- **Confirmación automática por defecto**: la reserva del enlace público entra directamente como *confirmada* en la agenda del especialista, sin requerir aceptación manual turno por turno. La **aprobación manual** es una opción que el administrador puede activar por sucursal/especialista, no el comportamiento por defecto.
- **Confirmación y recordatorios** automáticos al cliente.
- **Creación manual de turnos (walk-ins)**: el administrador o el especialista pueden registrar a un cliente sin cita previa en dos modos: **en el momento** (corre el flujo en vivo) o **retroactivo** (el servicio ya terminó y se registra después, con horas pasadas, directamente como `completada`). La cita queda marcada con su **origen** (reserva pública / creación interna) para trazabilidad y reportes. En walk-ins el **precio y el método de pago se capturan al completar/registrar**, no al crear, porque el cobro ocurre al final.
- **El cobro se registra al finalizar el turno** (regla general, no solo para walk-ins): la reserva guarda un **precio estimado** y los servicios previstos, pero el **monto final, los servicios efectivamente realizados y el método de pago se capturan al completar** la cita. Marcar una cita como `completada` exige registrar el pago.
- **App del especialista**: agenda diaria/semanal, recepción automática de nuevas citas y **flujo de turno en vivo** (iniciar → en progreso → completar tras pago / cancelar por inasistencia).
- Gestión interna de citas por el administrador/recepcionista (heredada y mejorada de NOVA).

**Operación interna (heredada y mejorada de NOVA)**
- Clientes / CRM con historial y borrado lógico.
- Catálogo de servicios con repartición configurable.
- Inventario (servicio / venta) con movimientos y valoración — **módulo desactivable**.
- Equipo de profesionales, disponibilidad y liquidaciones — **partición por especialista desactivable**.
- Ventas de productos con comisión configurable.
- Contabilidad: ingresos, gastos fijos/variables, ganancia neta y margen.
- Reportes y gráficos; exportación CSV/PDF.
- Cierre de período (quincenal/mensual) y archivado — **módulo desactivable**.

**Transversal**
- Autenticación y RBAC (admin, especialista, recepcionista) construidos a la medida.
- Notificaciones multicanal (al menos uno: SMS/email/push).
- Interfaz responsive alineada al **design system de Orkalis** (definido en Claude Design).
- Localización Colombia: moneda COP, idioma español.

### No Incluye (fuera de alcance v1.0)

- **Apps móviles nativas** (iOS/Android). La v1 es web responsive; las nativas quedan para una fase posterior.
- **Multi-país / multi-moneda / multi-idioma.** v1 es Colombia / COP / español.
- **Marketplace público** que liste y compare salones entre sí (Orkalis no es un directorio de descubrimiento en v1).
- **Pagos del servicio en línea** por el cliente final (el cobro del servicio sigue siendo presencial; Orkalis cobra la *suscripción*, no las citas, en v1).
- **Programas de fidelización / puntos / cupones** automatizados.
- **IA de recomendación** de horarios, precios o asignación de especialista.
- **Integración nativa con WhatsApp Business API** (puede evaluarse como canal de notificación futuro).
- **Facturación electrónica DIAN** del negocio (se contempla como restricción a vigilar, no como entrega v1).
- **Roles avanzados y permisos granulares por recurso** más allá del RBAC base.
- **Rol dedicado de "encargado de sucursal"** con su propio panel y permisos: en v1 el administrador asume la gestión por sucursal con alcance configurable; este rol se evalúa para una fase posterior.

---

## 6. Suposiciones

- Cada negocio (tenant) opera de forma **independiente**; no hay datos compartidos entre tenants salvo los de la plataforma.
- Un negocio tiene **una o más sucursales**; el caso de una sola sede se modela como una única sucursal (no es un caso especial aparte).
- Un especialista pertenece a **una o varias sucursales**, pero su agenda y disponibilidad se gestionan **por sucursal** (atiende en una sede a la vez en un momento dado).
- La **suscripción se administra a nivel de negocio y se cobra según el número de sucursales activas**; los tramos/planes concretos se definirán en el ADR de facturación, pero la dimensión de cobro (por sucursal) está fijada.
- Un **walk-in** puede ser un cliente nuevo o existente; su registro es ágil y la captura de datos (teléfono, nombre) es opcional pero recomendada para trazabilidad.
- Un walk-in puede registrarse **después de que el servicio ya terminó** (horas en el pasado); en ese caso no aplican las validaciones de disponibilidad futura ni el bloqueo de concurrencia, solo chequeos de sanidad (fin ≥ inicio, dentro del período contable abierto, especialista y sucursal válidos).
- El cliente final tiene un **teléfono móvil** y acceso a un navegador para abrir el enlace público; no se le exige instalar nada ni crear cuenta.
- La **identificación del cliente por número de teléfono** es suficiente para deduplicar y enviar recordatorios; se asume una verificación ligera (p. ej. código por SMS) para reducir reservas falsas, pero **sin** crear una cuenta persistente.
- El especialista cuenta con un dispositivo (móvil o tablet) durante su jornada para operar su agenda en vivo.
- El **cobro del servicio es presencial**; el sistema registra el método de pago pero no procesa la transacción del servicio.
- El negocio define sus propias reglas de repartición y comisiones; Orkalis ofrece **valores por defecto**, no impone porcentajes.
- Existe conectividad a internet razonablemente estable en el punto de venta.
- El design system ya está definido en Claude Design y será la **fuente de verdad visual**.

---

## 7. Restricciones

**Técnicas**
- **Backend propio en Node.js + NestJS** (decisión tomada; reemplaza el BaaS de Supabase usado en NOVA).
- Arquitectura **multi-tenant** obligatoria con aislamiento de datos verificable.
- **Aislamiento de datos en dos niveles**: por negocio (tenant) y, dentro de este, por sucursal. Toda consulta operativa debe poder acotarse a una sucursal sin filtración entre sedes ni entre negocios.
- **Resolución de configuración con herencia** (sistema → negocio → sucursal) implementada de forma consistente para parámetros y banderas de módulo.
- **Auth y RBAC construidos a la medida** (sin depender de un proveedor de Auth gestionado como en NOVA).
- Los **endpoints públicos de reserva** deben proteger contra abuso (rate limiting, verificación ligera, control de concurrencia de franjas).
- Interfaz **responsive** y conforme al **design system de Orkalis** (Claude Design).

**De negocio**
- Modelo **SaaS por suscripción**: el estado de pago del tenant condiciona el acceso.
- La **configurabilidad es un requisito, no una opción**: el sistema debe poder operar con módulos apagados (sin inventario, sin partición, sin cierre de período) sin degradarse.
- Dos perfiles de vertical (**salón / barbería**) que se eligen al suscribirse y solo cambian la cara hacia el cliente (terminología, categorías y defaults), no la base.

**De localización / legales**
- Moneda **COP**, formato `es-CO`, textos en **español**.
- Manejo de **datos personales de clientes finales** sujeto a la Ley 1581 de 2012 (Habeas Data, Colombia): consentimiento y tratamiento adecuado de teléfono/datos de contacto. *(A vigilar; no se implementa flujo legal completo en v1 pero el diseño no debe impedirlo.)*

**De recursos**
- A confirmar el tamaño del equipo y el cronograma; condicionarán el plan de releases por fases dentro del alcance v1.

---

## 8. Notas de transición NOVA → Orkalis

Tres refinamientos de diseño ya identificados respecto a NOVA, que se formalizarán en las Historias de Usuario, los ADRs y el diagrama de estados:

1. **Máquina de estados de citas ampliada.** Los 4 estados de NOVA (`programada/completada/cancelada/no_asistió`) no cubren el flujo "en vivo" del especialista ni el agendamiento público. Se prevé: `confirmada → (cliente registrado/en sitio) → en_progreso → completada` con ramas `cancelada` y `no_asistió`, y el pago como *guard* para completar. Por defecto, la reserva pública entra **directo en `confirmada`** (sin aceptación manual); el estado `solicitada` (pendiente de aprobación) solo existe cuando el negocio activa la aprobación manual. Las citas llevarán además un **origen** (`agendamiento_publico` / `creacion_interna`): un walk-in puede entrar directamente en un estado avanzado (p. ej. `en_progreso`) sin pasar por `solicitada` ni `confirmada`.
2. **Concurrencia en el agendamiento público.** Capacidad nueva sin precedente en NOVA: reserva temporal de franja, ventanas de disponibilidad por especialista, y reglas de antelación/cancelación. Como la confirmación es **automática** (no hay portero humano), la exactitud de la disponibilidad y el bloqueo de franja son la **única** defensa contra el sobre-agendamiento; su robustez es crítica.
3. **Configurabilidad como módulo de primera clase.** Sustituye las banderas dispersas de NOVA por un sistema de *feature flags por tenant* + perfil de vertical, con defaults sensatos.
4. **Jerarquía negocio → sucursal con herencia de configuración.** NOVA era mono-sede. Orkalis introduce un nivel intermedio: el dato operativo pertenece a una sucursal, y la configuración se resuelve por una cadena de herencia. Esto amerita un **ADR dedicado** (modelo de tenencia y herencia de configuración) y atraviesa el modelo de datos, el RBAC y los reportes.
5. **Cero fricción de confirmación para el personal.** Principio de producto: el equipo del salón no debería tener que aceptar reservas una por una mientras atiende. Por eso la confirmación es automática por defecto y el especialista solo interviene en el momento del servicio. La aprobación manual existe, pero es la excepción configurable, no la norma.
6. **Validación de citas dependiente del origen.** No todas las citas se validan igual. La **reserva pública** exige tiempo futuro, franja libre y candado de concurrencia. La **creación interna (walk-in)** relaja esas reglas: admite turnos en el pasado (registro retroactivo de un servicio ya terminado, creado directamente como `completada`), sin candado de concurrencia, con cobro capturado al final. La capa de validación debe ramificar por `origen` en lugar de aplicar un único conjunto de reglas; esto se reflejará en el ADR de agendamiento y en el diagrama de estados.
7. **El cobro ocurre al finalizar el turno (regla general).** En la operación real casi siempre se cobra al final, y el cliente puede sumar tratamientos durante la atención. Por eso el precio fijado al agendar es solo una **estimación**: el **valor neto definitivo** (servicios realmente realizados + productos) y el método de pago se consolidan al completar, y el **cálculo financiero** (repartición profesional/salón, comisiones, deducciones) se ejecuta sobre ese cierre, no sobre la estimación. El pago registrado es el *guard* que habilita el estado `completada` (ver nota 1).

---

*Documento inicial de la fase de arquitectura de Orkalis. Es el primer artefacto: alimenta las Historias de Usuario (un actor por stakeholder externo), el SRS (cada problema y objetivo deriva en requerimientos) y los ADRs (cada restricción condiciona una decisión).*
