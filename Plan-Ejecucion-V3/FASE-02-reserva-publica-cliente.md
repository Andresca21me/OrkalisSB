# FASE-02 · Reserva pública del cliente (CLI)

## Objetivo
Probar de extremo a extremo, **por la UI**, el flujo de reserva del cliente: desde abrir el enlace hasta la confirmación, pasando por selección de sucursal/servicio/especialista, franjas en tiempo real, identificación por OTP, y la gestión posterior (consultar/cancelar/reagendar). Incluye **concurrencia** (sin doble reserva) y todos los estados de error/borde. Es el flujo más crítico del negocio y el origen del flujo cruzado de la FASE-03.

## Prerrequisitos
- FASE-00 (oráculo para ids/franjas; OTP `devCode`). Seed + API.

## Pantallas / rutas bajo prueba
- `BookingPage` (`/reservar/:sucursalId`) — `apps/web/src/pages/public/BookingPage.tsx`.
- Endpoints públicos `public/:suc/{info,servicios,especialistas,disponibilidad,retener,otp/enviar,confirmar,cita/*}`.

## Casos de prueba

### Apertura y selección (HU-CLI-001, 002)
1. **Carga del enlace de sucursal**: `/reservar/:suc` muestra el nombre del negocio/sucursal y el catálogo de servicios (estado con datos).
2. **Estados de carga/error de la página**: aparece skeleton/spinner al cargar; si `info` falla (interceptar 5xx) se ve `ErrorState` con reintento.
3. **Elegir servicio**: seleccionar "Corte" avanza y refleja su duración/precio.
4. **Elegir especialista** (o "cualquiera"): la lista muestra los especialistas de esa sede; elegir uno filtra la disponibilidad.
5. **Ver franjas en tiempo real**: las franjas mostradas corresponden a la duración del servicio; cambiar de fecha actualiza las franjas.
6. **Especialista/fecha sin disponibilidad**: cuando no hay franjas, se muestra el mensaje vacío y la opción de otra fecha/especialista (no una grilla vacía confusa).

### Identificación por OTP (HU-CLI-004)
7. **OTP feliz**: ingresar teléfono → solicitar código → interceptar `otp/enviar` para leer `devCode` → teclearlo → avanza a confirmación.
8. **OTP incorrecto**: teclear un código equivocado → el sistema rechaza y permite reenviar/reintentar.
9. **Reenviar código**: solicitar de nuevo genera un código válido y permite continuar.

### Reserva y confirmación (HU-CLI-003, 005)
10. **Reserva confirmada**: completar el flujo crea la cita; la pantalla de confirmación muestra los datos del turno (servicio, especialista, fecha/hora) y un código/identificador.
11. **Concurrencia (sin doble reserva)**: dos clientes (dos contextos / dos teléfonos) intentan la **misma** franja; uno confirma y el otro recibe "ya no disponible" con alternativas — **nunca** dos citas distintas en la misma franja (garantía `EXCLUDE`).
12. **Reserva con aprobación manual** (si la sucursal lo activa): la cita entra como "Solicitada" en vez de "Confirmada" *(cubre HU-ESP-002 escenario 2; coordinar con FASE-10 config)*.

### Gestión de la cita (HU-CLI-006)
13. **Consultar cita**: con el identificador/teléfono, el cliente recupera el detalle de su cita.
14. **Cancelar dentro de plazo**: cancelar libera la franja (verificable porque vuelve a ofrecerse en disponibilidad).
15. **Cancelar/reagendar fuera de regla**: si la antelación no lo permite, el sistema aplica la regla y lo informa.

### Estados transversales
16. **Cargando/vacío/error/conflicto** presentes en cada paso del asistente (conflicto = caso 11).

## Datos de prueba
- Sucursal *Sede Centro* (barbería). Servicio "Corte". Teléfonos únicos por prueba. Franja hallada con el oráculo (hoy..+10).
- La cita creada queda en el sistema y **se reutiliza** como insumo de la FASE-03 (reflejo en otras vistas).

## Huecos de testabilidad
- Pasos del asistente: si los botones "Siguiente/Confirmar" o las franjas no son localizables de forma estable, añadir `data-testid="slot-{horaISO}"`, `data-testid="booking-next"`, `data-testid="booking-otp-input"`, `data-testid="booking-confirm"`.
- Confirmación: `data-testid="booking-confirmacion"` con el código de cita visible.

## Verificación / Done
- Flujo feliz completo por UI crea una cita confirmada con datos correctos.
- OTP (feliz, incorrecto, reenvío) cubierto.
- Concurrencia demostrada sin doble reserva.
- Gestión (consultar/cancelar) y todos los estados cubiertos.
- `specs/02-reserva/*` verde y estable.

## Trazabilidad
- HU-CLI-001..006, HU-ESP-002 (escenario manual). ADR-001 (concurrencia/EXCLUDE). Expande `booking.spec.ts` de la v2 a UI completa.
