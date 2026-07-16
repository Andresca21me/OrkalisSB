import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { negocio } from './tenant';
import { canalMensajeriaEnum } from './_shared';

/**
 * Consumo de mensajería por negocio/canal/período (FASE-11, ADR-009).
 * Contador para comparar contra el cupo del plan en el período de facturación.
 */
export const consumoMensajeria = pgTable(
  'consumo_mensajeria',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    negocioId: uuid('negocio_id')
      .notNull()
      .references(() => negocio.id, { onDelete: 'cascade' }),
    canal: canalMensajeriaEnum('canal').notNull(),
    periodo: text('periodo').notNull(), // 'YYYY-MM'
    cantidad: integer('cantidad').notNull().default(0),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: unique('consumo_mensajeria_uq').on(t.negocioId, t.canal, t.periodo),
  }),
);
