/**
 * Esquema Drizzle — reexporta TODO el esquema de la base de datos (FASE-03).
 * Drizzle usa este barrel para construir el `schema` del cliente y para
 * `drizzle-kit generate`.
 */

export * from './_shared';
export * from './tenant'; // Grupo A — tenencia y cuenta
export * from './auth'; // Grupo Auth — refresh tokens (FASE-05)
export * from './team'; // Grupo B — equipo
export * from './catalog'; // Grupo C — clientes y catálogo
export * from './appointments'; // Grupo D — citas y atenciones
export * from './inventory'; // Grupo E — inventario y ventas
export * from './finance'; // Grupo F — finanzas
export * from './config'; // Grupo G — configuración
export * from './scheduling'; // Grupo H — soporte de agendamiento
export * from './notificaciones'; // Consumo de mensajería (FASE-11)
export * from './pagos'; // Cobro de suscripción (FASE-12)
