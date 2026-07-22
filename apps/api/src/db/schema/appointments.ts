import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, numeric, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { negocio, sucursal } from './tenant';
import { especialista } from './team';
import { cliente, servicio } from './catalog';
import { producto } from './inventory';
import { estadoCitaEnum, metodoPagoEnum, origenCitaEnum, tstzrange, ventanaRecordatorioEnum } from './_shared';

/**
 * Grupo D — Operación: citas y atenciones (FASE-03, ADR-005/ADR-006).
 * Operativas → llevan `sucursal_id` además de `negocio_id`.
 */

export const cita = pgTable(
  'cita',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    negocioId: uuid('negocio_id')
      .notNull()
      .references(() => negocio.id, { onDelete: 'cascade' }),
    sucursalId: uuid('sucursal_id')
      .notNull()
      .references(() => sucursal.id, { onDelete: 'cascade' }),
    // Nullable para walk-in sin datos de cliente.
    clienteId: uuid('cliente_id').references(() => cliente.id, { onDelete: 'set null' }),
    especialistaId: uuid('especialista_id')
      .notNull()
      .references(() => especialista.id, { onDelete: 'restrict' }),
    inicio: timestamp('inicio', { withTimezone: true }).notNull(),
    fin: timestamp('fin', { withTimezone: true }).notNull(),
    // Rango generado a partir de inicio/fin; lo usa el EXCLUDE anti doble-reserva.
    rango: tstzrange('rango')
      .notNull()
      .generatedAlwaysAs(sql`tstzrange(inicio, fin)`),
    estado: estadoCitaEnum('estado').notNull(),
    origen: origenCitaEnum('origen').notNull(),
    precioEst: numeric('precio_est', { precision: 12, scale: 2 }),
    // Evita recordatorios duplicados (FASE-11).
    /**
     * @deprecated FASE-08 — sustituido por `cita_recordatorio`, que soporta
     * varias ventanas. Se conserva la columna (sin uso) para no romper al
     * contenedor viejo durante el despliegue; se eliminará en una limpieza.
     */
    recordatorioEnviado: boolean('recordatorio_enviado').notNull().default(false),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }),
  },
  (t) => ({
    negocioSucursalInicioIdx: index('cita_negocio_sucursal_inicio_idx').on(
      t.negocioId,
      t.sucursalId,
      t.inicio,
    ),
    especialistaInicioIdx: index('cita_especialista_inicio_idx').on(t.especialistaId, t.inicio),
    // El constraint EXCLUDE `cita_no_solape` se añade vía SQL crudo en la
    // migración (Drizzle no lo expresa de forma declarativa).
  }),
);

export const citaServicio = pgTable('cita_servicio', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  citaId: uuid('cita_id')
    .notNull()
    .references(() => cita.id, { onDelete: 'cascade' }),
  servicioId: uuid('servicio_id')
    .notNull()
    .references(() => servicio.id, { onDelete: 'restrict' }),
  precioAplicado: numeric('precio_aplicado', { precision: 12, scale: 2 }).notNull(),
});

/** Cierre financiero del turno al completar (ADR-006). */
export const atencion = pgTable('atencion', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  sucursalId: uuid('sucursal_id')
    .notNull()
    .references(() => sucursal.id, { onDelete: 'cascade' }),
  citaId: uuid('cita_id')
    .notNull()
    .references(() => cita.id, { onDelete: 'restrict' }),
  especialistaId: uuid('especialista_id')
    .notNull()
    .references(() => especialista.id, { onDelete: 'restrict' }),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  ganProf: numeric('gan_prof', { precision: 12, scale: 2 }).notNull(),
  ganSalon: numeric('gan_salon', { precision: 12, scale: 2 }).notNull(),
  metodoPago: metodoPagoEnum('metodo_pago').notNull(),
  // Snapshot de porcentajes/valores aplicados al completar (ADR-006).
  snapshotParam: jsonb('snapshot_param').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const atencionProducto = pgTable('atencion_producto', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  atencionId: uuid('atencion_id')
    .notNull()
    .references(() => atencion.id, { onDelete: 'cascade' }),
  productoId: uuid('producto_id')
    .notNull()
    .references(() => producto.id, { onDelete: 'restrict' }),
  cantidad: integer('cantidad').notNull(),
  valor: numeric('valor', { precision: 12, scale: 2 }).notNull(),
});

/**
 * Desglose del pago de una atención (Plan-Finanzas). Permite dividir el cobro en
 * varios métodos (efectivo + transferencia…). La suma de `monto` = `atencion.total`.
 * `atencion.metodo_pago` guarda el método dominante (mayor monto) por compatibilidad.
 */
export const atencionPago = pgTable('atencion_pago', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  atencionId: uuid('atencion_id')
    .notNull()
    .references(() => atencion.id, { onDelete: 'cascade' }),
  metodo: metodoPagoEnum('metodo').notNull(),
  monto: numeric('monto', { precision: 12, scale: 2 }).notNull(),
});

/**
 * Recordatorios ya resueltos de una cita (FASE-08).
 *
 * Sustituye al booleano `cita.recordatorio_enviado`, que solo permitía UNA
 * ventana. La **clave primaria `(cita_id, ventana)`** es la garantía de
 * no-duplicado: aunque el scheduler se reinicie a mitad de escaneo, insertar dos
 * veces la misma ventana es imposible.
 *
 * `enviado_en` NULO significa "ventana consumida sin enviar": la cita se creó
 * cuando esa ventana ya había pasado (p. ej. reserva para dentro de 1 h, donde
 * el aviso de 24 h ya no es alcanzable). Se registra igual para que no vuelva a
 * evaluarse.
 */
export const citaRecordatorio = pgTable(
  'cita_recordatorio',
  {
    citaId: uuid('cita_id')
      .notNull()
      .references(() => cita.id, { onDelete: 'cascade' }),
    ventana: ventanaRecordatorioEnum('ventana').notNull(),
    enviadoEn: timestamp('enviado_en', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.citaId, t.ventana] }),
  }),
);
