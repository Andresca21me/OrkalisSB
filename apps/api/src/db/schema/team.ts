import { sql } from 'drizzle-orm';
import { boolean, customType, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { negocio, sucursal, usuario } from './tenant';
import { servicio } from './catalog';
import { estadoVerificacionEnum } from './_shared';

/**
 * Grupo B — Equipo (FASE-03, ADR-001).
 * Un especialista pertenece a varias sucursales pero opera en una a la vez.
 */

export const especialista = pgTable('especialista', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  apellidos: text('apellidos'),
  especialidad: text('especialidad'),
  /** Celular en E.164. Nulo en los especialistas creados antes de FASE-06. */
  telefono: text('telefono'),
  /** Marca de verificación por código (Twilio Verify, D3). */
  telefonoVerificadoEn: timestamp('telefono_verificado_en', { withTimezone: true }),
  disponible: boolean('disponible').notNull().default(true),
  // Opcional: si el especialista inicia sesión, se enlaza a un usuario.
  usuarioId: uuid('usuario_id').references(() => usuario.id, { onDelete: 'set null' }),
  activo: boolean('activo').notNull().default(true),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }),
});

/** Relación N:N especialista↔sucursal. PK compuesta. */
export const especialistaSucursal = pgTable(
  'especialista_sucursal',
  {
    especialistaId: uuid('especialista_id')
      .notNull()
      .references(() => especialista.id, { onDelete: 'cascade' }),
    sucursalId: uuid('sucursal_id')
      .notNull()
      .references(() => sucursal.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.especialistaId, t.sucursalId] }),
  }),
);

/**
 * Relación N:N especialista↔servicio: qué servicios está capacitado para realizar.
 *
 * **Ausencia total de filas = realiza TODOS los servicios.** Es la misma
 * convención de `sucursal_dia_laborable` y `servicio_dia` (ausencia = permitido),
 * y es lo que hace que introducir esta tabla no cambie el comportamiento de los
 * negocios que ya existen: nadie desaparece del enlace de reservas al desplegar.
 * El filtrado solo empieza a actuar cuando el admin asigna un subconjunto.
 *
 * Para "que no reciba reservas" NO se usa una lista vacía, sino el interruptor
 * `especialista.disponible`.
 */
export const especialistaServicio = pgTable(
  'especialista_servicio',
  {
    especialistaId: uuid('especialista_id')
      .notNull()
      .references(() => especialista.id, { onDelete: 'cascade' }),
    servicioId: uuid('servicio_id')
      .notNull()
      .references(() => servicio.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.especialistaId, t.servicioId] }),
  }),
);

/**
 * Foto de perfil del especialista.
 *
 * Va en su propia tabla, y no como columna de `especialista`, por una razón
 * práctica: la agenda pide el listado del equipo constantemente y arrastrar unos
 * KB de imagen por fila en cada consulta lo haría lento sin necesidad. Aquí la
 * imagen solo se lee cuando alguien pide la foto concreta, y el navegador la
 * cachea.
 *
 * `actualizado_en` hace de versión: la URL de la foto la incluye, así se puede
 * cachear para siempre y aun así cambiar en cuanto el admin sube otra.
 */
export const especialistaFoto = pgTable('especialista_foto', {
  especialistaId: uuid('especialista_id')
    .primaryKey()
    .references(() => especialista.id, { onDelete: 'cascade' }),
  /** 'image/jpeg' | 'image/png' | 'image/webp'. */
  mime: text('mime').notNull(),
  datos: customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })('datos').notNull(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Alta de especialista en curso, pendiente de verificar el celular (FASE-06, D3).
 *
 * El especialista **no existe** hasta que el código es correcto: aquí se guarda
 * el borrador de sus datos. Así un alta abandonada no deja registros a medias ni
 * consume cupo del plan.
 *
 * `datos_borrador` NUNCA guarda la contraseña en claro: si el alta incluye
 * acceso al panel, se guarda ya el hash argon2.
 */
export const verificacionEspecialista = pgTable('verificacion_especialista', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  negocioId: uuid('negocio_id')
    .notNull()
    .references(() => negocio.id, { onDelete: 'cascade' }),
  telefono: text('telefono').notNull(),
  datosBorrador: jsonb('datos_borrador').$type<Record<string, unknown>>().notNull(),
  estado: estadoVerificacionEnum('estado').notNull().default('pendiente'),
  intentos: integer('intentos').notNull().default(0),
  reenvios: integer('reenvios').notNull().default(0),
  /**
   * Código generado por NOSOTROS, hasheado, cuando la mensajería está en modo
   * sin mensajes. Normalmente el código lo gestiona Twilio Verify y nunca lo
   * conocemos; si no hay envíos, se genera aquí y se le enseña al admin en
   * pantalla para que pueda terminar el alta. `null` = verificación por Verify.
   */
  codigoLocalHash: text('codigo_local_hash'),
  /** Para el cooldown entre reenvíos. */
  ultimoEnvioEn: timestamp('ultimo_envio_en', { withTimezone: true }).notNull().defaultNow(),
  expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});
