# _HUECOS-BACKEND · Lista consolidada (FASE-00)

> Catálogo de huecos del backend `apps/api` que las fases de UI deberán cerrar. **En FASE-00 no se
> implementa ninguno** — solo se catalogan. Cada hueco se implementa en su **fase dueña** con
> servicio + controlador y, si toca esquema, **migración Drizzle versionada** (siguiente número tras
> `0006_shocking_morlocks.sql`), respetando multi-tenant + RLS (vía el repositorio base / contexto
> de tenant, nunca saltándose el aislamiento).
>
> Verificado contra el código real (controladores y servicios de `apps/api/src`, junio 2026).

| ID | Pantalla / necesidad | Estado actual | Qué falta | Fase | Migración |
|----|----|----|----|----|----|
| ~~**H1**~~ ✅ | Reserva pública · "cualquiera disponible" + `servicioIds` | **CERRADO (FASE-03).** `disponibilidad` ahora acepta `especialista=any` (agrega sobre todos los especialistas de la sede, asigna el primero libre por franja y devuelve `especialistaId`) y `servicios` (csv, suma duraciones). Añadidos además `GET /public/:sucursalId/cita/:id` y `POST /public/:sucursalId/cita/buscar` (recuperar cita por código+teléfono), y `perfil` en `info`. | **03** | No |
| ~~**H2**~~ ✅ | Admin · Panel (KPIs) | **CERRADO (FASE-05).** Añadido `GET /reportes/panel?fecha&sucursalId` → citas hoy/ayer (delta), ingresos estimados, ticket promedio, especialistas disponibles/total, próxima cita y resumen del mes (ingresos/ganProf/ganSalón/productos). Además: `GET /citas` **enriquecido** (cliente/especialista/servicios → `CitaAgenda`) y nuevo `POST /citas` (cita agendada interna confirmada). | **05** | No |
| **H3** | Spec · Ganancias | No existe endpoint de resumen por especialista | `GET /especialistas/:id/ganancias?periodo` (hoy/semana/mes) derivando de `atencion`/`liquidacion`/`ventaProducto` filtrado por especialista | **10** | No (deriva de tablas existentes) |
| **H4** | Recepción · Reasignar cita | No existe transición ni endpoint (`grep reasign` = 0 resultados); solo cancelar/walk-in | `POST /citas/:id/reasignar` (cambiar `especialistaId` respetando el EXCLUDE anti-solape) o modelarlo como edición de cita | **11** | Posible (si se audita el cambio); el cambio de columna no requiere migración |
| **H5** | Config · Notificaciones + cupos | `notificaciones.module` solo expone servicios internos (`NotificacionesService`, `CuposService`, `JobQueue`); **sin controlador HTTP**. Tablas `consumo_mensajeria` existen | Controlador de Notificaciones: leer/editar config de canales y plantillas (vía `config`), y **exponer consumo/cupos** del período (`GET /notificaciones/cupos`) | **09** | No (tablas existen) |
| **H6** | Config · Usuarios internos | Hay CRUD de `especialista` (equipo) pero no de `usuario` por rol; `POST /negocios` solo crea el admin inicial | CRUD de **usuarios internos** (recepcionista/especialista con login): alta, edición, desactivar, asignar sucursales/rol. P. ej. `GET/POST/PATCH/DELETE /usuarios` | **09** | No (tabla `usuario` existe) |
| **H7** | Finanzas · Análisis (gráficas) | `GET /reportes/financiero` es puntual por rango | (Opcional) endpoint de **serie temporal** (`GET /reportes/serie?desde&hasta&agrupacion=dia\|semana`) para no hacer N llamadas desde recharts | **08** | No |
| **H8** | Sitio · Alta self-service + Wompi | `POST /negocios` existe; `POST /pagos/wompi/webhook` existe; falta creación de transacción y flujo de alta público | **DIFERIDO** (decisión de alcance #1): en v2 el sitio es **solo visual**. No se implementa el alta ni el checkout Wompi | **12** | No (diferido) |

## Notas de implementación

- **Numeración de migraciones:** la última es `0006_shocking_morlocks.sql`. La siguiente que toque
  esquema usa `0007_*` (generada por `pnpm --filter api db:generate`). De los huecos de arriba,
  **ninguno exige cambio de esquema obligatorio**; H4 podría añadir auditoría opcional.
- **RLS:** todo endpoint nuevo pasa por el repositorio base con contexto de tenant
  (`SET LOCAL app.current_tenant`), igual que el resto de `operacion`. Nunca usar `adminDb` en
  código de dominio (eso es solo para seed/migraciones).
- **Roles:** respetar los guards existentes (`@Roles(...)`). Ganancias = especialista; dashboard,
  notificaciones, usuarios = admin; reasignar = admin/recepcionista; plataforma = operador.
- **Tipos:** cada respuesta nueva define su DTO en `packages/shared/src/dtos.ts` (hoy placeholder)
  para que el front la consuma tipada (ADR-008).

## Lo que NO es hueco (verificado, ya cubierto)

- `GET /citas` **sí** acepta rango `desde`/`hasta` + `sucursalId`/`especialistaId` → agenda
  semanal/diaria del admin y del especialista no requiere ampliación.
- Inventario expone `alertas` (stock bajo) y `valoracion` → la pantalla de inventario está completa.
- Liquidaciones (`generar` + `csv`), gastos, cierres, clientes (+historial), servicios (+split),
  suscripción (plan/nº) y plataforma (suscripciones/cobro/suspender/reactivar) están **completos**.
</content>
