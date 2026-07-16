import { sql } from 'drizzle-orm';
import { integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { negocio } from './tenant';
import { estadoCobroEnum } from './_shared';

/**
 * Cobro de la suscripción del negocio (ADR-009). Un registro por ciclo mensual;
 * rastrea el monto, su estado de pago y el pago de Mercado Pago. Puede haber
 * varios intentos dentro de un período en caso de morosidad (Plan-Pagos FASE-07).
 */
export const cobro = pgTable('cobro', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  periodo: text('periodo').notNull(), // 'YYYY-MM'
  monto: numeric('monto', { precision: 12, scale: 2 }).notNull(),
  estado: estadoCobroEnum('estado').notNull().default('pendiente'),
  // Referencia propia (external_reference + X-Idempotency-Key del pago en MP).
  referencia: text('referencia').notNull().unique(),
  mpPaymentId: text('mp_payment_id'), // id del pago de Mercado Pago
  intento: integer('intento').notNull().default(1), // nº de intento dentro del período
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  pagadoEn: timestamp('pagado_en', { withTimezone: true }),
});
