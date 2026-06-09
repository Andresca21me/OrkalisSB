# Historias de Usuario: Orkalis

**Proyecto:** Orkalis — Plataforma SaaS de Gestión para Salones y Barberías
**Versión:** 1.0
**Fecha:** 2026-06-08
**Estado:** Borrador
**Documento previo:** 01 — Definición del Problema (v1.4)

---

## 1. Introducción

Este documento captura las necesidades de los usuarios de Orkalis expresadas como historias de usuario, agrupadas por actor. Cada historia incluye criterios de aceptación en Gherkin (Dado/Cuando/Entonces) y alimentará directamente los requerimientos funcionales del SRS. Las historias evitan detalles de implementación; las decisiones técnicas se documentan aparte en los ADRs.

Las prioridades siguen el criterio: **Alta** (funcionalidad core), **Media** (mejora significativa), **Baja** (deseable / fase posterior).

## 2. Actores

- **Administrador (ADM):** dueño o gerente del negocio suscrito. Configura el negocio y sus sucursales, gestiona equipo, servicios, finanzas y reportes. Tiene visibilidad consolidada o por sucursal.
- **Especialista / Barbero (ESP):** quien presta el servicio. Opera su agenda en vivo, recibe citas automáticamente y ejecuta el flujo del turno (iniciar, completar tras el cobro, cancelar).
- **Cliente final (CLI):** persona que reserva y recibe el servicio. Agenda desde el enlace público sin crear cuenta.
- **Recepcionista / Cajero (REC):** rol operativo opcional del negocio. Gestiona la agenda y registra atenciones y cobros en el día a día.
- **Operador de Plataforma (PLT):** equipo de Orkalis. Administra el ciclo de vida de la suscripción y el estado de las cuentas.

---

## 3. Historias de Usuario

### 3.1 Administrador (ADM)

#### HU-ADM-001

| Campo | Detalle |
|---|---|
| **Título** | Alta y onboarding del negocio |
| **Descripción** | **Como** administrador, **quiero** dar de alta mi negocio eligiendo su perfil (salón de belleza o barbería), **para** que la plataforma adapte terminología, categorías y módulos por defecto a mi tipo de negocio. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Alta exitosa con perfil de barbería
  Dado que tengo una suscripción activa
  Cuando creo mi negocio y selecciono el perfil "Barbería"
  Entonces el sistema crea el negocio con los módulos por defecto del perfil
  Y precarga las categorías y la terminología propias de barbería

Escenario 2: Cambio de perfil tras el alta
  Dado que mi negocio fue creado con perfil "Salón de belleza"
  Cuando cambio el perfil a "Barbería"
  Entonces el sistema ajusta la terminología y los defaults
  Pero conserva los datos operativos ya cargados sin borrarlos
```

#### HU-ADM-002

| Campo | Detalle |
|---|---|
| **Título** | Gestión de sucursales y vista por sucursal |
| **Descripción** | **Como** administrador, **quiero** crear y administrar varias sucursales y alternar entre una vista por sucursal y una consolidada, **para** gestionar negocios multi-sede sin mezclar la información. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Filtrar la operación por una sucursal
  Dado que mi negocio tiene dos sucursales activas
  Cuando selecciono la sucursal "Centro"
  Entonces la agenda, los reportes y las finanzas muestran solo datos de "Centro"

Escenario 2: Vista consolidada del negocio
  Dado que tengo más de una sucursal
  Cuando selecciono la vista "Todo el negocio"
  Entonces los indicadores agregan los datos de todas las sucursales sin filtración entre sedes
```

#### HU-ADM-003

| Campo | Detalle |
|---|---|
| **Título** | Activar y desactivar módulos |
| **Descripción** | **Como** administrador, **quiero** activar o desactivar módulos completos (inventario, partición por especialista, cierre de período, etc.) por negocio o por sucursal, **para** que la plataforma se ajuste a mi operación y no al revés. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Desactivar el módulo de inventario
  Dado que mi negocio no maneja inventario
  Cuando desactivo el módulo "Inventario"
  Entonces la plataforma oculta el inventario y deja de exigir productos en los turnos
  Y los cálculos financieros operan sin el componente de productos

Escenario 2: Configuración por sucursal distinta a la del negocio
  Dado que el negocio tiene el cierre de período activado por defecto
  Cuando desactivo "Cierre de período" solo en la sucursal "Norte"
  Entonces "Norte" opera sin cierre de período
  Pero las demás sucursales conservan el comportamiento del negocio
```

#### HU-ADM-004

| Campo | Detalle |
|---|---|
| **Título** | Configurar parámetros financieros con herencia |
| **Descripción** | **Como** administrador, **quiero** definir parámetros financieros (repartición profesional/salón, deducción administrativa, comisión bancaria, tarifa a cliente profesional) a nivel de negocio o sucursal, con posibilidad de heredar de otra sucursal, **para** reflejar las reglas reales de cada sede. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Sucursal que hereda del negocio
  Dado que el negocio define repartición 60/40
  Cuando creo la sucursal "Sur" sin sobrescribir parámetros
  Entonces "Sur" usa automáticamente la repartición 60/40 del negocio

Escenario 2: Validación de repartición que no suma 100%
  Dado que edito la repartición de una sucursal
  Cuando ingreso 70% profesional y 40% salón
  Entonces el sistema rechaza el guardado
  Y muestra que la suma debe ser exactamente 100%
```

#### HU-ADM-005

| Campo | Detalle |
|---|---|
| **Título** | Gestionar el equipo de especialistas |
| **Descripción** | **Como** administrador, **quiero** dar de alta especialistas, asignarlos a una o varias sucursales y gestionar su disponibilidad, **para** que aparezcan en la agenda y en el enlace público de las sedes correspondientes. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Especialista asignado a dos sucursales
  Dado que doy de alta al barbero "Andrés"
  Cuando lo asigno a las sucursales "Centro" y "Norte"
  Entonces Andrés puede ser reservado en ambas sedes
  Pero su agenda lo muestra operando en una sola sucursal a la vez

Escenario 2: Baja de un especialista
  Dado que un especialista deja de trabajar en el negocio
  Cuando lo doy de baja
  Entonces deja de aparecer en el enlace público y en nuevas asignaciones
  Pero su historial de servicios y ganancias se conserva (borrado lógico)
```

#### HU-ADM-006

| Campo | Detalle |
|---|---|
| **Título** | Gestionar el catálogo de servicios y su repartición |
| **Descripción** | **Como** administrador, **quiero** crear servicios con precio, duración y una repartición personalizada (por porcentajes o valor fijo al profesional), **para** controlar cómo se divide el dinero de cada servicio. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Servicio con valor fijo para el profesional
  Dado que creo el servicio "Corte clásico"
  Cuando configuro una repartición de valor fijo de $15.000 al profesional
  Entonces al completarse ese servicio el profesional recibe $15.000
  Y el resto se asigna al salón

Escenario 2: Servicio sin repartición personalizada
  Dado que creo un servicio sin activar repartición personalizada
  Cuando se completa ese servicio
  Entonces se aplica la repartición estándar configurada para la sucursal
```

#### HU-ADM-007

| Campo | Detalle |
|---|---|
| **Título** | Gestionar inventario (módulo opcional) |
| **Descripción** | **Como** administrador, **quiero** registrar productos de uso interno y de venta, controlar su stock y recibir alertas de stock bajo, **para** valorar mi inventario y evitar quiebres de existencias. |
| **Prioridad** | Media |

```gherkin
Escenario 1: Alerta de stock bajo
  Dado que un producto tiene stock mínimo de 5 unidades
  Cuando su cantidad disponible baja a 4
  Entonces el sistema lo marca en estado "Stock bajo"
  Y lo incluye en el panel de alertas

Escenario 2: Entrada de compra que genera gasto
  Dado que registro una entrada de stock por compra
  Cuando confirmo la entrada indicando el costo
  Entonces el stock aumenta
  Y opcionalmente se genera un gasto variable asociado a la compra
```

#### HU-ADM-008

| Campo | Detalle |
|---|---|
| **Título** | Registrar y controlar gastos |
| **Descripción** | **Como** administrador, **quiero** registrar gastos fijos y variables por categoría, **para** calcular la ganancia neta y el margen del negocio. |
| **Prioridad** | Media |

```gherkin
Escenario 1: Registro de gasto fijo recurrente
  Dado que tengo un arriendo mensual
  Cuando lo registro como gasto fijo con su monto y frecuencia
  Entonces se incluye en el cálculo de egresos del período

Escenario 2: Eliminación de un gasto fijo
  Dado que un gasto fijo ya no aplica
  Cuando lo elimino
  Entonces se marca como inactivo
  Y deja de afectar períodos futuros sin alterar los históricos
```

#### HU-ADM-009

| Campo | Detalle |
|---|---|
| **Título** | Generar liquidaciones de nómina por especialista |
| **Descripción** | **Como** administrador, **quiero** calcular y exportar la liquidación mensual de cada especialista con su desglose, **para** pagarle de forma transparente. |
| **Prioridad** | Media |

```gherkin
Escenario 1: Liquidación con descuento por transferencia
  Dado que selecciono un especialista y un mes
  Cuando genero la liquidación con pago por transferencia
  Entonces el documento aplica el descuento del 2% sobre las ganancias brutas
  Y muestra el detalle de servicios y ventas con su comisión

Escenario 2: Liquidación con partición por especialista desactivada
  Dado que el negocio tiene desactivada la partición por especialista
  Cuando intento generar una liquidación
  Entonces el módulo de liquidación no está disponible
  Y el sistema lo indica claramente
```

#### HU-ADM-010

| Campo | Detalle |
|---|---|
| **Título** | Ver reportes y exportar |
| **Descripción** | **Como** administrador, **quiero** ver reportes financieros y operativos con gráficos y exportarlos en CSV y PDF, **para** analizar el desempeño del negocio. |
| **Prioridad** | Media |

```gherkin
Escenario 1: Exportación financiera del período
  Dado que selecciono el período "Este mes"
  Cuando exporto el análisis financiero a PDF
  Entonces se genera un documento con ingresos, gastos, ganancia neta y margen

Escenario 2: Período sin datos
  Dado que selecciono un período sin actividad
  Cuando abro los reportes
  Entonces el sistema muestra los indicadores en cero
  Y no genera errores ni gráficos vacíos confusos
```

#### HU-ADM-011

| Campo | Detalle |
|---|---|
| **Título** | Cerrar y archivar período (opcional) |
| **Descripción** | **Como** administrador, **quiero** cerrar un período (quincenal o mensual) archivando su información, **para** reiniciar contadores conservando el histórico. |
| **Prioridad** | Baja |

```gherkin
Escenario 1: Cierre mensual con archivado
  Dado que el módulo de cierre de período está activo
  Cuando ejecuto el cierre del mes
  Entonces los servicios, citas y gastos del mes se archivan en el histórico
  Y los contadores del período se reinician

Escenario 2: Cierre con el módulo desactivado
  Dado que desactivé el cierre de período
  Cuando reviso las opciones del centro financiero
  Entonces la opción de cierre no aparece
  Y la operación continúa de forma acumulada
```

#### HU-ADM-012

| Campo | Detalle |
|---|---|
| **Título** | Supervisar y crear turnos en cualquier sucursal |
| **Descripción** | **Como** administrador, **quiero** ver y crear turnos en cualquiera de mis sucursales (incluidos walk-ins en vivo o retroactivos), **para** apoyar la operación cuando el personal está ocupado. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Crear un turno en una sucursal específica
  Dado que estoy en la vista consolidada del negocio
  Cuando creo un turno y selecciono la sucursal "Norte" y un especialista de esa sede
  Entonces el turno aparece en la agenda de "Norte"

Escenario 2: Crear un turno para un especialista no asignado a la sucursal
  Dado que selecciono la sucursal "Norte"
  Cuando intento asignar un especialista que no pertenece a "Norte"
  Entonces el sistema no lo permite
  Y muestra solo los especialistas válidos de esa sucursal
```

---

### 3.2 Especialista / Barbero (ESP)

#### HU-ESP-001

| Campo | Detalle |
|---|---|
| **Título** | Ver mi agenda del día y la semana |
| **Descripción** | **Como** especialista, **quiero** ver mis citas del día y de la semana ordenadas por hora, **para** organizar mi jornada sin depender de que me avisen. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Agenda del día con citas
  Dado que tengo citas asignadas para hoy
  Cuando abro mi agenda
  Entonces veo mis turnos del día ordenados por hora con cliente, servicio y estado

Escenario 2: Día sin citas
  Dado que no tengo citas para hoy
  Cuando abro mi agenda
  Entonces el sistema indica que no hay turnos programados
```

#### HU-ESP-002

| Campo | Detalle |
|---|---|
| **Título** | Recibir citas automáticamente sin aceptarlas una por una |
| **Descripción** | **Como** especialista, **quiero** que las reservas del enlace público entren directamente en mi agenda ya confirmadas, **para** no perder tiempo aceptando turno por turno mientras atiendo. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Reserva pública confirmada automáticamente
  Dado que la confirmación automática está activa (comportamiento por defecto)
  Cuando un cliente reserva una franja libre conmigo
  Entonces el turno aparece en mi agenda con estado "Confirmada" sin requerir mi aceptación

Escenario 2: Aprobación manual activada
  Dado que el administrador activó la aprobación manual en mi sucursal
  Cuando un cliente reserva una franja
  Entonces el turno entra como "Solicitada"
  Y queda pendiente de aprobación antes de confirmarse
```

#### HU-ESP-003

| Campo | Detalle |
|---|---|
| **Título** | Iniciar un turno en vivo |
| **Descripción** | **Como** especialista, **quiero** iniciar el turno cuando empiezo a atender al cliente, **para** reflejar que está en progreso, al estilo de un viaje en curso. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Inicio de turno
  Dado que tengo un turno confirmado y el cliente llegó
  Cuando marco "Iniciar"
  Entonces el turno pasa a estado "En progreso"

Escenario 2: Intento de iniciar un turno ya finalizado
  Dado que un turno ya está "Completado"
  Cuando intento iniciarlo de nuevo
  Entonces el sistema lo impide
  Y conserva el estado "Completado"
```

#### HU-ESP-004

| Campo | Detalle |
|---|---|
| **Título** | Completar el turno registrando el cobro al final |
| **Descripción** | **Como** especialista, **quiero** completar el turno registrando los servicios realmente realizados y el pago al final, **para** cerrar la atención con el monto correcto. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Completar con cobro
  Dado que el turno está "En progreso"
  Cuando registro los servicios finales y el método de pago y marco "Completar"
  Entonces el turno pasa a "Completado"
  Y el sistema calcula la repartición y comisiones sobre el monto real

Escenario 2: Intento de completar sin registrar el pago
  Dado que el turno está "En progreso"
  Cuando intento marcarlo como "Completado" sin registrar el pago
  Entonces el sistema lo impide
  Y solicita el método de pago como condición para completar
```

#### HU-ESP-005

| Campo | Detalle |
|---|---|
| **Título** | Cancelar o marcar inasistencia |
| **Descripción** | **Como** especialista, **quiero** cancelar un turno o marcarlo como "No asistió" cuando el cliente no llega o hay un inconveniente, **para** mantener mi agenda fiel a la realidad. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Cliente no se presenta
  Dado que un turno confirmado no fue atendido y el cliente no llegó
  Cuando lo marco como "No asistió"
  Entonces el turno cambia a ese estado
  Y libera la franja del registro operativo

Escenario 2: Cancelar un turno ya completado
  Dado que un turno ya fue "Completado"
  Cuando intento cancelarlo
  Entonces el sistema requiere revertir sus efectos (ganancias, stock) de forma controlada
  Y no permite una cancelación que deje datos inconsistentes
```

#### HU-ESP-006

| Campo | Detalle |
|---|---|
| **Título** | Registrar un walk-in en el momento |
| **Descripción** | **Como** especialista, **quiero** crear un turno para un cliente que llegó sin cita y atenderlo de inmediato, **para** no dejar de registrar la atención. *(También disponible para Administrador y Recepcionista.)* |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Walk-in atendido al instante
  Dado que llega un cliente sin cita previa
  Cuando creo un turno marcado como creación interna y lo inicio
  Entonces el turno entra en "En progreso" con origen "Creación interna"
  Y no se le aplica la validación de disponibilidad futura

Escenario 2: Captura mínima de datos del cliente
  Dado que el cliente walk-in no quiere dar sus datos
  Cuando creo el turno sin teléfono ni nombre
  Entonces el sistema permite registrarlo igualmente
  Pero sugiere capturar los datos para trazabilidad
```

#### HU-ESP-007

| Campo | Detalle |
|---|---|
| **Título** | Registrar una atención retroactiva |
| **Descripción** | **Como** especialista, **quiero** registrar un turno que ya ocurrió (con horas pasadas) y cobrar al final, **para** dejar constancia de una atención que terminé sin haberla creado antes. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Registro de un servicio ya finalizado
  Dado que atendí a un cliente y el turno ya terminó
  Cuando creo el turno con horas en el pasado y lo registro como "Completado" con su cobro
  Entonces el sistema lo acepta sin exigir tiempo futuro ni candado de concurrencia
  Y aplica solo chequeos de sanidad (fin ≥ inicio, período abierto, especialista válido)

Escenario 2: Horas inválidas
  Dado que registro una atención retroactiva
  Cuando indico una hora de fin anterior a la hora de inicio
  Entonces el sistema rechaza el registro
  Y explica el error de coherencia de horas
```

#### HU-ESP-008

| Campo | Detalle |
|---|---|
| **Título** | Cambiar mi disponibilidad y sucursal activa |
| **Descripción** | **Como** especialista, **quiero** alternar mi disponibilidad y la sucursal en la que estoy operando, **para** que la agenda y el enlace público reflejen dónde y cuándo pueden reservarme. |
| **Prioridad** | Media |

```gherkin
Escenario 1: Marcarse como ocupado
  Dado que estoy disponible
  Cuando cambio mi estado a "Ocupado"
  Entonces mis franjas dejan de ofrecerse temporalmente en el enlace público

Escenario 2: Cambio de sucursal activa
  Dado que pertenezco a dos sucursales
  Cuando selecciono operar hoy en "Centro"
  Entonces mi agenda y disponibilidad se gestionan para "Centro"
```

#### HU-ESP-009

| Campo | Detalle |
|---|---|
| **Título** | Ver mis ganancias acumuladas |
| **Descripción** | **Como** especialista, **quiero** ver mis ganancias de hoy, la semana y el mes, **para** conocer mi desempeño económico. |
| **Prioridad** | Media |

```gherkin
Escenario 1: Ganancias del día
  Dado que completé varios turnos hoy
  Cuando abro mi resumen de ganancias
  Entonces veo el total de hoy, la semana y el mes, incluyendo comisiones por ventas

Escenario 2: Partición por especialista desactivada
  Dado que el negocio no usa partición por especialista
  Cuando abro mi resumen
  Entonces el sistema no muestra ganancias individuales
  Y lo indica de forma clara
```

---

### 3.3 Cliente final (CLI)

#### HU-CLI-001

| Campo | Detalle |
|---|---|
| **Título** | Abrir el enlace público y elegir sucursal |
| **Descripción** | **Como** cliente, **quiero** abrir el enlace de reservas del negocio y elegir la sucursal, **para** reservar en la sede que me queda mejor. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Selección de sucursal
  Dado que el negocio tiene varias sucursales
  Cuando abro el enlace de negocio
  Entonces puedo elegir la sucursal antes de ver disponibilidad

Escenario 2: Enlace directo a una sucursal
  Dado que abro el enlace específico de la sucursal "Centro"
  Cuando se carga la página
  Entonces veo directamente la disponibilidad de "Centro" sin pedir selección de sede
```

#### HU-CLI-002

| Campo | Detalle |
|---|---|
| **Título** | Elegir especialista y servicio y ver franjas libres |
| **Descripción** | **Como** cliente, **quiero** elegir el especialista y el servicio y ver sus horarios libres en tiempo real, **para** escoger el momento que me conviene. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Disponibilidad en tiempo real
  Dado que elegí al especialista "Andrés" y el servicio "Corte"
  Cuando consulto su disponibilidad
  Entonces veo solo las franjas libres compatibles con la duración del servicio

Escenario 2: Especialista sin disponibilidad
  Dado que el especialista elegido no tiene franjas libres en las fechas mostradas
  Cuando consulto su disponibilidad
  Entonces el sistema lo indica
  Y me ofrece ver otras fechas u otro especialista
```

#### HU-CLI-003

| Campo | Detalle |
|---|---|
| **Título** | Reservar una franja con confirmación inmediata |
| **Descripción** | **Como** cliente, **quiero** reservar una franja y recibir confirmación al instante, **para** tener mi cita asegurada sin escribir por WhatsApp. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Reserva confirmada
  Dado que elegí una franja libre
  Cuando confirmo la reserva
  Entonces la cita queda confirmada de inmediato
  Y recibo una confirmación con los datos del turno

Escenario 2: Franja tomada por otra persona al mismo tiempo (concurrencia)
  Dado que dos clientes intentan la misma franja casi a la vez
  Cuando confirmo después de que la franja fue tomada
  Entonces el sistema me informa que ya no está disponible
  Y me muestra franjas alternativas, sin generar doble reserva
```

#### HU-CLI-004

| Campo | Detalle |
|---|---|
| **Título** | Identificarme por teléfono sin crear cuenta |
| **Descripción** | **Como** cliente, **quiero** identificarme solo con mi número de teléfono mediante una verificación ligera, **para** reservar sin tener que registrarme. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Verificación ligera por código
  Dado que ingreso mi número de teléfono
  Cuando recibo y confirmo el código de verificación
  Entonces puedo completar la reserva sin crear una cuenta

Escenario 2: Código incorrecto
  Dado que ingreso un código de verificación equivocado
  Cuando intento continuar
  Entonces el sistema rechaza la verificación
  Y me permite solicitar un nuevo código
```

#### HU-CLI-005

| Campo | Detalle |
|---|---|
| **Título** | Recibir confirmación y recordatorios |
| **Descripción** | **Como** cliente, **quiero** recibir la confirmación y recordatorios de mi cita, **para** no olvidarla y reducir las inasistencias. |
| **Prioridad** | Media |

```gherkin
Escenario 1: Recordatorio antes de la cita
  Dado que tengo una cita confirmada
  Cuando se acerca la fecha según la regla del negocio
  Entonces recibo un recordatorio por el canal configurado

Escenario 2: Cita cancelada por el negocio
  Dado que el negocio cancela mi cita
  Cuando se produce la cancelación
  Entonces recibo una notificación informándome del cambio
```

#### HU-CLI-006

| Campo | Detalle |
|---|---|
| **Título** | Cancelar o reagendar mi cita |
| **Descripción** | **Como** cliente, **quiero** cancelar o reagendar mi cita desde el mismo enlace, **para** ajustarla si me surge un imprevisto, dentro de las reglas del negocio. |
| **Prioridad** | Media |

```gherkin
Escenario 1: Cancelación dentro del plazo permitido
  Dado que mi cita está dentro del plazo de cancelación permitido
  Cuando solicito cancelarla
  Entonces la cita se cancela y la franja vuelve a quedar disponible

Escenario 2: Cancelación fuera de plazo
  Dado que intento cancelar con menos antelación de la permitida
  Cuando solicito la cancelación
  Entonces el sistema aplica la regla de antelación del negocio
  Y me informa que no es posible cancelar por ese medio
```

---

### 3.4 Recepcionista / Cajero (REC)

#### HU-REC-001

| Campo | Detalle |
|---|---|
| **Título** | Gestionar citas en nombre de los clientes |
| **Descripción** | **Como** recepcionista, **quiero** crear, editar y reasignar citas de la sucursal, **para** apoyar a los clientes que agendan en sitio o por teléfono. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Crear cita para un cliente que llama
  Dado que un cliente solicita una cita por teléfono
  Cuando creo la cita con su especialista y franja libre
  Entonces la cita queda confirmada en la agenda de la sucursal

Escenario 2: Reasignar cita por ausencia del especialista
  Dado que un especialista no podrá atender
  Cuando reasigno sus citas a otro especialista disponible de la misma sucursal
  Entonces las citas quedan reasignadas sin perder su información
```

#### HU-REC-002

| Campo | Detalle |
|---|---|
| **Título** | Registrar walk-in y cobrar al finalizar |
| **Descripción** | **Como** recepcionista, **quiero** registrar walk-ins y procesar el cobro al final del servicio, **para** dejar la atención registrada y cerrar la caja correctamente. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Walk-in con cobro al cierre
  Dado que un cliente fue atendido sin cita previa
  Cuando registro el turno y al final ingreso los servicios realizados y el método de pago
  Entonces el turno queda completado con el monto real cobrado

Escenario 2: Cobro con varios servicios sumados durante la atención
  Dado que durante la atención se agregaron tratamientos
  Cuando registro el cobro final
  Entonces el monto refleja todos los servicios efectivamente realizados
```

#### HU-REC-003

| Campo | Detalle |
|---|---|
| **Título** | Gestionar la agenda del día |
| **Descripción** | **Como** recepcionista, **quiero** ver y administrar la agenda del día de la sucursal, **para** coordinar la operación y los tiempos de atención. |
| **Prioridad** | Media |

```gherkin
Escenario 1: Vista del día por especialista
  Dado que estoy en la sucursal "Centro"
  Cuando abro la agenda del día
  Entonces veo los turnos de todos los especialistas de esa sede ordenados por hora

Escenario 2: Exportar el resumen diario
  Dado que termina la jornada
  Cuando exporto el resumen diario
  Entonces obtengo un PDF con citas, servicios completados e ingresos del día
```

---

### 3.5 Operador de Plataforma (PLT)

#### HU-PLT-001

| Campo | Detalle |
|---|---|
| **Título** | Administrar la suscripción por número de sucursales |
| **Descripción** | **Como** operador de plataforma, **quiero** gestionar la suscripción de cada negocio en función del número de sucursales activas, **para** cobrar de acuerdo con su uso. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Alta de una sucursal adicional
  Dado que un negocio agrega una nueva sucursal
  Cuando la sucursal se activa
  Entonces la suscripción refleja el cobro correspondiente al número de sucursales activas

Escenario 2: Reducción de sucursales
  Dado que un negocio desactiva una sucursal
  Cuando se confirma la baja
  Entonces el cobro se ajusta al nuevo número de sucursales activas
```

#### HU-PLT-002

| Campo | Detalle |
|---|---|
| **Título** | Suspender o reactivar el acceso según el estado de pago |
| **Descripción** | **Como** operador de plataforma, **quiero** suspender o reactivar el acceso de un negocio según su estado de pago, **para** proteger el servicio y permitir la recuperación de cuentas al día. |
| **Prioridad** | Alta |

```gherkin
Escenario 1: Suspensión por falta de pago
  Dado que un negocio tiene la suscripción vencida
  Cuando se marca la cuenta como suspendida
  Entonces sus usuarios ven un aviso de cuenta suspendida al iniciar sesión
  Pero sus datos se conservan íntegros

Escenario 2: Reactivación tras regularizar el pago
  Dado que un negocio suspendido regulariza su pago
  Cuando se reactiva la cuenta
  Entonces sus usuarios recuperan el acceso completo con sus datos intactos
```

---

## 4. Trazabilidad con la Definición del Problema

Las historias derivan directamente de los objetivos y refinamientos del documento 01:

| Refinamiento (Definición del Problema §8) | Historias relacionadas |
|---|---|
| Máquina de estados ampliada | HU-ESP-003, HU-ESP-004, HU-ESP-005 |
| Concurrencia en agendamiento público | HU-CLI-003 |
| Configurabilidad como módulo de primera clase | HU-ADM-003, HU-ADM-009, HU-ESP-009, HU-ADM-011 |
| Jerarquía negocio → sucursal con herencia | HU-ADM-002, HU-ADM-004, HU-ADM-005, HU-PLT-001 |
| Cero fricción de confirmación | HU-ESP-002 |
| Validación dependiente del origen | HU-ESP-006, HU-ESP-007 |
| Cobro al finalizar (regla general) | HU-ESP-004, HU-REC-002 |

---

*Documento de Historias de Usuario. Alimenta el SRS (cada historia deriva en uno o más requerimientos funcionales) y se complementa con los ADRs (decisiones técnicas) y los diagramas (estados de la cita, secuencia del agendamiento, ER).*
