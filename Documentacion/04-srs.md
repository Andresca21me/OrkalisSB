# SRS — Especificación de Requerimientos de Software: Orkalis

**Versión:** 1.0
**Fecha:** 2026-06-08
**Estado:** Borrador
**Documentos previos:** 01 — Definición del Problema (v1.4) · 02 — Historias de Usuario (v1.0) · 03 — ADRs (000, 001, 002)

---

## 1. Introducción

### 1.1 Propósito
Este documento especifica de forma verificable los requerimientos funcionales (RF) y no funcionales (RNF) de Orkalis. Va dirigido al equipo de desarrollo, al responsable del producto y a quien diseñe pruebas. Cada RF deriva de una o más historias de usuario del documento 02 y se apoya en las decisiones técnicas del documento 03.

### 1.2 Alcance del Sistema
Orkalis es una plataforma **SaaS multi-tenant** para la gestión de salones de belleza y barberías en Colombia. Permite a cada negocio gestionar sus sucursales, agenda, clientes, servicios, inventario, equipo y finanzas; ofrece a los clientes finales **agendamiento por enlace público sin cuenta**; y da a los especialistas una **app de turno en vivo**. Es altamente **configurable** (módulos y parámetros activables por negocio y por sucursal). No incluye, en v1, apps móviles nativas, marketplace público, pago en línea del servicio ni multi-país (ver Definición del Problema §5).

### 1.3 Definiciones y Acrónimos
| Término | Definición |
|---|---|
| Tenant / Negocio | Cliente suscrito (la marca/empresa). Unidad de aislamiento principal. |
| Sucursal | Sede física bajo un negocio. Unidad de alcance operativo y de cobro. |
| Walk-in | Cliente atendido sin reserva previa; turno creado manualmente (en vivo o retroactivo). |
| Confirmación automática | Reserva pública que entra como *confirmada* sin aceptación manual. |
| RBAC | Control de acceso basado en roles. |
| RLS | *Row-Level Security* de PostgreSQL. |
| OTP | Código de un solo uso para verificación ligera por teléfono. |
| p95 | Percentil 95 del tiempo de respuesta. |
| SLO | Objetivo de nivel de servicio. |
| RPO / RTO | Objetivo de punto / tiempo de recuperación ante desastre. |
| COP | Peso colombiano. |

### 1.4 Referencias
- Documento 01 — Definición del Problema (v1.4).
- Documento 02 — Historias de Usuario (v1.0).
- Documento 03 — Registro de ADRs (ADR-000 stack, ADR-001 tenencia, ADR-002 configuración).
- Ley 1581 de 2012 (Protección de Datos Personales, Colombia).

---

## 2. Descripción General

### 2.1 Perspectiva del Producto
Sistema nuevo e independiente que reemplaza al software a la medida NOVA. Se compone de una API backend (NestJS), una aplicación web responsive (React) y una base de datos PostgreSQL, con integraciones externas para notificaciones y cobro de la suscripción. Convive con un enlace público de reservas accesible sin autenticación.

### 2.2 Funcionalidades Principales
- Gestión multi-tenant con jerarquía negocio → sucursal y vista consolidada o por sucursal.
- Configurabilidad de módulos y parámetros con herencia (sistema → negocio → sucursal).
- Agendamiento público sin cuenta, con disponibilidad en tiempo real, control de concurrencia y confirmación automática.
- App del especialista con flujo de turno en vivo (iniciar / completar tras cobro / cancelar / no asistió).
- Creación manual de turnos (walk-in en vivo y retroactivo) con validación dependiente del origen.
- Gestión interna: clientes/CRM, catálogo de servicios con repartición, inventario opcional, ventas, gastos, liquidaciones.
- Cálculo financiero con cobro al finalizar, reportes y exportaciones (CSV/PDF).
- Suscripción cobrada por plan (Básico/Pro/Premium/Empresarial) + número de especialistas, con cupos de mensajería por plan y suspensión por estado de pago (ADR-009).
- Notificaciones de confirmación y recordatorio.

### 2.3 Usuarios del Sistema
| Tipo de Usuario | Descripción | Nivel técnico |
|---|---|---|
| Administrador | Dueño/gerente; configura negocio, sucursales y finanzas | Básico–Intermedio |
| Especialista / Barbero | Presta el servicio; opera su agenda en vivo | Básico |
| Cliente final | Reserva por enlace público sin cuenta | Básico |
| Recepcionista / Cajero | Gestiona agenda y cobros en sitio (rol opcional) | Básico |
| Operador de Plataforma | Equipo Orkalis; gestiona suscripción y estado de cuentas | Avanzado |

### 2.4 Restricciones
- Stack: TypeScript de extremo a extremo — NestJS + React + PostgreSQL (ADR-000).
- Aislamiento multi-tenant verificable en dos niveles (negocio y sucursal) con RLS + scope de aplicación (ADR-001).
- Configurabilidad como mecanismo único de banderas y parámetros con herencia (ADR-002).
- Localización Colombia: moneda COP, formato `es-CO`, textos en español.
- Tratamiento de datos personales conforme a la Ley 1581 de 2012.
- Endpoints públicos de reserva protegidos contra abuso (rate limiting, verificación ligera, control de concurrencia).
- **Escala objetivo (SLO): decenas de negocios**, con arquitectura dimensionada con holgura hacia cientos.

### 2.5 Suposiciones y Dependencias
- Existencia de un proveedor de notificaciones (canal a definir en ADR) y de una pasarela para el cobro de la suscripción.
- El cobro del servicio es presencial; Orkalis no procesa la transacción de la cita.
- El cliente final dispone de teléfono móvil y navegador; no instala nada ni crea cuenta.
- El design system está definido en Claude Design y es la fuente de verdad visual.

---

## 3. Requerimientos Funcionales

> Formato: **RF-NNN** — Nombre. Descripción. *Prioridad* · *HU origen*.

### 3.1 Plataforma, suscripción y multi-tenant

**RF-001 — Alta y onboarding del negocio.** El sistema debe permitir crear un negocio seleccionando su perfil (salón / barbería), precargando terminología, categorías y módulos por defecto del perfil. *Alta · HU-ADM-001*

**RF-002 — Cambio de perfil de negocio.** El sistema debe permitir cambiar el perfil tras el alta, ajustando defaults sin borrar datos operativos existentes. *Media · HU-ADM-001*

**RF-003 — Gestión de sucursales.** El administrador debe poder crear, editar y desactivar sucursales bajo un negocio; un negocio de una sola sede se modela como una sucursal. *Alta · HU-ADM-002*

**RF-004 — Vista por sucursal y consolidada.** El sistema debe permitir filtrar agenda, reportes y finanzas por una sucursal o ver el negocio consolidado, sin filtración entre sedes. *Alta · HU-ADM-002*

**RF-005 — Aislamiento de datos multi-tenant.** El sistema debe garantizar que ningún usuario acceda a datos de otro negocio ni de una sucursal fuera de su alcance, aplicando scope obligatorio y RLS. *Alta · HU-ADM-002 / ADR-001*

**RF-006 — Suscripción por plan + número de especialistas.** El sistema debe calcular el cobro de la suscripción según el **plan** contratado (Básico/Pro/Premium/Empresarial) más el **número de especialistas** del negocio (precio base + costo por especialista adicional), y ajustarlo al alta o baja de especialistas o al cambio de plan. Cada plan define **cupos mensuales de mensajería** (WhatsApp Utility/Marketing, SMS, Email) y habilita funciones (multi-sede, reportes, fidelización, etc.). *Alta · HU-PLT-001 / ADR-009*

**RF-007 — Suspensión y reactivación por estado de pago.** El operador de plataforma debe poder suspender o reactivar el acceso de un negocio según su pago, conservando íntegros los datos durante la suspensión. *Alta · HU-PLT-002*

### 3.2 Configurabilidad

**RF-008 — Activar/desactivar módulos.** El administrador debe poder activar o desactivar módulos (inventario, partición por especialista, cierre de período, aprobación manual, etc.) por negocio o por sucursal. *Alta · HU-ADM-003*

**RF-009 — Parámetros financieros configurables.** El administrador debe poder definir repartición profesional/salón, deducción administrativa, comisión bancaria y tarifa a cliente profesional, por negocio o sucursal. *Alta · HU-ADM-004*

**RF-010 — Herencia y procedencia de configuración.** El sistema debe resolver cada valor en la cadena sistema → negocio → sucursal y exponer su procedencia (heredado vs. sobrescrito). *Alta · HU-ADM-004 / ADR-002*

**RF-011 — Heredar configuración de otra sucursal.** Al crear una sucursal, el administrador debe poder clonar los overrides efectivos de otra sucursal (instantánea). *Media · HU-ADM-004 / ADR-002*

**RF-012 — Validación de parámetros.** El sistema debe validar los parámetros en cada escritura sin importar el nivel (p. ej. repartición prof + salón = 100%, porcentajes 0–100). *Alta · HU-ADM-004*

### 3.3 Identidad y acceso

**RF-013 — Autenticación de usuarios internos.** El sistema debe autenticar a administradores, especialistas y recepcionistas; no existe registro público de cuentas internas. *Alta · (transversal)*

**RF-014 — RBAC con alcance de tenant y sucursal.** El sistema debe autorizar acciones según rol y acotar la visibilidad al negocio y a la(s) sucursal(es) del usuario. *Alta · ADR-001*

### 3.4 Agendamiento público (cliente final)

**RF-015 — Enlace público por sucursal y por negocio.** El sistema debe ofrecer un enlace de reserva por sucursal y, para negocios multi-sucursal, un enlace de negocio que permita elegir la sede. *Alta · HU-CLI-001*

**RF-016 — Selección de especialista y servicio.** El cliente debe poder elegir especialista y servicio antes de ver disponibilidad. *Alta · HU-CLI-002*

**RF-017 — Disponibilidad en tiempo real.** El sistema debe mostrar solo las franjas libres compatibles con la duración del servicio para el especialista elegido. *Alta · HU-CLI-002*

**RF-018 — Reserva con confirmación automática.** El sistema debe confirmar la reserva de inmediato por defecto, sin aceptación manual del especialista. *Alta · HU-CLI-003 / HU-ESP-002*

**RF-019 — Aprobación manual opcional.** Cuando el negocio active la aprobación manual, la reserva debe entrar como *solicitada* y quedar pendiente de aprobación. *Media · HU-ESP-002*

**RF-020 — Control de concurrencia de franjas.** El sistema debe impedir la doble reserva de una misma franja mediante bloqueo temporal, informando al cliente y ofreciendo alternativas si la franja ya fue tomada. *Alta · HU-CLI-003 / ADR-001*

**RF-021 — Identificación por teléfono con verificación ligera (OTP).** El cliente debe poder reservar identificándose con su teléfono y un código de verificación, sin crear cuenta. *Alta · HU-CLI-004*

**RF-022 — Cancelar o reagendar desde el enlace.** El cliente debe poder cancelar o reagendar su cita según las reglas de antelación del negocio. *Media · HU-CLI-006*

### 3.5 Agenda interna y app del especialista

**RF-023 — Agenda del día y la semana.** El especialista debe ver sus turnos del día y la semana ordenados por hora, con cliente, servicio y estado. *Alta · HU-ESP-001*

**RF-024 — Recepción automática de citas.** Las reservas públicas deben aparecer en la agenda del especialista sin requerir su aceptación una por una. *Alta · HU-ESP-002*

**RF-025 — Flujo de turno en vivo.** El especialista debe poder iniciar un turno (a *en progreso*), completarlo o cancelarlo / marcarlo *no asistió*. *Alta · HU-ESP-003 / HU-ESP-005*

**RF-026 — Completar con cobro al final (guard de pago).** El sistema debe exigir el registro del pago y de los servicios realmente realizados como condición para marcar un turno como *completado*. *Alta · HU-ESP-004*

**RF-027 — Creación manual de turno (walk-in en vivo).** El administrador o especialista debe poder crear un turno para un cliente sin cita y atenderlo de inmediato, marcado con origen *creación interna*, sin validación de disponibilidad futura. *Alta · HU-ESP-006*

**RF-028 — Registro retroactivo de atención.** El sistema debe permitir registrar un turno ya finalizado con horas pasadas, directamente como *completado*, aplicando solo chequeos de sanidad (fin ≥ inicio, período abierto, especialista válido), sin candado de concurrencia. *Alta · HU-ESP-007*

**RF-029 — Validación dependiente del origen.** El sistema debe aplicar reglas de validación distintas según el origen de la cita (pública: estricta hacia adelante con concurrencia; interna: relajada, admite pasado). *Alta · HU-ESP-006 / HU-ESP-007 / Definición §8 nota 6*

**RF-030 — Disponibilidad y sucursal activa del especialista.** El especialista debe poder alternar su disponibilidad y la sucursal en la que opera, reflejándose en la agenda y el enlace público. *Media · HU-ESP-008*

**RF-031 — Resumen de ganancias del especialista.** El especialista debe ver sus ganancias de hoy, la semana y el mes (servicios + comisiones), salvo que la partición por especialista esté desactivada. *Media · HU-ESP-009*

**RF-032 — Gestión de agenda por recepción.** El recepcionista debe poder crear, editar y reasignar citas de la sucursal a especialistas válidos. *Alta · HU-REC-001*

### 3.6 Operación interna (clientes, servicios, inventario, ventas, gastos)

**RF-033 — Gestión de clientes (CRM).** El sistema debe permitir crear, editar y desactivar (borrado lógico) clientes y consultar su historial y estadísticas. *Media · (heredado NOVA)*

**RF-034 — Creación automática de cliente al agendar.** El sistema debe recuperar o crear un cliente a partir de su identificación al reservar o registrar un turno. *Media · HU-CLI-004*

**RF-035 — Catálogo de servicios.** El administrador debe poder crear servicios con precio, duración y estado, agrupados por categorías del perfil. *Alta · HU-ADM-006*

**RF-036 — Repartición personalizada por servicio.** El sistema debe soportar repartición por porcentajes o por valor fijo al profesional, alimentando el cálculo de ganancias. *Alta · HU-ADM-006*

**RF-037 — Inventario (módulo opcional).** Cuando el módulo esté activo, el sistema debe gestionar productos de servicio y de venta, movimientos de stock, alertas de stock bajo y valoración. *Media · HU-ADM-007*

**RF-038 — Gasto automático por compra de inventario.** Al registrar una entrada por compra, el sistema debe poder generar un gasto variable asociado. *Baja · HU-ADM-007*

**RF-039 — Venta de productos con comisión configurable.** El sistema debe registrar ventas de productos con comisión al profesional (cuando aplique) y descuento de stock. *Media · (heredado NOVA)*

**RF-040 — Gestión de gastos fijos y variables.** El administrador debe poder registrar y eliminar gastos por categoría, afectando el cálculo de egresos. *Media · HU-ADM-008*

### 3.7 Finanzas, liquidaciones y reportes

**RF-041 — Cálculo financiero sobre el cierre real.** El sistema debe calcular repartición, comisiones y deducciones sobre los servicios y productos efectivamente realizados al completar el turno, no sobre la estimación de la reserva. *Alta · HU-ESP-004 / Definición §8 nota 7*

**RF-042 — Ingresos del salón y ganancia neta.** El sistema debe calcular ingresos del salón, total de gastos, ganancia neta y margen, con indicador de salud financiera. *Media · HU-ADM-010*

**RF-043 — Liquidación por especialista.** Cuando la partición esté activa, el sistema debe calcular y exportar la liquidación mensual por especialista con su desglose (incluido descuento por transferencia). *Media · HU-ADM-009*

**RF-044 — Reportes y gráficos.** El sistema debe ofrecer reportes financieros y operativos con gráficos, manejando con gracia los períodos sin datos. *Media · HU-ADM-010*

**RF-045 — Exportación CSV y PDF.** El sistema debe exportar análisis financiero, resumen diario y liquidaciones en CSV (UTF-8 con BOM) y PDF. *Media · HU-ADM-010 / HU-REC-003*

### 3.8 Cierre de período (opcional)

**RF-046 — Cierre y archivado de período.** Cuando el módulo esté activo, el administrador debe poder cerrar un período (quincenal/mensual), archivando servicios, citas y gastos y reiniciando contadores, conservando el histórico. *Baja · HU-ADM-011*

### 3.9 Notificaciones

**RF-047 — Confirmación y recordatorio al cliente.** El sistema debe enviar confirmación de la reserva y recordatorios antes de la cita por el canal configurado. *Media · HU-CLI-005*

**RF-048 — Aviso de cambios de cita.** El sistema debe notificar al cliente la cancelación o modificación de su cita por el negocio. *Media · HU-CLI-005*

---

## 4. Requerimientos No Funcionales

### 4.1 Rendimiento
**RNF-001 — Tiempo de respuesta de acciones clave.** Las acciones interactivas clave (cargar calendario, ver disponibilidad, confirmar reserva) deben responder con **p95 < 1 s**; las lecturas simples, **< 500 ms**; la confirmación de reserva, incluyendo el candado de concurrencia, **< 1.5 s p95**.

**RNF-002 — Reportes y exportaciones pesadas.** La generación de PDF/CSV o reportes intensivos debe ejecutarse en segundo plano (workers/colas) sin bloquear las peticiones interactivas.

### 4.2 Usabilidad
**RNF-003 — Diseño responsive y móvil.** La interfaz debe ser responsive; la app del especialista y el enlace público deben estar optimizados para móvil (incluido *safe-area* en dispositivos con notch).

**RNF-004 — Localización.** Toda la interfaz debe estar en español, con moneda COP y formato `es-CO`.

**RNF-005 — Conformidad con el design system.** La interfaz debe seguir el design system definido en Claude Design.

### 4.3 Confiabilidad y disponibilidad
**RNF-006 — Disponibilidad.** El servicio debe alcanzar **99.9%** de disponibilidad mensual, priorizando el presupuesto de error en el enlace público de reservas.

**RNF-007 — Respaldos y recuperación.** Deben existir respaldos con **RPO ≤ 1 h** (recuperación a un punto en el tiempo) y **RTO ≤ 4 h**.

**RNF-008 — Consistencia de reservas.** La reserva debe ser idempotente y libre de doble agendamiento bajo concurrencia; un fallo parcial no debe dejar franjas en estado inconsistente.

**RNF-009 — Integridad financiera.** Las operaciones que afectan ganancias, stock y pagos deben ser transaccionales; revertir un turno completado debe deshacer sus efectos de forma controlada.

### 4.4 Seguridad y privacidad
**RNF-010 — Aislamiento verificable.** El aislamiento multi-tenant debe respaldarse con RLS y pruebas automatizadas de acceso cruzado que deben fallar (no es suficiente el filtro de aplicación).

**RNF-011 — Protección de endpoints públicos.** El agendamiento público debe contar con rate limiting y verificación OTP para mitigar abuso y reservas falsas.

**RNF-012 — Transporte y secretos.** Todo el tráfico debe ir sobre TLS; las credenciales y secretos deben gestionarse fuera del código.

**RNF-013 — Habeas Data (Ley 1581/2012).** El tratamiento de datos personales de clientes finales debe contemplar consentimiento y manejo adecuado; el diseño no debe impedir el cumplimiento del régimen colombiano.

### 4.5 Mantenibilidad
**RNF-014 — Arquitectura SOLID y modular.** El backend debe organizarse en módulos con responsabilidades separadas y bajo acoplamiento (NestJS); la validación de citas debe ramificar por estrategia según origen.

**RNF-015 — Configuración sin código.** Cambiar módulos y parámetros no debe requerir despliegue; se gestiona vía el mecanismo de configuración (ADR-002).

**RNF-016 — Pruebas.** Deben existir pruebas unitarias y e2e para la lógica crítica (agendamiento, concurrencia, cálculo financiero, aislamiento).

### 4.6 Escalabilidad
**RNF-017 — Escala objetivo.** El sistema debe sostener con holgura **decenas de negocios** y su tráfico de reserva concurrente, con una arquitectura validable hacia **cientos** sin rediseño estructural.

### 4.7 Portabilidad / Compatibilidad
**RNF-018 — Navegadores.** La aplicación web debe funcionar en las versiones recientes de los navegadores modernos (Chrome, Safari, Edge, Firefox) en escritorio y móvil.

### 4.8 Observabilidad
**RNF-019 — Trazas y métricas.** El sistema debe registrar logs estructurados y métricas de las operaciones críticas (reservas, completados, errores de concurrencia) para diagnóstico y monitoreo del SLO.

---

## 5. Requerimientos de Interfaz

### 5.1 Interfaces de Usuario
- **Panel de administración** (escritorio/tablet): configuración, sucursales, finanzas, reportes.
- **App del especialista** (móvil): agenda y flujo de turno en vivo.
- **Enlace público de reservas** (móvil/escritorio, sin autenticación): selección de sede, especialista, servicio y franja.
- **Vista de recepción** (tablet/escritorio): agenda del día y registro de cobros.

### 5.2 Interfaces de Software
- API REST del backend NestJS consumida por el frontend React.
- Proveedor de notificaciones (canal por definir en ADR): confirmación y recordatorios.
- Pasarela de pagos para la suscripción del negocio.
- PostgreSQL como almacén relacional con RLS.

### 5.3 Interfaces de Hardware
- No aplica hardware especializado. Se asume dispositivos móviles/tablets/escritorio estándar con navegador y conexión a internet.

---

## 6. Restricciones de Diseño
- TypeScript de extremo a extremo: NestJS + React + PostgreSQL (ADR-000).
- Aislamiento por columnas `negocio_id`/`sucursal_id` + RLS + scope de repositorio (ADR-001).
- Configuración por overrides dispersos con resolución en cascada (ADR-002).
- Validación de citas por estrategia según origen (Definición §8 nota 6).
- Tareas pesadas en workers/colas (no bloquear el hilo de Node).

---

## 7. Atributos de Calidad

| Atributo | Descripción | Métrica objetivo |
|---|---|---|
| Disponibilidad | Uptime mensual del servicio, con foco en el enlace público | 99.9% (~43 min/mes) |
| Tiempo de respuesta | Acciones interactivas clave | p95 < 1 s (lecturas simples < 500 ms; confirmación < 1.5 s) |
| Escalabilidad | Capacidad sin rediseño | Decenas de negocios (holgura hacia cientos) |
| Recuperación | Respaldo y restauración ante desastre | RPO ≤ 1 h · RTO ≤ 4 h |
| Aislamiento | Acceso cruzado entre tenants/sucursales | 0 fugas; pruebas de acceso cruzado deben fallar |
| Concurrencia | Doble reserva bajo carga | 0 dobles reservas confirmadas |

---

## 8. Apéndices

### 8.1 Trazabilidad RF ↔ Historias de Usuario
Cada RF indica su HU origen en la sección 3. Los grupos funcionales se corresponden con los actores y refinamientos de los documentos 01 y 02. Las decisiones técnicas referenciadas (ADR-000/001/002) se detallan en el documento 03.

### 8.2 Puntos abiertos (a resolver en ADRs siguientes)
- Canal concreto de notificaciones (SMS / email / WhatsApp / push) — afecta RF-047, RF-048, RNF-011.
- ORM y estrategia de migraciones sobre PostgreSQL.
- Estructura de repositorio y estrategia de despliegue/CI-CD.
- Modelo detallado de estados del agendamiento y motor de cálculo financiero (ADRs dedicados).

---

*Documento SRS. Los RF derivan de las Historias de Usuario (02) y se sustentan en los ADRs (03). Los RNF fijan los atributos de calidad con métricas verificables acordadas con el responsable del producto.*
