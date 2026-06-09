# Registro de Decisiones de Arquitectura (ADRs): Orkalis

**Proyecto:** Orkalis — Plataforma SaaS de Gestión para Salones y Barberías
**Versión:** 1.0
**Fecha:** 2026-06-08
**Estado:** Borrador
**Documentos previos:** 01 — Definición del Problema (v1.4) · 02 — Historias de Usuario (v1.0)

> Documento único que consolida todas las decisiones de arquitectura. Cada ADR es atómico (una decisión) y se numera secuencialmente. Un ADR no se borra: si cambia, se marca como *Reemplazado por ADR-NNN*. El stack base (TypeScript de extremo a extremo: **NestJS + React + PostgreSQL**) queda formalizado en el **ADR-000**.

## Índice

| ADR | Título | Estado |
|---|---|---|
| **ADR-000** | Stack tecnológico principal (TypeScript: NestJS + React + PostgreSQL) | Aceptado |
| **ADR-001** | Estrategia de aislamiento multi-tenant y jerarquía negocio → sucursal | Propuesto |
| **ADR-002** | Herencia de configuración (sistema → negocio → sucursal) | Propuesto |
| **ADR-003** | Autenticación y RBAC con contexto de tenant | Propuesto |
| **ADR-004** | Persistencia y ORM sobre PostgreSQL (RLS y migraciones) | Propuesto |
| **ADR-005** | Modelo de agendamiento: máquina de estados y control de concurrencia | Propuesto |
| **ADR-006** | Motor de cálculo financiero | Propuesto |
| **ADR-007** | Canal de notificaciones | Propuesto |
| **ADR-008** | Estructura de repositorio y estrategia de despliegue/CI-CD | Propuesto |

---

## ADR-000: Stack tecnológico principal (TypeScript: NestJS + React + PostgreSQL)

Estado: Aceptado
Fecha: 2026-06-08

---

### Contexto

Orkalis se reconstruye desde cero como SaaS multi-tenant robusto, dejando atrás el enfoque a la medida de NOVA, que se apoyaba en un BaaS (Supabase) con la lógica de negocio repartida entre el cliente y funciones/triggers de PostgreSQL. Para Orkalis se decidió un **backend propio** que aloje de forma explícita la lógica de negocio crítica: la máquina de estados del agendamiento, la validación por origen, el motor de cálculo financiero, el RBAC con contexto de tenant (ADR-001) y la resolución de configuración (ADR-002).

Esta decisión del *stack principal* condiciona todas las demás: el lenguaje, el framework de backend, el de frontend y el motor de datos. El frontend hereda el ecosistema de NOVA (React + TypeScript) y el **design system ya está definido en Claude Design**, que produce componentes orientados a ese ecosistema. La prioridad de la v1 es robustez, mantenibilidad y alineación con principios SOLID; el equipo es pequeño, por lo que la **cohesión tecnológica** (menos lenguajes, tipos compartidos) tiene alto valor.

### Problema

¿Qué stack tecnológico principal adopta Orkalis para backend, frontend y persistencia, equilibrando control sobre la lógica de negocio, productividad de un equipo pequeño, mantenibilidad a largo plazo y alineación con la arquitectura multi-tenant ya decidida?

### Opciones Consideradas

#### Opción 1: TypeScript de extremo a extremo — NestJS + React + PostgreSQL

**Descripción:** Backend en **NestJS** (Node.js + TypeScript), frontend en **React + TypeScript**, datos en **PostgreSQL**. Un solo lenguaje en toda la plataforma, con un paquete de **tipos/DTOs compartidos** entre front y back.

**Ventajas:**
- Un solo lenguaje (TypeScript) en todo el stack: menos cambio de contexto, tipos compartidos front-back, contratación más simple.
- NestJS es **opinado y modular** (módulos, inyección de dependencias, guards, interceptors), lo que encaja de forma natural con SOLID y con el `TenantContext`/RLS del ADR-001.
- React reutiliza lo que ya funcionaba en NOVA y es el destino del design system de Claude Design.
- PostgreSQL aporta integridad relacional para datos financieros, **RLS** (requerida por el ADR-001), soporte JSON (servicios múltiples por cita, overrides de configuración) y madurez.
- Excelente historia de pruebas en NestJS (unitarias y e2e).

**Desventajas:**
- Hay que construir lo que el BaaS daba "gratis" (auth, infraestructura, despliegue, operación).
- Node es de un solo hilo: tareas intensivas en CPU (generación de PDF, reportes pesados) requieren delegarse a *workers*/colas.

#### Opción 2: Backend en otro ecosistema (Java/Spring Boot o .NET) + React + PostgreSQL

**Descripción:** Frontend React, pero backend en un lenguaje fuertemente tipado de ecosistema "enterprise".

**Ventajas:**
- Plataformas muy maduras, fuertemente tipadas y con tooling robusto.
- Buen rendimiento en cargas concurrentes y multihilo nativo.

**Desventajas:**
- **Dos lenguajes** en el equipo: sin tipos compartidos, más fricción para un equipo pequeño.
- Mayor verbosidad y curva; más pesado para iterar rápido en una v1.
- No aprovecha la herencia React/TS de NOVA en el lado servidor.

#### Opción 3: Continuar con BaaS (Supabase) o un meta-framework full-stack (Next.js)

**Descripción:** Mantener Supabase como en NOVA, o concentrar todo en un meta-framework full-stack (Next.js con server actions), reduciendo el backend propio.

**Ventajas:**
- Velocidad inicial alta: auth, API y realtime listos.
- Menos infraestructura que operar al principio.

**Desventajas:**
- Es justo el modelo del que Orkalis decidió salir: **poco control** sobre la lógica de negocio crítica y riesgo de *lock-in*.
- La lógica compleja (máquina de estados, motor financiero, RBAC por tenant) queda incómoda en triggers/funciones o en *server actions* difusas.
- Cuesta imponer una arquitectura por capas clara y verificable a largo plazo.

### Decisión

Se adopta la **Opción 1: TypeScript de extremo a extremo con NestJS (backend), React (frontend) y PostgreSQL (datos)**. La decisión del backend propio en NestJS fue tomada con el responsable del producto; este ADR la formaliza junto con el frontend y el motor de datos. Se contempla un **paquete de tipos/contratos compartidos** entre front y back, y la delegación de tareas intensivas (PDF, reportes) a procesos en segundo plano.

El **ORM/acceso a datos concreto** (p. ej. Prisma, TypeORM o Drizzle) y la **estructura de repositorio** (monorepo vs. multi-repo) se deciden en ADRs dedicados, con el requisito de que el ORM permita SQL crudo y sea compatible con RLS y el scoping de tenant del ADR-001.

### Justificación

Para un equipo pequeño que prioriza robustez y mantenibilidad, la **cohesión de un solo lenguaje** y un framework opinado que empuja hacia SOLID superan a las alternativas. NestJS encaja con piezas que ya decidimos (guards/interceptors para el `TenantContext`, modularidad para separar agendamiento, finanzas, configuración) y PostgreSQL es condición necesaria del ADR-001 (RLS). La Opción 2 fragmenta el lenguaje sin beneficio decisivo para esta escala; la Opción 3 reintroduce exactamente las limitaciones de control que motivaron reconstruir Orkalis. El costo de "construir lo que el BaaS regalaba" es un compromiso aceptado a cambio de control y ausencia de *lock-in* sobre la lógica de negocio.

### Consecuencias

**Positivas:**
- Cohesión y tipos compartidos en todo el stack; menor fricción para el equipo.
- Control total sobre auth, RBAC, estados y motor financiero, sin *lock-in*.
- Framework alineado con SOLID y con la arquitectura multi-tenant ya decidida.
- PostgreSQL habilita RLS, integridad financiera y JSON donde conviene.

**Negativas (compromisos aceptados):**
- Más superficie por construir y operar: auth, infraestructura, CI/CD, observabilidad.
- Necesidad de DevOps mínimo (hosting, despliegue, respaldos).
- Las tareas CPU-intensivas exigen *workers*/colas para no bloquear el hilo de Node.

### Impacto en el sistema

- **Fundamento de todos los ADRs siguientes**: auth/RBAC, persistencia/ORM, despliegue y agendamiento se construyen sobre este stack.
- **Estructura del proyecto**: habilita un paquete de tipos/contratos compartidos; la organización (monorepo) se define en un ADR de arquitectura/estructura.
- **Operación**: introduce la necesidad de pipeline CI/CD, hosting y estrategia de respaldos como temas propios.
- **Rendimiento**: define el patrón de *workers*/colas para PDF y reportes pesados.

### ADRs relacionados

- ADR-001: Aislamiento multi-tenant (requiere PostgreSQL + RLS y guards de NestJS).
- ADR-002: Herencia de configuración (servicio y caché en NestJS).
- ADR (futuro): Persistencia y ORM sobre PostgreSQL.
- ADR (futuro): Autenticación y RBAC con contexto de tenant.
- ADR (futuro): Estructura de repositorio y estrategia de despliegue.

---

## ADR-001: Estrategia de aislamiento multi-tenant y jerarquía negocio → sucursal

Estado: Propuesto
Fecha: 2026-06-08

---

### Contexto

Orkalis es una plataforma **SaaS multi-tenant** dirigida al mercado colombiano de salones de belleza y barberías: muchos negocios pequeños, alto volumen de cuentas y un ingreso por cuenta (ARPU) relativamente bajo. Cada negocio suscrito (el *tenant*) debe ver y operar únicamente sus propios datos. Dentro de un negocio existe un segundo nivel: las **sucursales**. Los datos operativos (citas, atenciones, inventario, ventas, gastos, disponibilidad) pertenecen a una sucursal, mientras que el administrador necesita tanto una vista por sucursal como una vista consolidada del negocio. La suscripción se **cobra por número de sucursales activas**.

El backend será propio en **Node.js + NestJS** sobre **PostgreSQL** (premisa de este ADR, a formalizar en el ADR de persistencia). La v1 prioriza robustez: el aislamiento de datos debe ser **verificable**, no solo confiado al cuidado del desarrollador. El sistema debe permitir reportes consolidados dentro de un negocio y analítica a nivel de plataforma, y debe escalar a un número alto de tenants sin que el costo operativo por tenant se dispare.

Restricciones relevantes (de la Definición del Problema): aislamiento en dos niveles (negocio y sucursal); manejo de datos personales de clientes finales bajo la Ley 1581 de 2012; onboarding ágil de nuevos negocios; y un equipo que no puede asumir una operación de base de datos pesada por cada cliente.

### Problema

¿Qué modelo de aislamiento de datos adopta Orkalis para separar la información entre negocios (tenants) y acotarla por sucursal, equilibrando seguridad, costo operativo, velocidad de onboarding, capacidad de consolidación y crecimiento?

Aspectos a resolver:
- Cómo se separan los datos entre tenants y cómo se acotan por sucursal.
- Cómo se garantiza que ninguna consulta filtre datos de otro negocio o de otra sucursal.
- Cómo se hacen migraciones, respaldos y analítica sin un costo desproporcionado.
- Cómo se modela la jerarquía negocio → sucursal y la pertenencia de los especialistas.

### Opciones Consideradas

#### Opción 1: Base de datos y esquema compartidos, con discriminador por columna

**Descripción:** Una sola base de datos y un solo esquema. Cada tabla lleva una columna `negocio_id` (tenant) y, en las tablas operativas, también `sucursal_id`. El aislamiento se aplica en la capa de aplicación (un contexto de tenant por petición que inyecta el filtro) reforzado con **Row-Level Security (RLS)** de PostgreSQL como defensa en profundidad.

**Ventajas:**
- Costo operativo mínimo por tenant: una sola base, un solo esquema, una sola ruta de migración.
- Onboarding instantáneo: dar de alta un negocio es insertar filas, no aprovisionar infraestructura.
- Consolidación y analítica triviales: agregar por `negocio_id` o por plataforma es una consulta normal.
- Escala bien a miles de tenants pequeños.

**Desventajas:**
- Aislamiento lógico, no físico: un filtro olvidado puede filtrar datos (se mitiga con RLS + repositorio base que obliga el scope + pruebas automatizadas).
- Riesgo de "vecino ruidoso" (un negocio muy activo afecta el rendimiento común); se mitiga con índices y, más adelante, cuotas.
- Tablas grandes compartidas; exige buena indexación por `(negocio_id, sucursal_id)`.

#### Opción 2: Esquema por tenant (schema-per-tenant)

**Descripción:** Una sola base de datos PostgreSQL, pero un **esquema** por negocio. La sucursal sigue siendo una columna dentro de las tablas del esquema.

**Ventajas:**
- Aislamiento más fuerte que el compartido: cada negocio vive en su propio espacio de nombres.
- Respaldos y exportación por negocio más naturales.

**Desventajas:**
- Las migraciones se multiplican por el número de esquemas; con muchos tenants se vuelve lento y frágil.
- La analítica entre tenants exige recorrer N esquemas (consultas cruzadas incómodas).
- PostgreSQL no está pensado para decenas de miles de esquemas; el catálogo se degrada.
- Onboarding más pesado (crear y migrar un esquema por alta).

#### Opción 3: Base de datos por tenant (database-per-tenant)

**Descripción:** Una base de datos física independiente por negocio.

**Ventajas:**
- Aislamiento físico máximo; menor radio de impacto ante incidentes.
- Cuotas y rendimiento por tenant claros; encaja con clientes "enterprise".

**Desventajas:**
- Costo e infraestructura por tenant muy altos; inviable para un mercado de muchos negocios pequeños y ARPU bajo.
- Operación compleja: conexiones, migraciones, respaldos y monitoreo por base.
- Onboarding lento (aprovisionar una base por cada salón que se suscribe).
- Analítica de plataforma muy costosa.

### Decisión

Se adopta la **Opción 1: base de datos y esquema compartidos con discriminador por columna**, con las siguientes precisiones:

- Toda entidad lleva **`negocio_id`**; las entidades operativas llevan además **`sucursal_id`**.
- El aislamiento se garantiza en **dos capas**: (1) un **contexto de tenant por petición** en NestJS, derivado del token de sesión, que un **repositorio/guard base obliga a aplicar** en cada consulta; y (2) **Row-Level Security de PostgreSQL** como red de seguridad independiente del código de aplicación.
- La **verificabilidad** se asegura con pruebas automatizadas de aislamiento (intentos de acceso cruzado deben fallar) como parte del pipeline.
- La jerarquía se modela como `negocio (1) —— (N) sucursal`. Un negocio de una sola sede es el caso de **una** sucursal, no un caso especial.
- Los **especialistas** pertenecen al negocio y se asignan a **una o varias sucursales** mediante una tabla de relación (`especialista_sucursal`); su agenda y disponibilidad se gestionan por sucursal.
- Se define un **nivel de alcance por entidad**, que servirá de base al ADR-002 (herencia de configuración):

| Nivel | Entidades (ejemplos) |
|---|---|
| **Negocio** | usuarios/perfiles, suscripción, catálogo de servicios, parámetros por defecto, especialistas |
| **Sucursal** | citas/turnos, atenciones realizadas, inventario, ventas de producto, gastos, disponibilidad, asignación especialista↔sucursal |

La Opción 3 queda reservada como posible evolución **híbrida** para clientes enterprise futuros (aislar en base dedicada solo a tenants que lo justifiquen), sin condicionar la arquitectura de la v1.

### Justificación

El mercado objetivo —muchos salones y barberías pequeños— exige **costo por tenant bajo, onboarding inmediato y consolidación sencilla**, justo donde la Opción 1 es superior. Las opciones 2 y 3 compran un aislamiento más fuerte a cambio de un costo operativo y una fricción de onboarding que no se justifican para este volumen y ARPU, y encarecen la analítica de plataforma que Orkalis necesitará.

El principal riesgo de la Opción 1 —la fuga de datos por un filtro olvidado— se neutraliza con una estrategia de defensa en profundidad: el scope obligatorio en el repositorio base elimina la dependencia del cuidado manual, y **RLS actúa aunque el código falle**. Esto convierte el aislamiento en algo **verificable** (la promesa de robustez de la v1) en lugar de confiado. El modelo de columnas `negocio_id`/`sucursal_id` también expresa de forma directa la jerarquía y habilita el cobro por sucursal y la herencia de configuración del ADR-002.

### Consecuencias

**Positivas:**
- Costo de infraestructura y operación bajo y predecible; escalable a muchos tenants.
- Onboarding de un negocio o de una sucursal sin aprovisionamiento (alta por datos).
- Reportes consolidados por negocio, por sucursal y de plataforma con consultas directas.
- Una única ruta de migración y de respaldo para todo el sistema.
- Base limpia para el cobro por número de sucursales y para la herencia de configuración.

**Negativas (compromisos aceptados):**
- El aislamiento es lógico; se asume el costo de mantener RLS, el repositorio base y las pruebas de aislamiento como elementos no negociables.
- Toda consulta debe estar acotada por tenant/sucursal; se acepta la disciplina de diseño que esto impone.
- Riesgo de vecino ruidoso y de tablas grandes; se acepta invertir en indexación por `(negocio_id, sucursal_id)` y, a futuro, en cuotas.
- Si aparece un cliente enterprise con exigencia de aislamiento físico, habrá que introducir el modelo híbrido (trabajo adicional diferido).

### Impacto en el sistema

- **Modelo de datos (ER):** toda tabla incorpora `negocio_id`; las operativas, `sucursal_id`. Aparece la tabla `especialista_sucursal`.
- **Autenticación/RBAC:** el token debe portar el `negocio_id` y el alcance de sucursal del usuario; el `TenantContext` se construye por petición. (Detalle en el futuro ADR de auth/RBAC.)
- **Capa de acceso a datos:** se introduce un repositorio/consulta base que inyecta el filtro de tenant y sucursal; se configura RLS en PostgreSQL.
- **Reportes y finanzas:** todas las agregaciones parametrizadas por `negocio_id` y, opcionalmente, `sucursal_id`.
- **Facturación:** el conteo de sucursales activas por negocio alimenta la suscripción (HU-PLT-001).
- **Habilita el ADR-002:** el nivel de alcance por entidad define dónde viven los valores y dónde los *overrides* de configuración.

### ADRs relacionados

- ADR-000: Stack tecnológico principal (Node.js + NestJS) — *pendiente de formalizar*.
- ADR-002: Herencia de configuración (sistema → negocio → sucursal) — *secuela directa de este ADR*.
- ADR (futuro): Autenticación y RBAC con contexto de tenant.
- ADR (futuro): Persistencia y ORM sobre PostgreSQL (RLS, migraciones).

---

## ADR-002: Herencia de configuración (sistema → negocio → sucursal)

Estado: Propuesto
Fecha: 2026-06-08

---

### Contexto

La configurabilidad es un requisito de primera clase de Orkalis (Definición del Problema §8, nota 3): el administrador debe poder activar o desactivar módulos completos y ajustar parámetros sin tocar código, con valores por defecto sensatos según el perfil (salón / barbería). El ADR-001 estableció la jerarquía `negocio → sucursal` y un **nivel de alcance por entidad**. Sobre esa base, las decisiones de configuración deben **resolverse a lo largo de una cadena**: un valor de sistema (por defecto, dependiente del vertical), que el negocio puede sobrescribir, que a su vez una sucursal puede sobrescribir. Además, el administrador pidió poder **heredar valores de otra sucursal** al configurar una nueva.

La configuración cubre dos familias de valores:
- **Banderas de módulo (feature flags):** inventario on/off, partición por especialista on/off, cierre de período on/off, aprobación manual de reservas on/off, etc.
- **Parámetros operativos y financieros:** repartición profesional/salón, deducción administrativa, comisión bancaria, tarifa a cliente profesional, antelación de cancelación, ventana de recordatorios, duración de bloqueo temporal de franja, etc.

Casi todos los módulos leen configuración: el agendamiento (confirmación automática, reglas de antelación), el cálculo financiero (repartición y comisiones), las notificaciones (recordatorios) y los reportes. Por eso la resolución debe ser **consistente, transparente y de bajo costo en lectura**.

### Problema

¿Cómo se almacena y se resuelve la configuración a lo largo de la cadena sistema → negocio → sucursal, permitiendo *overrides* en cada nivel, la posibilidad de heredar de otra sucursal, validación de dominio, y que el administrador pueda ver de dónde proviene cada valor, sin penalizar el rendimiento?

Aspectos a resolver:
- Dónde y cómo se guardan los valores y los *overrides*.
- En qué orden se resuelve un valor efectivo.
- Qué significa "heredar de otra sucursal".
- Cómo se valida (p. ej. repartición prof + salón = 100%) sin importar el nivel.
- Cómo se muestra la **procedencia** (heredado vs. sobrescrito) y cómo se mantiene el rendimiento.

### Opciones Consideradas

#### Opción 1: Overrides dispersos con resolución en cascada en lectura

**Descripción:** Existe un **catálogo de claves** de configuración definido en código (cada clave con su tipo, su valor por defecto según vertical y sus reglas de validación). En base de datos solo se guardan los valores que **difieren** del nivel superior: filas dispersas a nivel negocio y a nivel sucursal en una tabla `configuracion(nivel, ambito_id, clave, valor)`. Un servicio resolutor calcula el valor efectivo recorriendo la cadena `sistema → negocio → sucursal` (gana el más específico definido). "Heredar de otra sucursal" se implementa como una **acción de clonado**: copia los *overrides* efectivos de la sucursal origen como *overrides* propios de la destino (instantánea, no enlace vivo).

**Ventajas:**
- **Transparencia / procedencia:** el resolutor sabe en qué nivel se definió cada valor; la UI puede mostrar "heredado del negocio" vs. "definido en esta sucursal".
- **DRY:** cambiar un valor a nivel negocio se propaga a todas las sucursales que no lo hayan sobrescrito.
- Almacenamiento mínimo (solo lo que cambia).
- La validación vive una sola vez en el catálogo de claves, sin importar el nivel.

**Desventajas:**
- Hay un costo de *merge* en lectura (se mitiga con caché por `(negocio, sucursal)` e invalidación por evento).
- Requiere mantener un catálogo de claves bien definido (disciplina de diseño).
- El clonado desde otra sucursal es una instantánea: si luego cambia la sucursal origen, la destino no se entera (comportamiento predecible, pero hay que comunicarlo).

#### Opción 2: Configuración materializada completa por sucursal

**Descripción:** Cada sucursal guarda un **bloque de configuración completo** (todas las claves con su valor). Al crear una sucursal, se siembra copiando del negocio o de otra sucursal. En lectura no hay cascada: se lee el bloque de la sucursal directamente.

**Ventajas:**
- Lectura directa y muy rápida (sin merge).
- Modelo mental simple: "lo que ves es lo que hay".

**Desventajas:**
- Se **pierde la propagación**: cambiar un valor del negocio no afecta a las sucursales ya creadas (cada una tiene su copia).
- Se **pierde la procedencia**: no se distingue heredado de sobrescrito.
- Duplicación masiva de datos y riesgo de desincronización entre sucursales.
- Un cambio "para todo el negocio" exige reescribir el bloque de cada sucursal.

#### Opción 3: Servicio de feature flags externo / motor de reglas

**Descripción:** Externalizar la configuración a un sistema dedicado de *feature flags* o a un motor de reglas de terceros.

**Ventajas:**
- Funcionalidad avanzada lista (segmentación, *rollouts* graduales, auditoría).
- Descarga a Orkalis de construir el mecanismo.

**Desventajas:**
- Dependencia externa y posible costo recurrente para una necesidad que es de dominio interno.
- Encaja mal con **parámetros financieros** que requieren validación de dominio (no son simples banderas).
- Latencia/lockin adicionales; complejidad de mantener dos fuentes de verdad (negocio en BD, flags fuera).
- Sobre-ingeniería para la cadena de tres niveles que necesitamos.

### Decisión

Se adopta la **Opción 1: overrides dispersos con resolución en cascada en lectura**, con estas precisiones:

- Un **catálogo de claves de configuración en código** (el *registry*) define para cada clave: tipo, valor por defecto **por vertical** (salón / barbería), nivel mínimo de edición y reglas de validación.
- Tabla `configuracion(negocio_id, nivel, ambito_id, clave, valor, tipo)` que guarda **solo los overrides** a nivel negocio y sucursal (almacenamiento disperso). Lo no definido cae al nivel superior y, en última instancia, al valor por defecto del vertical.
- **Orden de resolución:** `sistema (default por vertical) → negocio → sucursal`; gana el valor definido más específico.
- Un **`ConfigResolver`** (servicio NestJS) expone el valor efectivo **y su procedencia** (el nivel que lo definió), para que la UI muestre claramente qué está heredado y qué sobrescrito.
- **"Heredar de otra sucursal" = acción de clonado** (instantánea): copia los overrides efectivos de la sucursal origen como overrides propios de la destino. **No** se crean enlaces vivos entre sucursales hermanas (se evitan ciclos y propagaciones sorpresa); la cadena canónica sigue siendo sistema → negocio → sucursal.
- **Validación de dominio en el registry**, aplicada en cada escritura sin importar el nivel (p. ej. repartición prof + salón = 100%, porcentajes 0–100, banderas booleanas).
- **Caché** del config resuelto por `(negocio_id, sucursal_id)` con **invalidación por evento** al guardar (reutiliza el patrón `financial-settings-updated` heredado de NOVA).
- Las **banderas de módulo y los parámetros** comparten este mismo mecanismo (un solo sistema de configuración, no dos).

### Justificación

La Opción 1 es la única que satisface simultáneamente los tres requisitos que el administrador necesita: **propagación** (cambiar el negocio afecta a las sucursales no sobrescritas), **procedencia** (ver de dónde viene cada valor) y **clonado desde otra sucursal**. La Opción 2 sacrifica propagación y procedencia, que son justamente lo que da valor a una jerarquía de configuración, y multiplica los datos. La Opción 3 es sobre-ingeniería: introduce una dependencia externa y maneja mal los parámetros financieros, que no son banderas sino valores con validación de dominio.

Modelar la herencia entre sucursales como un **clonado por instantánea** (en lugar de un enlace vivo) es una decisión deliberada: mantiene la cadena de resolución simple y predecible (un solo árbol, sin grafos laterales ni ciclos), y aun así cubre el caso de uso real ("quiero que esta sucursal arranque como aquella"). El costo de *merge* en lectura se neutraliza con caché e invalidación por evento, un patrón que el sistema ya conocía en NOVA.

### Consecuencias

**Positivas:**
- Un solo mecanismo para banderas de módulo y parámetros financieros.
- Cambios a nivel negocio se propagan solos a las sucursales que no sobrescriben.
- La UI puede mostrar procedencia (heredado / sobrescrito), reduciendo errores de configuración.
- Almacenamiento mínimo y validación centralizada en el registry.

**Negativas (compromisos aceptados):**
- Hay que construir y mantener el **registry de claves** con disciplina (es la fuente de verdad de la configuración).
- La resolución en cascada tiene costo en lectura; se asume la complejidad de la **caché e invalidación**.
- El clonado desde otra sucursal es una instantánea: los cambios posteriores en la sucursal origen **no** se propagan a la destino; se debe comunicar este comportamiento en la UI para no confundir al administrador.

### Impacto en el sistema

- **Modelo de datos (ER):** nueva tabla `configuracion` (overrides dispersos por nivel). El registry de claves vive en código, no en BD.
- **Capa de aplicación:** servicio `ConfigResolver` + caché por `(negocio_id, sucursal_id)`; evento de invalidación al guardar.
- **Onboarding:** al crear una sucursal, el administrador elige "heredar del negocio" (sin overrides) o "clonar de la sucursal X" (copia de overrides).
- **Agendamiento:** lee de aquí la bandera de confirmación automática vs. aprobación manual y las reglas de antelación/bloqueo de franja.
- **Cálculo financiero:** lee de aquí repartición, deducción administrativa, comisión bancaria y tarifa a cliente profesional (con su validación).
- **Módulos opcionales:** inventario, partición por especialista y cierre de período se activan/desactivan por banderas resueltas con este mecanismo.
- **UI de administración:** muestra valor efectivo + procedencia y permite sobrescribir o volver a heredar.

### ADRs relacionados

- ADR-001: Estrategia de aislamiento multi-tenant y jerarquía negocio → sucursal — *base de este ADR (nivel de alcance por entidad)*.
- ADR-005: Modelo de agendamiento (consume las banderas y reglas resueltas aquí).
- ADR-006: Motor de cálculo financiero (consume los parámetros resueltos aquí).

---

## ADR-003: Autenticación y RBAC con contexto de tenant

Estado: Propuesto
Fecha: 2026-06-08

---

### Contexto

El ADR-000 descartó el BaaS: Orkalis construye su propia identidad. El ADR-001 exige que cada petición porte el `negocio_id` y el alcance de sucursal del usuario para alimentar el scope de repositorio y RLS. Hay dos planos de acceso muy distintos: los **usuarios internos** (administrador, especialista, recepcionista, operador de plataforma), que se autentican; y el **cliente final**, que **no tiene cuenta** y solo se identifica por teléfono con OTP en el flujo público (RF-021). No existe registro público de cuentas internas (RF-013).

### Problema

¿Cómo se autentican y autorizan los usuarios internos, transportando el contexto de tenant/sucursal, sin reintroducir una dependencia de BaaS y manteniendo el control y el bajo costo?

### Opciones Consideradas

#### Opción 1: Identidad propia con JWT y guards de NestJS
Sesiones basadas en *access token* (JWT de vida corta) + *refresh token*; hashing con argon2/bcrypt; claims con `negocio_id`, rol y alcance de sucursal; autorización por guards e *interceptors* de NestJS (Passport).
- **Ventajas:** control total, costo nulo de terceros, claims a la medida del `TenantContext`, integración natural con NestJS.
- **Desventajas:** hay que implementar y mantener bien el ciclo de tokens, rotación y revocación.

#### Opción 2: Proveedor de identidad gestionado (Auth0, Clerk, etc.)
- **Ventajas:** menos código, MFA y flujos listos.
- **Desventajas:** reintroduce una dependencia externa y un costo recurrente que justamente decidimos evitar; mapear el modelo tenant/sucursal a sus primitivas añade fricción y *lock-in*.

#### Opción 3: Identity provider autohospedado (Keycloak)
- **Ventajas:** estándar (OIDC), potente, autohospedado.
- **Desventajas:** pesado de operar para un equipo pequeño; sobredimensionado para los roles de la v1.

### Decisión

**Opción 1: identidad propia con JWT (access corto + refresh) y RBAC por guards de NestJS.** El token porta `negocio_id`, rol y alcance de sucursal, de donde se construye el `TenantContext` por petición. El **flujo del cliente final es separado**: no genera sesión, solo una verificación OTP de un solo uso para autorizar la reserva pública. Se aplican rotación de refresh tokens y revocación; los secretos se gestionan fuera del código (RNF-012).

### Justificación

Es coherente con la decisión de no depender de un BaaS (ADR-000) y con la necesidad de claims a la medida del modelo multi-tenant (ADR-001). Las opciones 2 y 3 aportan funcionalidad que la v1 no requiere a cambio de dependencia/costo (Auth0/Clerk) u operación pesada (Keycloak). El esfuerzo de construir el ciclo de tokens es acotado y aporta control.

### Consecuencias

**Positivas:** control total, costo nulo de terceros, contexto de tenant nativo en cada petición, integración limpia con guards de NestJS.
**Negativas (aceptadas):** responsabilidad de implementar correctamente tokens, rotación, revocación y políticas de contraseña; añadir MFA si se requiere será trabajo propio.

### Impacto en el sistema
- **Backend:** módulo de auth (login, refresh, logout), guards de rol y de alcance de sucursal, middleware que construye el `TenantContext`.
- **Cliente final:** servicio OTP independiente (sin sesión) que habilita la reserva pública.
- **Base de datos:** la sesión de DB fija la variable de tenant para RLS por petición/transacción (ver ADR-004).

### ADRs relacionados
- ADR-001 (contexto de tenant y RLS), ADR-004 (cómo se fija la variable de RLS), ADR-005 (OTP en el flujo público).

---

## ADR-004: Persistencia y ORM sobre PostgreSQL (RLS y migraciones)

Estado: Propuesto
Fecha: 2026-06-08

---

### Contexto

El ADR-000 fijó PostgreSQL y el ADR-001 exige RLS + scope obligatorio por `negocio_id`/`sucursal_id`. Se necesita una capa de acceso a datos en NestJS que: (a) permita **fijar la variable de sesión de tenant** que usa RLS por petición/transacción; (b) ofrezca **tipos fuertes** y SQL crudo cuando convenga; y (c) gestione **migraciones versionadas**.

### Problema

¿Qué ORM/capa de datos y qué estrategia de migraciones adopta Orkalis para operar PostgreSQL con RLS y scope de tenant, con buena seguridad de tipos y mantenibilidad?

### Opciones Consideradas

#### Opción 1: Drizzle ORM
SQL-first, tipado excelente, ligero; trabajar RLS y fijar la GUC de sesión (`SET LOCAL app.current_tenant`) es directo por su cercanía al SQL; migraciones versionadas con su toolkit.
- **Ventajas:** transparencia SQL (clave para RLS), tipos fuertes, bajo "magia oculta", buen rendimiento.
- **Desventajas:** ecosistema más joven que TypeORM; menos *plugins* prefabricados.

#### Opción 2: TypeORM
Maduro y con integración de primera clase en NestJS; soporta query builder y SQL crudo.
- **Ventajas:** madurez, integración NestJS, gran comunidad.
- **Desventajas:** abstracciones pesadas; el manejo de RLS/transacciones por petición exige cuidado; histórico de fricciones en migraciones.

#### Opción 3: Prisma
DX excelente y tipos muy buenos.
- **Ventajas:** productividad alta, migraciones cómodas.
- **Desventajas:** RLS y la fijación de variables de sesión por request han sido históricamente incómodas (requiere extensiones/`$executeRaw`); menos control fino sobre la conexión/transacción que demanda nuestro patrón multi-tenant.

### Decisión

**Opción 1: Drizzle ORM**, con un **patrón de transacción por petición** que ejecuta `SET LOCAL app.current_tenant = <negocio_id>` (y el alcance de sucursal) antes de las consultas, de modo que **RLS actúe en cada operación**. Migraciones versionadas en el repositorio, revisadas en *code review* y aplicadas en el pipeline.

### Justificación

El requisito duro es operar RLS de forma fiable y verificable (RNF-010). La transparencia SQL de Drizzle hace ese patrón explícito y de bajo riesgo, sin pelear contra abstracciones. TypeORM es válido pero su capa pesada complica el control fino de transacción/RLS; Prisma sigue siendo el más incómodo para fijar la variable de sesión por request. Drizzle además da tipos fuertes sin sacrificar control.

### Consecuencias

**Positivas:** RLS explícita y fiable; tipos fuertes; migraciones claras; rendimiento.
**Negativas (aceptadas):** ecosistema más nuevo (menos recetas listas); el equipo asume el patrón de transacción/GUC como convención obligatoria.

### Impacto en el sistema
- **Repositorio base** que abre transacción, fija la GUC de tenant y aplica el scope; punto único donde vive el aislamiento de datos junto con las políticas RLS.
- **Migraciones** versionadas; las políticas RLS forman parte del esquema migrado.

### ADRs relacionados
- ADR-001 (RLS/scope), ADR-003 (de dónde sale el `negocio_id` que se fija), ADR-000 (PostgreSQL/TypeScript).

---

## ADR-005: Modelo de agendamiento: máquina de estados y control de concurrencia

Estado: Propuesto
Fecha: 2026-06-08

---

### Contexto

El agendamiento es el subsistema de mayor riesgo y el diferenciador del producto. Concentra varios refinamientos: máquina de estados ampliada respecto a NOVA, **confirmación automática** por defecto, **validación dependiente del origen** (pública estricta / interna relajada), **cobro al finalizar** (guard de pago) y, sobre todo, **cero doble reserva** bajo concurrencia sin un portero humano (RNF-008, atributo de calidad "0 dobles reservas"). La reserva pública es de alta criticidad para la disponibilidad (RNF-006).

### Problema

¿Cómo se garantiza que dos clientes no confirmen la misma franja bajo concurrencia, y cómo se estructuran los estados y la validación del turno para soportar reserva pública, walk-in en vivo y registro retroactivo?

El núcleo decidible con alternativas es el **mecanismo de control de concurrencia**; los estados y la validación por origen se definen como parte de la decisión.

### Opciones Consideradas (control de concurrencia)

#### Opción 1: Restricción de exclusión en PostgreSQL (`EXCLUDE` con `tstzrange` + `btree_gist`)
La base de datos rechaza atómicamente cualquier solapamiento de turnos para el mismo especialista/sucursal mediante una restricción de exclusión sobre el rango de tiempo.
- **Ventajas:** garantía a nivel de motor (imposible doble reserva aunque falle la app); simple de razonar; sin infraestructura extra.
- **Desventajas:** los conflictos se manifiestan como error de restricción que la app debe traducir a "franja tomada".

#### Opción 2: Bloqueo pesimista (`SELECT … FOR UPDATE`)
Bloquear las filas de disponibilidad al reservar.
- **Ventajas:** evita el conflicto antes de insertar.
- **Desventajas:** requiere modelar y bloquear "slots"; mayor contención y riesgo de bloqueos largos bajo carga.

#### Opción 3: Bloqueo distribuido en aplicación (p. ej. Redis)
- **Ventajas:** flexible, desacoplado de la BD.
- **Desventajas:** introduce dependencia e infraestructura; la garantía depende de la corrección del lock (riesgo de *split-brain*/TTL); más débil que la garantía del motor.

### Decisión

**Opción 1: restricción de exclusión en PostgreSQL** como garantía dura de no solapamiento, **complementada con una "retención" temporal de franja con TTL** para la experiencia del flujo público (mientras el cliente confirma, la franja queda reservada unos minutos). Decisiones de diseño asociadas:

- **Máquina de estados:** `confirmada → (en_sitio) → en_progreso → completada`, con ramas `cancelada` y `no_asistió`; `solicitada` solo existe si la aprobación manual está activa. El **pago es el guard** para `completada`.
- **Origen** (`agendamiento_publico` / `creacion_interna`) como atributo de la cita; un walk-in puede entrar directo en `en_progreso` o, retroactivo, en `completada`.
- **Validación por estrategia según origen** (patrón Strategy): un validador para reserva pública (tiempo futuro + franja libre + retención/exclusión) y otro para creación interna (chequeos de sanidad, admite pasado, sin candado). Cumple Open-Closed: nuevos orígenes => nuevas estrategias, sin tocar las existentes.

### Justificación

La promesa "0 dobles reservas" exige una garantía que **no dependa del código de aplicación**: la restricción de exclusión la da el propio motor, y es la opción más simple y robusta sobre PostgreSQL. El bloqueo pesimista añade contención y modelado de slots; el lock distribuido añade dependencia y una garantía más frágil. La retención con TTL resuelve la UX sin debilitar la garantía. La validación por estrategia materializa la "validación dependiente del origen" del SRS (RF-029) de forma SOLID.

### Consecuencias

**Positivas:** imposibilidad real de doble reserva; estados y validación claros y extensibles; sin infraestructura adicional.
**Negativas (aceptadas):** la app debe traducir el error de exclusión a un mensaje amable y reintentar/ofrecer alternativas; la retención con TTL requiere limpieza de franjas expiradas.

### Impacto en el sistema
- **BD:** restricción de exclusión sobre `(especialista_id, sucursal_id, rango_tiempo)` con `btree_gist`; tabla/columnas de retención con expiración.
- **Backend:** servicios de disponibilidad, reserva (con retención), y máquina de estados; validadores por origen; lee de ADR-002 la bandera de confirmación automática y las reglas de antelación.
- **Cliente final:** manejo del caso "franja ya tomada" (RF-020) y del OTP (ADR-003).
- **Diagrama de estados:** este ADR es la fuente para el diagrama de estados de la cita.

### ADRs relacionados
- ADR-002 (banderas/reglas), ADR-003 (OTP), ADR-004 (transacciones/exclusión), ADR-006 (al completar se dispara el cálculo financiero).

---

## ADR-006: Motor de cálculo financiero

Estado: Propuesto
Fecha: 2026-06-08

---

### Contexto

NOVA ejecutaba la lógica financiera en *triggers* y funciones de PostgreSQL: difícil de versionar, probar y configurar por tenant. Orkalis necesita un cálculo **configurable** (lee parámetros resueltos del ADR-002), que opere sobre el **cierre real** del turno (RF-041, cobro al finalizar) y que sea **auditable** y **reversible** (RNF-009: revertir un turno deshace sus efectos).

### Problema

¿Dónde y cómo vive el cálculo de repartición, comisiones y deducciones, de modo que sea configurable, testeable, auditable y reversible?

### Opciones Consideradas

#### Opción 1: Servicio de dominio en la capa de aplicación (cálculo en código)
Funciones de dominio puras que, al completar el turno, leen los parámetros efectivos y calculan, persistiendo un **snapshot de los parámetros aplicados**.
- **Ventajas:** unitario-testeable, versionado con el código, fácil de configurar por tenant, auditable (snapshot), reversible.
- **Desventajas:** la consistencia depende de envolver el cálculo y la persistencia en transacción (ya resuelto en ADR-004).

#### Opción 2: Triggers/funciones en PostgreSQL (enfoque NOVA)
- **Ventajas:** cálculo junto a los datos.
- **Desventajas:** difícil de probar y versionar; rígido para configurabilidad por tenant; lógica de negocio escondida en la BD.

#### Opción 3: Recalculo dirigido por eventos (event-driven)
- **Ventajas:** desacopla y permite reproceso.
- **Desventajas:** sobre-ingeniería para la v1; complejidad de consistencia eventual no justificada.

### Decisión

**Opción 1: motor de cálculo como servicio de dominio en la aplicación**, ejecutado al **completar** el turno sobre los servicios y productos reales, leyendo los parámetros efectivos del `ConfigResolver` (ADR-002) y **persistiendo un snapshot** de los porcentajes/valores aplicados en el registro de la atención. La reversión recalcula/deshace dentro de una transacción (ADR-004).

### Justificación

Sacar la lógica financiera de los triggers de NOVA hacia un servicio de dominio puro la hace **probable, versionable y configurable** —los tres déficits de NOVA—. El snapshot de parámetros garantiza auditabilidad (una liquidación pasada no cambia si luego se ajustan los porcentajes). El enfoque por eventos es innecesario para la escala objetivo.

### Consecuencias

**Positivas:** cálculo testeable y auditable; configurable por tenant/sucursal; reversión controlada; coherente con "cobro al final".
**Negativas (aceptadas):** disciplina de transaccionalidad al persistir; mantener el snapshot de parámetros por registro.

### Impacto en el sistema
- **Backend:** módulo financiero con funciones de dominio puras; se invoca desde la transición a `completada` (ADR-005) y desde la reversión.
- **Datos:** el registro de atención guarda ganancias prof/salón, comisiones, deducciones y el **snapshot de parámetros aplicados**.
- **Reportes/liquidaciones:** consumen estos registros (RF-042, RF-043).

### ADRs relacionados
- ADR-002 (parámetros), ADR-005 (disparo al completar/revertir), ADR-004 (transacciones).

---

## ADR-007: Canal de notificaciones

Estado: Propuesto
Fecha: 2026-06-08

---

### Contexto

Las notificaciones cumplen dos funciones: el **OTP** del flujo público (ADR-003/RF-021) y las **confirmaciones y recordatorios** que reducen el ausentismo (RF-047/048). El mercado es Colombia, donde WhatsApp es el canal dominante de comunicación, pero su API de negocio implica aprobación y costo. El SRS dejó el canal como punto abierto.

### Problema

¿Qué canal(es) usa Orkalis para OTP, confirmaciones y recordatorios, sin atar la arquitectura a un proveedor y permitiendo evolucionar?

### Opciones Consideradas

#### Opción 1: Abstracción de notificaciones (puerto) + SMS como proveedor inicial
Definir un puerto `NotificationSender` (patrón hexagonal) y arrancar con **SMS** (cobertura universal, ideal para OTP), dejando email y WhatsApp como proveedores enchufables.
- **Ventajas:** SMS llega a todos y sirve para OTP; la abstracción evita *lock-in* y permite sumar canales sin tocar el dominio.
- **Desventajas:** costo por SMS; menor riqueza que WhatsApp.

#### Opción 2: Solo email
- **Ventajas:** muy barato.
- **Desventajas:** débil para OTP y recordatorios (menor apertura/inmediatez); insuficiente como canal principal.

#### Opción 3: WhatsApp Business API desde el inicio
- **Ventajas:** máxima cercanía al hábito colombiano y al engagement.
- **Desventajas:** fricción de aprobación, plantillas y costo; arrancar dependiendo de él retrasa la v1 (estaba fuera de alcance como pilar v1).

### Decisión

**Opción 1: abstracción de notificaciones con SMS como proveedor inicial** (cubre OTP + confirmaciones + recordatorios), con **email como complemento de bajo costo** y **WhatsApp como proveedor enchufable** para una fase posterior. El canal por evento es configurable (enlaza con ADR-002).

### Justificación

La abstracción es la decisión arquitectónica importante: desacopla el dominio del proveedor y permite que WhatsApp entre después sin reescribir nada. SMS es el mínimo robusto que sirve para OTP y recordatorios desde el día uno; email solo no alcanza; WhatsApp primero introduce fricción incompatible con el ritmo de la v1.

### Consecuencias

**Positivas:** independencia de proveedor; OTP y recordatorios fiables desde la v1; camino claro a WhatsApp.
**Negativas (aceptadas):** costo de SMS; gestionar credenciales y límites del proveedor; plantillas por canal.

### Impacto en el sistema
- **Backend:** módulo de notificaciones con el puerto `NotificationSender` y adaptadores (SMS, email; WhatsApp futuro); cola para envíos (no bloquear peticiones, RNF-002).
- **Configuración:** canal por tipo de evento resuelto vía ADR-002.

### ADRs relacionados
- ADR-003 (OTP), ADR-002 (canal configurable), ADR-005 (eventos de cita que disparan notificaciones).

---

## ADR-008: Estructura de repositorio y estrategia de despliegue/CI-CD

Estado: Propuesto
Fecha: 2026-06-08

---

### Contexto

El ADR-000 implica TypeScript en front y back con **tipos/contratos compartidos**. Hay que decidir la organización del código y cómo se despliega para alcanzar **99.9%** (RNF-006), **RPO ≤ 1 h / RTO ≤ 4 h** (RNF-007) y tareas en segundo plano (RNF-002), con un equipo pequeño que no puede asumir operación pesada.

### Problema

¿Cómo se organiza el repositorio y cómo se despliega Orkalis para cumplir los objetivos de disponibilidad y recuperación con mínima carga operativa?

### Opciones Consideradas

#### Opción 1: Monorepo + plataforma gestionada (PaaS/cloud administrado)
Monorepo con *workspaces* (front, back, paquete de tipos compartidos) y despliegue en contenedores sobre plataforma gestionada con **PostgreSQL administrado** (respaldos/PITR), **cola gestionada** para workers y CI/CD por *pipeline*.
- **Ventajas:** tipos compartidos sin publicar paquetes; Postgres administrado da RPO/RTO sin operar BD a mano; baja carga de DevOps; despliegues reproducibles.
- **Desventajas:** algo de *lock-in* con la plataforma; costo de servicios gestionados.

#### Opción 2: Multi-repo + infraestructura autogestionada (VPS)
- **Ventajas:** control total; costo de servidor bajo.
- **Desventajas:** operar BD, respaldos, alta disponibilidad y parches manualmente; difícil sostener 99.9% y RPO/RTO con equipo pequeño; tipos compartidos exigen publicar paquetes.

#### Opción 3: Serverless (FaaS)
- **Ventajas:** escala automática; pago por uso.
- **Desventajas:** NestJS y los procesos en segundo plano largos encajan peor; *cold starts*; complejidad para transacciones/RLS por request.

### Decisión

**Opción 1: monorepo con workspaces + plataforma gestionada** (contenedores para API y workers, **PostgreSQL administrado con PITR**, **cola gestionada**, CI/CD por pipeline con migraciones automatizadas y pruebas —incluidas las de aislamiento— como *gate*). Entornos separados (desarrollo, *staging*, producción).

### Justificación

Para un equipo pequeño con objetivos de 99.9% y RPO/RTO estrictos, **comprar la operación de base de datos administrada** es lo más sensato; la Opción 2 pone esa carga sobre el equipo y arriesga los SLO. Serverless encaja mal con NestJS, las transacciones por request y los workers. El monorepo materializa los tipos compartidos del ADR-000 sin fricción de publicación.

### Consecuencias

**Positivas:** RPO/RTO y disponibilidad respaldados por servicios gestionados; despliegues reproducibles; tipos compartidos triviales; pipeline con *gates* de calidad.
**Negativas (aceptadas):** costo de servicios gestionados y cierto *lock-in*; gobernanza del monorepo (límites de módulos) para no acoplar todo.

### Impacto en el sistema
- **Repo:** workspaces `api` (NestJS), `web` (React), `shared` (tipos/contratos).
- **Infra:** contenedores API + workers; Postgres administrado (PITR); cola gestionada; secretos fuera del código (RNF-012).
- **CI/CD:** pruebas (unitarias, e2e, **aislamiento**) y migraciones como pasos del pipeline; entornos dev/staging/prod.
- **Observabilidad:** logs y métricas del SLO (RNF-019).

### ADRs relacionados
- ADR-000 (tipos compartidos), ADR-004 (migraciones), ADR-007 (cola de notificaciones), ADR-002/RNF (objetivos de calidad).
