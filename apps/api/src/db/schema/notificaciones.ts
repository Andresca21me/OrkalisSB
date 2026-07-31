import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { negocio, sucursal } from './tenant';
import { cita } from './appointments';
import { canalEnvioEnum, canalMensajeriaEnum, estadoMensajeEnum, eventoPlantillaEnum } from './_shared';

/**
 * Consumo de mensajería por negocio/canal/**ciclo de cobro** (ADR-009, D1).
 *
 * FASE-03: el contador ya NO se indexa por mes calendario (`'YYYY-MM'`) sino por
 * la ventana `[ciclo_inicio, ciclo_fin)` del aniversario de cobro, que es cuando
 * el cliente realmente "recarga" sus cupos. `CuposService.cicloActual` deriva
 * esa ventana de `suscripcion.dia_cobro`/`proximo_cobro`.
 */
export const consumoMensajeria = pgTable(
  'consumo_mensajeria',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    negocioId: uuid('negocio_id')
      .notNull()
      .references(() => negocio.id, { onDelete: 'cascade' }),
    canal: canalMensajeriaEnum('canal').notNull(),
    cicloInicio: timestamp('ciclo_inicio', { withTimezone: true }).notNull(),
    cicloFin: timestamp('ciclo_fin', { withTimezone: true }).notNull(),
    cantidad: integer('cantidad').notNull().default(0),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: unique('consumo_mensajeria_uq').on(t.negocioId, t.canal, t.cicloInicio),
  }),
);

/**
 * Plantilla de mensaje por negocio/evento/canal (FASE-04, D5).
 *
 * Si un negocio no tiene fila para un evento, se usa el default de plataforma de
 * `templates.ts` — por eso todas las columnas de contenido son opcionales y la
 * tabla puede estar vacía sin que nada deje de funcionar.
 *
 * SMS lleva **texto libre** con variables `{{…}}`; WhatsApp NO puede llevar texto
 * libre fuera de la ventana de 24 h, así que guarda el **Content SID** de una
 * plantilla aprobada por Meta y el mapeo de sus variables posicionales.
 */
export const plantillaMensaje = pgTable(
  'plantilla_mensaje',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    negocioId: uuid('negocio_id')
      .notNull()
      .references(() => negocio.id, { onDelete: 'cascade' }),
    evento: eventoPlantillaEnum('evento').notNull(),
    /** Solo 'sms' | 'whatsapp' (el enum incluye 'email', validado en el DTO). */
    canal: canalEnvioEnum('canal').notNull(),
    contenidoSms: text('contenido_sms'),
    whatsappContentSid: text('whatsapp_content_sid'),
    /** Mapeo {"1":"cliente","2":"fecha"} → variables posicionales de Meta. */
    whatsappVariables: jsonb('whatsapp_variables').$type<Record<string, string>>(),
    activo: boolean('activo').notNull().default(true),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: unique('plantilla_mensaje_uq').on(t.negocioId, t.evento, t.canal),
  }),
);

/**
 * Aviso persistente para el administrador del negocio (FASE-03).
 *
 * Nace con las alertas de sobreconsumo de mensajería (80 % / 100 % del cupo),
 * pero es genérica a propósito para reusarla en morosidad u otros avisos. La
 * **anti-spam es de base de datos**: `clave` identifica el hecho concreto
 * (canal + umbral + ciclo) y el índice único hace que insertarla dos veces sea
 * un no-op, incluso con dos workers compitiendo.
 */
export const alertaAdmin = pgTable(
  'alerta_admin',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    negocioId: uuid('negocio_id')
      .notNull()
      .references(() => negocio.id, { onDelete: 'cascade' }),
    /** Familia del aviso: 'cupo_mensajeria' … */
    tipo: text('tipo').notNull(),
    /** Identidad del hecho, única por negocio: 'cupo:sms:80:2026-07-15'. */
    clave: text('clave').notNull(),
    severidad: text('severidad').notNull().default('aviso'), // 'aviso' | 'critico'
    titulo: text('titulo').notNull(),
    detalle: text('detalle'),
    leidaEn: timestamp('leida_en', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: unique('alerta_admin_clave_uq').on(t.negocioId, t.clave),
    idx: index('alerta_admin_negocio_creado_idx').on(t.negocioId, t.creadoEn),
  }),
);

/**
 * Outbox durable de mensajería (Plan-Mensajeria FASE-02, ADR-007).
 *
 * Es a la vez **cola** (el `OutboxWorker` reclama `pendiente` con `FOR UPDATE
 * SKIP LOCKED`), **log de auditoría** (queda el ciclo de vida completo con el
 * `proveedor_id`) y **fuente de métricas**. Reemplaza el fire-and-forget en
 * memoria: reiniciar el proceso ya no pierde mensajes.
 *
 * `canal` es el transporte (sms/whatsapp/email) y `cupo_canal` el canal lógico
 * de cupo del plan (ADR-009) — se separan porque WhatsApp utility y marketing
 * comparten transporte pero consumen cupos distintos.
 */
export const mensaje = pgTable(
  'mensaje',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /**
     * NULL = correo de PLATAFORMA (Plan-Correo): la verificación del alta ocurre
     * antes de que exista el negocio. La política RLS por tenant no matchea NULL,
     * así que esas filas solo las ve el rol dueño (adminDb), que es quien las
     * inserta y quien las despacha (el worker ya corre con adminDb).
     */
    negocioId: uuid('negocio_id').references(() => negocio.id, { onDelete: 'cascade' }),
    sucursalId: uuid('sucursal_id').references(() => sucursal.id, { onDelete: 'set null' }),
    canal: canalEnvioEnum('canal').notNull(),
    /** Canal que se quería usar, si hubo que degradar (FASE-05). */
    canalPreferido: canalEnvioEnum('canal_preferido'),
    /** Por qué se degradó de canal (auditoría del routing). */
    motivoFallback: text('motivo_fallback'),
    cupoCanal: canalMensajeriaEnum('cupo_canal').notNull(),
    /** 'otp' | 'confirmacion' | 'recordatorio' | 'aviso' … (texto: crece por fase). */
    tipo: text('tipo').notNull(),
    /** Transaccional = no se corta al agotarse el cupo (solo se avisa). */
    transaccional: boolean('transaccional').notNull().default(true),
    destino: text('destino').notNull(),
    /** Clave de plantilla (WhatsApp/Meta, FASE-04/05). */
    plantillaClave: text('plantilla_clave'),
    cuerpo: text('cuerpo'),
    /** Email: versión HTML del cuerpo (Plan-Correo). `cuerpo` queda de fallback plano. */
    cuerpoHtml: text('cuerpo_html'),
    variables: jsonb('variables').$type<Record<string, string>>(),
    asunto: text('asunto'),
    estado: estadoMensajeEnum('estado').notNull().default('pendiente'),
    /** Se envió pese a tener el cupo agotado (transaccional). */
    sobreCupo: boolean('sobre_cupo').notNull().default(false),
    proveedor: text('proveedor'),
    /** SID de Twilio / x-message-id de SendGrid: enlaza el webhook de estado. */
    proveedorId: text('proveedor_id'),
    error: text('error'),
    intento: integer('intento').notNull().default(0),
    proximoIntentoEn: timestamp('proximo_intento_en', { withTimezone: true }).notNull().defaultNow(),
    citaId: uuid('cita_id').references(() => cita.id, { onDelete: 'set null' }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
    enviadoEn: timestamp('enviado_en', { withTimezone: true }),
    entregadoEn: timestamp('entregado_en', { withTimezone: true }),
  },
  (t) => ({
    idxNegocio: index('mensaje_negocio_creado_idx').on(t.negocioId, t.creadoEn),
    idxEstado: index('mensaje_estado_idx').on(t.estado),
    idxProveedor: index('mensaje_proveedor_id_idx').on(t.proveedorId),
  }),
);

/**
 * Saldo de mensajería de la PLATAFORMA (no de un negocio): el interruptor que
 * apaga los envíos cuando se acaba el crédito comprado al proveedor.
 *
 * **Por qué existe.** El crédito de Twilio es finito y compartido por todos los
 * negocios. Cuando se agota, cada envío falla: los OTP no llegan y nadie puede
 * reservar ni dar de alta a un especialista — la plataforma entera queda
 * inservible por algo que no tiene que ver con ella. Con este interruptor, al
 * quedarse sin saldo se pasa a **modo sin mensajes**: los códigos se muestran en
 * pantalla y los recordatorios se dejan de encolar, y todo lo demás sigue igual.
 *
 * Es una tabla de **una sola fila** (`id = 1`, garantizado por el CHECK de la
 * migración). Vive en base de datos y no en una variable de entorno porque tiene
 * que poder apagarse sola a mitad de un envío y volver a encenderse desde la
 * consola sin redesplegar.
 *
 * No lleva `negocio_id` ni política de tenant: la migración le pone RLS con una
 * política que niega todo, de forma que solo el rol dueño (`adminDb`) la ve.
 */
export const mensajeriaSaldo = pgTable('mensajeria_saldo', {
  id: integer('id').primaryKey().default(1),
  /** false = modo sin mensajes (nada sale hacia el proveedor). */
  activa: boolean('activa').notNull().default(true),
  /** Segmentos comprados en el ciclo actual. 0 = sin tope (solo apagado manual). */
  presupuesto: integer('presupuesto').notNull().default(0),
  /** Segmentos ya gastados. Se cuentan segmentos, que es lo que factura Twilio. */
  consumidos: integer('consumidos').notNull().default(0),
  /** Por qué se apagó: presupuesto agotado, rechazo del proveedor o mano humana. */
  motivo: text('motivo'),
  pausadaEn: timestamp('pausada_en', { withTimezone: true }),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});
