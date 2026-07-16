# _MATRIZ-TRAZABILIDAD · Cobertura HU → fase → spec + registro de hallazgos

Documento vivo. Garantiza que **cada historia de usuario** (`Documentacion/02-historias-de-usuario.md`) tenga pruebas E2E que la verifiquen, y registra los **defectos** encontrados. Se actualiza al cerrar cada fase.

## 1. Matriz de cobertura (HU → fase → spec)

Leyenda estado: ⬜ pendiente · 🟡 parcial · ✅ cubierta · ❌ con hallazgo abierto.

### Administrador (ADM)
| HU | Título | Fase(s) | Spec(s) | Estado |
|---|---|---|---|---|
| HU-ADM-001 | Alta y onboarding (perfil) | 12 | `12-onboarding/onboarding.spec` | ✅ (flujo 5 pasos→panel, módulo aplicado; validación; atrás/adelante conserva estado; terminología por perfil) |
| HU-ADM-002 | Sucursales y vista consolidada | 06, 11 | `06-admin-agenda/agenda.spec` · `11-multitenant/consolidado.spec` | ✅ (filtro por sede + consolidado = suma de sedes) |
| HU-ADM-003 | Activar/desactivar módulos | 10 | `10-config/{modulos,agenda}.spec` | ✅ (inventario, partición, aprobación manual → efecto en toda la app) |
| HU-ADM-004 | Parámetros financieros con herencia | 10 | `10-config/financieros.spec` | ✅ (herencia negocio→sucursal; autobalance 100%) |
| HU-ADM-005 | Gestionar equipo | 08 (+04, 07 CRM) | `08-gestion/equipo.spec` · `02-reserva/especialista-nuevo.spec` | ✅ (alta, 2 sedes, baja lógica→público) |
| HU-ADM-006 | Catálogo de servicios y repartición | 08 | `08-gestion/{servicios,servicios-payout}.spec` | ✅ (CRUD + payout valor fijo y porcentaje; H-007 corregido) |
| HU-ADM-007 | Inventario (opcional) | 08 | `08-gestion/inventario.spec` | ✅ (stock/alertas/entrada/salida + gate de módulo) |
| HU-ADM-008 | Registrar/controlar gastos | 09 | `09-finanzas/gastos.spec` | ✅ (fijo/variable, eliminar, reflejo en neta) |
| HU-ADM-009 | Liquidaciones por especialista | 09 | `09-finanzas/liquidaciones.spec` | ✅ (descuento 2% electrónico; partición off → no disponible) |
| HU-ADM-010 | Reportes y exportar (CSV/PDF) | 09 | `09-finanzas/{analisis,reportes}.spec` | ✅ CSV + gráficos lazy · **PDF ausente → H-008** |
| HU-ADM-011 | Cerrar/archivar período | 09 | `09-finanzas/quincenal.spec` | ✅ (módulo off ausente; cerrar archiva) |
| HU-ADM-012 | Supervisar/crear turnos en cualquier sucursal | 06 | `06-admin-agenda/{panel,agenda,crear-turno,ciclo-admin}.spec` | ✅ (panel, crear en sede válida, anti-solape, ciclo iniciar→cobrar) |

### Especialista (ESP)
| HU | Título | Fase(s) | Spec(s) | Estado |
|---|---|---|---|---|
| HU-ESP-001 | Agenda día/semana | 04 | `04-especialista/ciclo-turno.spec` | ✅ |
| HU-ESP-002 | Recibir citas automáticamente | 03, 04 | `03-flujo-cruzado/reserva-refleja.spec` | ✅ |
| HU-ESP-003 | Iniciar turno | 04 | `04-especialista/ciclo-turno.spec` | ✅ |
| HU-ESP-004 | Completar con cobro al final | 04 | `04-especialista/ciclo-turno.spec` | ✅ |
| HU-ESP-005 | Cancelar / no asistió | 04 | `04-especialista/ciclo-turno.spec` | ✅ (no asistió) |
| HU-ESP-006 | Walk-in en el momento | 04, 05, 06 | `04-especialista/walkin.spec` | ✅ |
| HU-ESP-007 | Atención retroactiva | 04 | `04-especialista/walkin.spec` | ✅ |
| HU-ESP-008 | Disponibilidad y sucursal activa | 04 | `04-especialista/disponibilidad.spec` | ⬜ |
| HU-ESP-009 | Ganancias acumuladas | 04 | `04-especialista/ganancias.spec` | ✅ |

### Cliente (CLI)
| HU | Título | Fase(s) | Spec(s) | Estado |
|---|---|---|---|---|
| HU-CLI-001 | Abrir enlace y elegir sucursal | 02 | `02-reserva/{booking,flujo-ui}.spec` | ✅ |
| HU-CLI-002 | Elegir especialista/servicio y ver franjas | 02 | `02-reserva/flujo-ui.spec` | ✅ |
| HU-CLI-003 | Reservar con confirmación + concurrencia | 02 | `02-reserva/{booking,flujo-ui}.spec` | ✅ |
| HU-CLI-004 | Identificarse por teléfono (OTP) | 02 | `02-reserva/flujo-ui.spec` | ✅ (corrige H-001) |
| HU-CLI-005 | Confirmación y recordatorios | 02 | `02-reserva/flujo-ui.spec` | ✅ (confirmación; recordatorios fuera de UI) |
| HU-CLI-006 | Cancelar / reagendar | 02 | `02-reserva/flujo-ui.spec` | ✅ (cancelar esc.1+2 antelación; reagendar pendiente) |

### Recepcionista (REC)
| HU | Título | Fase(s) | Spec(s) | Estado |
|---|---|---|---|---|
| HU-REC-001 | Gestionar citas (crear/editar/reasignar) | 05 | `05-recepcion/{citas,reasignar}.spec` | 🟡 (crear + reasignar ✅; editar/cambiar servicio sin UI dedicada) |
| HU-REC-002 | Walk-in y cobro al finalizar | 05 | `05-recepcion/walkin-cobro.spec` | ✅ |
| HU-REC-003 | Gestionar agenda del día + resumen | 05 | `05-recepcion/agenda-dia.spec` | 🟡 (día + estados ✅; exportar resumen ausente → H-004) |

### Operador de plataforma (PLT)
| HU | Título | Fase(s) | Spec(s) | Estado |
|---|---|---|---|---|
| HU-PLT-001 | Suscripción por plan y nº especialistas | 13 | `13-plataforma/consola.spec` | ✅ (lista+KPIs, buscar/filtrar, detalle cupos+cobros, generar cobro) |
| HU-PLT-002 | Suspender/reactivar acceso | 13 | `13-plataforma/{suspension,permisos}.spec` | ✅ (suspender→login bloqueado, aislado del salón, reactivar restaura; solo operador) |

### Transversales (no-HU, pero críticas)
| Tema | Fase | Spec | Estado |
|---|---|---|---|
| Login/RBAC/guardas por rol | 01, 10 | `01-auth/{auth,session-rbac}.spec` · `10-config/usuarios.spec` (alta/baja→login) | ✅ |
| Cuenta suspendida/bloqueada (login) | 01, 13 | `01-auth/cuenta-suspendida.spec` | ✅ |
| Aislamiento multi-tenant desde el front | 11 | `11-multitenant/{isolation,aislamiento,consolidado}.spec` | ✅ (clientes, equipo, agenda, enlace público + negativo RLS por id de otro tenant) |
| Flujo cruzado reserva → ESP/ADM/REC | 03 | `03-flujo-cruzado/reserva-refleja.spec` | ✅ |
| Flujo cruzado reasignación REC → ESP/ADM | 05 | `05-recepcion/reasignar.spec` | ✅ |
| CRM de clientes (alta/edición/baja lógica/búsqueda/historial) | 07 | `07-clientes/{listado,alta-edicion,baja-logica,historial}.spec` | ✅ (reactivar ausente → H-006) |
| Estados (cargando/vacío/error) por pantalla | todas | en cada spec | ✅ (vacío/error muestreados en agenda, finanzas, suscripción, recepción…) |
| Sitio marketing + calculadora de precios | 14 | `14-sitio/sitio.spec` | ✅ (nav, precios, calculadora con fórmula, comparativa, funnel maqueta) |
| No-regresión responsive (sin scroll horizontal, hamburguesa móvil) | 14 | `14-sitio/responsive.spec` | ✅ |
| No-regresión a11y (diálogo role/aria-modal + Esc) | 14 | `14-sitio/a11y.spec` | ✅ |

## 2. Matriz de flujos cruzados (origen → vistas que deben reflejar)

| Flujo (acción del actor) | Origen | Debe reflejarse en | Fase |
|---|---|---|---|
| Cliente confirma reserva | CLI (reserva pública) | ESP (agenda), ADM (agenda/panel), REC (tablero) | 03 ✅ |
| Especialista completa turno con cobro | ESP | ADM (finanzas/panel), CRM (historial cliente), ganancias ESP | 04, 07 ✅ (atención→historial CRM), 09 ✅ (atención→liquidación/2%) |
| Registro de gasto | ADM | análisis (egresos↑, ganancia neta↓) | 09 ✅ |
| Especialista marca "No asistió"/cancela | ESP | ADM (agenda), REC (tablero) | 04 ✅ (no asistió→admin) |
| Recepción reasigna especialista | REC | ESP origen (pierde cita), ESP destino (gana), ADM | 05 ✅ |
| Recepción/admin registra walk-in | REC/ADM/ESP | agenda del rol y de admin | 04 ✅, 05 ✅ (REC→ADM), 06 |
| Admin crea turno en sucursal X | ADM | ESP de X (agenda), REC de X | 06 ✅ (ADM→ESP de X, tras fijar la sede activa del ESP) |
| Admin registra venta de producto | ADM | inventario (stock baja), finanzas, comisión ESP | 08 🟡 (movimientos de stock + gasto ✅; venta al cobro en 09), 09 |
| Admin da de baja especialista | ADM | reserva pública (no aparece), agenda (sin nuevas) | 08 ✅ |
| Admin desactiva módulo inventario | ADM | gestión/finanzas (inventario oculto) en negocio/sucursal | 10 ✅ (inventario→Gestión; partición→liquidación) |
| Admin activa aprobación manual | ADM | reserva pública entra Solicitada | 10 ✅ |
| Admin cambia repartición de servicio | ADM | payout al completar ese servicio (ESP/finanzas) | 08 ✅ (valor fijo y porcentaje; H-007 corregido), 09 |
| Operador suspende tenant | PLT | login de los usuarios del tenant (aviso suspendida) | 13 ✅ (bloqueo + reactivación, aislado por tenant) |

## 3. Registro de hallazgos (defectos detectados y corregidos)

Se llena durante la ejecución. **Política fix-forward:** cada defecto se corrige en la misma sesión y la fila registra también el **fix**. Formato:

| ID | Severidad | Pantalla / flujo | HU | Esperado | Observado | Fase | Fix (archivo/commit) | Estado |
|---|---|---|---|---|---|---|---|---|
| H-001 | **bloqueante** | Reserva pública · paso OTP | HU-CLI-003/004 | Al enviar el código, el OTP se manda al celular ingresado y avanza al paso de verificación | El OTP se enviaba con teléfono **vacío** (closure obsoleto de `contacto` en el mismo tick de `setContacto`) → 400 → el flujo se quedaba atascado en "Tus datos"; **la reserva por UI no se podía completar** | 02 | `BookingPage.tsx`: `retenerYEnviar(telefono)` recibe el teléfono por parámetro en vez de leer el estado | corregido |
| H-002 | **alto** | Alta de especialista → reserva pública | HU-ADM-005 / HU-CLI-002 | Un especialista recién creado por el admin es reservable | El especialista nuevo aparecía en la reserva del cliente **sin ninguna franja en ningún día**, de forma permanente: `equipo.service.crear` no creaba ventanas de horario y **no existe endpoint/UI para asignarlas** (el `PATCH /:id/disponibilidad` solo togglea el booleano `disponible`). Reportado por el USUARIO | 04 (verif.) | `equipo.service.crear`: siembra horario por defecto Lun–Sáb 9–18 en cada sede asignada (espeja el seed) | corregido |
| H-003 | **medio** | Rate limiting global (panel autenticado) | RNF-011 | Un negocio donde varios usuarios (recepción + especialistas + admin) comparten **una sola IP pública (NAT)** puede operar sin 429 espurios | El `ThrottlerGuard` global aplicaba un tope fijo de **120 req/min por IP** también a los endpoints **autenticados** del panel; una sesión activa de varias pantallas (cada carga ~5-7 requests) lo agota y devuelve **429 → ErrorState** en el front. Detectado porque la suite E2E (un solo origen) lo disparaba | 05 | `app.module.ts`: `ThrottlerModule.forRootAsync` lee `THROTTLE_TTL_MS`/`THROTTLE_LIMIT` (defaults 120/60s, **prod sin cambio**); E2E/CI suben el techo; operadores pueden ajustarlo para NAT | corregido |
| H-004 | **bajo** | Recepción · exportar resumen diario | HU-REC-003 | Recepción puede exportar el resumen del día (PDF/descarga) con citas/servicios/ingresos | **No existe control de exportación** en `RecepcionApp` (la HU lo pide). Feature ausente, no un defecto de algo existente | 05 | — (requiere implementar la feature) | escalado |
| H-005 | **medio** | Nueva cita (admin/recepción) · selector de especialista | HU-ADM-012 | Al crear un turno en una sede, **solo** se ofrecen los especialistas asignados a esa sede | `NuevaCitaModal` listaba **todos** los especialistas del negocio sin filtrar por la sucursal elegida; elegir uno ajeno solo fallaba al enviar (el backend sí rechaza con "El especialista no está asignado a esa sucursal"). UX engañosa frente a la HU | 06 | `agenda-ui.tsx` (`NuevaCitaModal`): filtra `espOpciones` por `sucEfectiva` usando `sucursalIds` de `GET /especialistas` y deselecciona el especialista si deja de ser válido al cambiar de sede | corregido |
| H-006 | **bajo** | CRM · reactivar cliente | HU-ADM-005 (CRM) | Un cliente dado de baja se puede **reactivar** y volver al directorio | El directorio (`GET /clientes`) solo lista activos y **no existe endpoint ni UI de reactivación** (no hay POST/PATCH para `activo=true`). La baja lógica conserva el historial, pero no hay vuelta atrás desde la app | 07 | — (requiere endpoint + acción en `ClientesScreen`) | escalado |
| H-007 | **medio** | Servicios · reparto por porcentaje → payout | HU-ADM-006 | El % de reparto **por servicio** (`splitValor`) se aplica al completar ese servicio (la tarjeta muestra "60% / 40%") | El cálculo (`finanzas/calculo.ts`) usaba, para `porcentaje`, el % **global** del negocio (`finanzas.reparticion_profesional`, 50% por defecto) e ignoraba el `splitValor` del servicio; un servicio al 60% pagaba 50%. La UI sugería lo contrario | 08 | **Consultado al USUARIO → decidió corregir.** `calculo.ts`: para `porcentaje` usa `splitValor` del servicio si >0; si es 0, el % estándar. Unit test + E2E `servicios-payout.spec` (60%→24000) en verde | corregido |
| H-008 | **bajo** | Finanzas · exportar a PDF | HU-ADM-010 | Exportar reportes/análisis a **PDF** (además de CSV) con ingresos/gastos/ganancia/margen | Solo existe exportación **CSV** (`AnalisisScreen`/`QuincenalScreen`); **no hay exportación PDF**. Feature ausente | 09 | — (requiere implementar la generación de PDF). El CSV queda verificado | escalado |

- **Severidad:** **bloqueante** (rompe un flujo core) · **alto** (función importante mal) · **medio** (borde/estado) · **bajo** (cosmético/copy).
- **Estado:** `corregido` (fix aplicado + prueba en verde — caso normal bajo fix-forward) · `escalado` (requiere feature/rediseño/migración → consultado al USUARIO, prueba en `test.fixme`) · `abierto` (en curso dentro de la sesión).
- Bajo fix-forward, al cerrar cada fase **no deben quedar hallazgos `abiertos`**: o están `corregidos` o `escalados`.

## 4. Resumen de cobertura (actualizar al cierre)

- HU totales: **32** (ADM 12 · ESP 9 · CLI 6 · REC 3 · PLT 2).
- **CIERRE V3:** las 14 fases (00–14) cerradas. Gate de la suite completa: **122 pruebas en verde + 3 skips** (2 escalados en `test.fixme` + 1 test guardado de "día sin cupo"); tsc + lint limpios.
- HU cubiertas: **32 / 32** (CLI 6, ESP 8, REC 3 [2 ✅ + 1 🟡], ADM-001..012 ✅, PLT-001/002 ✅, +RBAC/aislamiento ✅). Sitio marketing, responsive y a11y cubiertos en FASE-14.
- Robustez del entorno (FASE-13): el seed creaba disponibilidad solo Lun–Sáb 9–18, lo que hacía fallar la suite fuera de horario o en domingo. Se amplió a **7 días / 00:00–23:59** (dato de demo/prueba; la disponibilidad pública sigue filtrando franjas pasadas). Estabiliza la suite a cualquier hora en CI.
- Flujos cruzados cubiertos: **11 / 11** (reserva→vistas; no asistió→admin; reasignación REC→ESP/ADM; walk-in REC→ADM; admin crea turno en sede X→ESP; atención→CRM; baja especialista→público; cambio de reparto→payout; atención→liquidación 2%; gasto→análisis; **config→toda la app** [módulo/aprobación manual]).
- FASE-10 parcial (no bloqueante): casos no automatizados — cierre por **sucursal** (4), override financiero explícito por sede (6), heredar de otra sucursal (8), detalle de **cupos de mensajería** (12), **cambio de vertical** Salón↔Barbería (13). El núcleo de modularidad (módulos→app, herencia, validación 100%, usuarios→login, suscripción) sí está cubierto.
- Hallazgos: **5 corregidos** (H-001 bloqueante, H-002 alto, H-003 medio, H-005 medio, H-007 medio) · **3 escalados** (H-004 bajo exportar resumen REC; H-006 bajo reactivar cliente; H-008 bajo exportar PDF).
- Nota FASE-09: la **comisión bancaria viene en 0% por defecto** (registry), no en 2%; el "descuento del 2%" requiere configurarla. No es defecto (es configurable), pero el default no aplica retención automática.
- Deuda derivada de H-002: **no hay UI/endpoint para editar las ventanas de horario** de un especialista (solo el toggle on/off). El default lo deja reservable, pero personalizar días/horas requeriría una feature nueva (candidata a escalar si se pide).
- Deuda derivada de H-004 (HU-REC-003): falta la **exportación del resumen diario** en recepción.
- Nota HU-REC-001: recepción crea y reasigna citas; **editar** (p. ej. cambiar el servicio de una cita existente) no tiene UI dedicada más allá de reasignar/cobrar/transiciones.
- Nota FASE-06 (HU-ESP-006/007 vía admin): el admin **no** tiene un botón de "Walk-in"/"Atención pasada" dedicado como recepción/especialista; el ciclo se cubre creando una cita y operando sus transiciones (iniciar→cobrar) desde el menú de la fila. Un walk-in en vivo/retroactivo nativo desde admin sería una mejora (candidata a escalar si se pide).
- Nota FASE-14 (funnel): el alta/checkout del sitio es **maqueta visual** (la pasarela Wompi no procesa cobro real en v1); se verificó que no rompe ni promete cobro. Implementar el funnel real es trabajo futuro.
- Nota transversal (push en vivo): las vistas observadoras **no** tienen actualización en vivo; los flujos cruzados se verifican recargando la vista (patrón documentado). Un canal en tiempo real (WS/SSE) sería una mejora futura.

### Escalados pendientes de decisión del USUARIO (cierre V3)
Bajo fix-forward, los defectos puntuales quedaron **corregidos** en su fase. Estos requieren feature/rediseño y están en `test.fixme` o anotados:
- **H-004** — exportar resumen diario de recepción (no existe).
- **H-006** — reactivar cliente dado de baja (no existe endpoint/UI).
- **H-008** — exportar finanzas a **PDF** (solo hay CSV).
- Funnel de alta/checkout **real** (hoy maqueta visual, sin Wompi).
- Edición de ventanas de horario por especialista (deuda de H-002).
- Walk-in/retroactiva nativos desde admin; edición de servicio de una cita (REC).
