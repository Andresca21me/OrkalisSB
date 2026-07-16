CREATE TYPE "public"."estado_cita" AS ENUM('solicitada', 'confirmada', 'en_progreso', 'completada', 'cancelada', 'no_asistio');--> statement-breakpoint
CREATE TYPE "public"."estado_suscripcion" AS ENUM('activa', 'suspendida');--> statement-breakpoint
CREATE TYPE "public"."metodo_pago" AS ENUM('efectivo', 'tarjeta', 'transferencia', 'nequi', 'otro');--> statement-breakpoint
CREATE TYPE "public"."nivel_config" AS ENUM('sistema', 'negocio', 'sucursal');--> statement-breakpoint
CREATE TYPE "public"."origen_cita" AS ENUM('agendamiento_publico', 'creacion_interna');--> statement-breakpoint
CREATE TYPE "public"."perfil_negocio" AS ENUM('salon', 'barberia');--> statement-breakpoint
CREATE TYPE "public"."rol_usuario" AS ENUM('admin', 'especialista', 'recepcionista', 'operador_plataforma');--> statement-breakpoint
CREATE TYPE "public"."split_type" AS ENUM('porcentaje', 'valor_fijo');--> statement-breakpoint
CREATE TYPE "public"."tipo_cierre" AS ENUM('quincenal', 'mensual');--> statement-breakpoint
CREATE TYPE "public"."tipo_gasto" AS ENUM('fijo', 'variable');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento" AS ENUM('entrada', 'salida', 'ajuste');--> statement-breakpoint
CREATE TYPE "public"."tipo_producto" AS ENUM('servicio', 'venta');--> statement-breakpoint
CREATE TABLE "atencion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"cita_id" uuid NOT NULL,
	"especialista_id" uuid NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"gan_prof" numeric(12, 2) NOT NULL,
	"gan_salon" numeric(12, 2) NOT NULL,
	"metodo_pago" "metodo_pago" NOT NULL,
	"snapshot_param" jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "atencion_producto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"atencion_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	"valor" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cita" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"cliente_id" uuid,
	"especialista_id" uuid NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"rango" "tstzrange" GENERATED ALWAYS AS (tstzrange(inicio, fin)) STORED NOT NULL,
	"estado" "estado_cita" NOT NULL,
	"origen" "origen_cita" NOT NULL,
	"precio_est" numeric(12, 2),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cita_servicio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cita_id" uuid NOT NULL,
	"servicio_id" uuid NOT NULL,
	"precio_aplicado" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cliente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "servicio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"precio" numeric(12, 2) NOT NULL,
	"duracion_min" integer NOT NULL,
	"categoria" text,
	"split_type" "split_type" DEFAULT 'porcentaje' NOT NULL,
	"split_valor" numeric(12, 2) DEFAULT '0' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "configuracion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"nivel" "nivel_config" NOT NULL,
	"ambito_id" uuid NOT NULL,
	"clave" text NOT NULL,
	"valor" jsonb NOT NULL,
	"tipo" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone,
	CONSTRAINT "configuracion_override_uq" UNIQUE("negocio_id","nivel","ambito_id","clave")
);
--> statement-breakpoint
CREATE TABLE "cierre_periodo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"tipo" "tipo_cierre" NOT NULL,
	"desde" timestamp with time zone NOT NULL,
	"hasta" timestamp with time zone NOT NULL,
	"datos_archivados" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gasto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"tipo" "tipo_gasto" NOT NULL,
	"categoria" text,
	"monto" numeric(12, 2) NOT NULL,
	"frecuencia" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquidacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"especialista_id" uuid NOT NULL,
	"periodo" text NOT NULL,
	"bruto" numeric(12, 2) NOT NULL,
	"descuento" numeric(12, 2) DEFAULT '0' NOT NULL,
	"neto" numeric(12, 2) NOT NULL,
	"pagado" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negocio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"perfil" "perfil_negocio" NOT NULL,
	"estado_suscripcion" "estado_suscripcion" DEFAULT 'activa' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sucursal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "suscripcion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"num_sucursales" integer DEFAULT 1 NOT NULL,
	"estado" "estado_suscripcion" DEFAULT 'activa' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol_usuario" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone,
	CONSTRAINT "usuario_email_negocio_uq" UNIQUE("negocio_id","email")
);
--> statement-breakpoint
CREATE TABLE "usuario_sucursal" (
	"usuario_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	CONSTRAINT "usuario_sucursal_usuario_id_sucursal_id_pk" PRIMARY KEY("usuario_id","sucursal_id")
);
--> statement-breakpoint
CREATE TABLE "especialista" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"especialidad" text,
	"disponible" boolean DEFAULT true NOT NULL,
	"usuario_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "especialista_sucursal" (
	"especialista_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	CONSTRAINT "especialista_sucursal_especialista_id_sucursal_id_pk" PRIMARY KEY("especialista_id","sucursal_id")
);
--> statement-breakpoint
CREATE TABLE "movimiento_inventario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"tipo_mov" "tipo_movimiento" NOT NULL,
	"cantidad" integer NOT NULL,
	"motivo" text,
	"gasto_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_producto" NOT NULL,
	"cantidad" integer DEFAULT 0 NOT NULL,
	"stock_min" integer DEFAULT 0 NOT NULL,
	"costo" numeric(12, 2) DEFAULT '0' NOT NULL,
	"precio_venta" numeric(12, 2) DEFAULT '0' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "venta_producto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"especialista_id" uuid,
	"producto_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"comision_prof" numeric(12, 2) DEFAULT '0' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disponibilidad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"especialista_id" uuid NOT NULL,
	"dia_semana" integer,
	"fecha" date,
	"hora_inicio" time NOT NULL,
	"hora_fin" time NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codigo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid,
	"telefono" text NOT NULL,
	"codigo_hash" text NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"consumido" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retencion_franja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"especialista_id" uuid NOT NULL,
	"rango" "tstzrange" NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atencion" ADD CONSTRAINT "atencion_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atencion" ADD CONSTRAINT "atencion_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atencion" ADD CONSTRAINT "atencion_cita_id_cita_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."cita"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atencion" ADD CONSTRAINT "atencion_especialista_id_especialista_id_fk" FOREIGN KEY ("especialista_id") REFERENCES "public"."especialista"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atencion_producto" ADD CONSTRAINT "atencion_producto_atencion_id_atencion_id_fk" FOREIGN KEY ("atencion_id") REFERENCES "public"."atencion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atencion_producto" ADD CONSTRAINT "atencion_producto_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_especialista_id_especialista_id_fk" FOREIGN KEY ("especialista_id") REFERENCES "public"."especialista"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita_servicio" ADD CONSTRAINT "cita_servicio_cita_id_cita_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."cita"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita_servicio" ADD CONSTRAINT "cita_servicio_servicio_id_servicio_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicio"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierre_periodo" ADD CONSTRAINT "cierre_periodo_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cierre_periodo" ADD CONSTRAINT "cierre_periodo_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gasto" ADD CONSTRAINT "gasto_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gasto" ADD CONSTRAINT "gasto_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_especialista_id_especialista_id_fk" FOREIGN KEY ("especialista_id") REFERENCES "public"."especialista"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sucursal" ADD CONSTRAINT "sucursal_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suscripcion" ADD CONSTRAINT "suscripcion_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_sucursal" ADD CONSTRAINT "usuario_sucursal_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_sucursal" ADD CONSTRAINT "usuario_sucursal_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "especialista" ADD CONSTRAINT "especialista_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "especialista" ADD CONSTRAINT "especialista_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "especialista_sucursal" ADD CONSTRAINT "especialista_sucursal_especialista_id_especialista_id_fk" FOREIGN KEY ("especialista_id") REFERENCES "public"."especialista"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "especialista_sucursal" ADD CONSTRAINT "especialista_sucursal_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_gasto_id_gasto_id_fk" FOREIGN KEY ("gasto_id") REFERENCES "public"."gasto"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto" ADD CONSTRAINT "producto_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto" ADD CONSTRAINT "producto_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_producto" ADD CONSTRAINT "venta_producto_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_producto" ADD CONSTRAINT "venta_producto_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_producto" ADD CONSTRAINT "venta_producto_especialista_id_especialista_id_fk" FOREIGN KEY ("especialista_id") REFERENCES "public"."especialista"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_producto" ADD CONSTRAINT "venta_producto_producto_id_producto_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_especialista_id_especialista_id_fk" FOREIGN KEY ("especialista_id") REFERENCES "public"."especialista"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codigo" ADD CONSTRAINT "otp_codigo_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retencion_franja" ADD CONSTRAINT "retencion_franja_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retencion_franja" ADD CONSTRAINT "retencion_franja_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retencion_franja" ADD CONSTRAINT "retencion_franja_especialista_id_especialista_id_fk" FOREIGN KEY ("especialista_id") REFERENCES "public"."especialista"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cita_negocio_sucursal_inicio_idx" ON "cita" USING btree ("negocio_id","sucursal_id","inicio");--> statement-breakpoint
CREATE INDEX "cita_especialista_inicio_idx" ON "cita" USING btree ("especialista_id","inicio");--> statement-breakpoint
CREATE INDEX "cliente_negocio_telefono_idx" ON "cliente" USING btree ("negocio_id","telefono");--> statement-breakpoint
-- FASE-03 · Constraints EXCLUDE anti doble-reserva (ADR-005), añadidos a mano:
-- Drizzle no expresa EXCLUDE de forma declarativa. Requieren btree_gist (FASE-02).
ALTER TABLE "cita" ADD CONSTRAINT "cita_no_solape" EXCLUDE USING gist ("especialista_id" WITH =, "sucursal_id" WITH =, "rango" WITH &&) WHERE (estado IN ('confirmada','en_progreso'));--> statement-breakpoint
-- Nota: el doc sugería WHERE (expira_en > now()), pero Postgres no admite
-- funciones no-IMMUTABLE (now()) en el predicado de un constraint. Se aplica
-- sin predicado: dos retenciones del mismo especialista/sucursal no se solapan;
-- la expiración la gestiona la limpieza por TTL (FASE-08).
ALTER TABLE "retencion_franja" ADD CONSTRAINT "retencion_no_solape" EXCLUDE USING gist ("especialista_id" WITH =, "sucursal_id" WITH =, "rango" WITH &&);