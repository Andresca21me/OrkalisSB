CREATE TYPE "public"."canal_envio" AS ENUM('sms', 'whatsapp', 'email');--> statement-breakpoint
CREATE TYPE "public"."estado_mensaje" AS ENUM('pendiente', 'enviando', 'enviado', 'entregado', 'fallido', 'sin_cupo');--> statement-breakpoint
CREATE TABLE "alerta_admin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"clave" text NOT NULL,
	"severidad" text DEFAULT 'aviso' NOT NULL,
	"titulo" text NOT NULL,
	"detalle" text,
	"leida_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alerta_admin_clave_uq" UNIQUE("negocio_id","clave")
);
--> statement-breakpoint
CREATE TABLE "mensaje" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"canal" "canal_envio" NOT NULL,
	"cupo_canal" "canal_mensajeria" NOT NULL,
	"tipo" text NOT NULL,
	"transaccional" boolean DEFAULT true NOT NULL,
	"destino" text NOT NULL,
	"plantilla_clave" text,
	"cuerpo" text,
	"variables" jsonb,
	"asunto" text,
	"estado" "estado_mensaje" DEFAULT 'pendiente' NOT NULL,
	"sobre_cupo" boolean DEFAULT false NOT NULL,
	"proveedor" text,
	"proveedor_id" text,
	"error" text,
	"intento" integer DEFAULT 0 NOT NULL,
	"proximo_intento_en" timestamp with time zone DEFAULT now() NOT NULL,
	"cita_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"enviado_en" timestamp with time zone,
	"entregado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "consumo_mensajeria" DROP CONSTRAINT "consumo_mensajeria_uq";--> statement-breakpoint
-- Se añaden NULLABLE para poder rellenar las filas existentes antes de exigirlas.
ALTER TABLE "consumo_mensajeria" ADD COLUMN "ciclo_inicio" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consumo_mensajeria" ADD COLUMN "ciclo_fin" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alerta_admin" ADD CONSTRAINT "alerta_admin_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensaje" ADD CONSTRAINT "mensaje_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensaje" ADD CONSTRAINT "mensaje_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensaje" ADD CONSTRAINT "mensaje_cita_id_cita_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."cita"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerta_admin_negocio_creado_idx" ON "alerta_admin" USING btree ("negocio_id","creado_en");--> statement-breakpoint
CREATE INDEX "mensaje_negocio_creado_idx" ON "mensaje" USING btree ("negocio_id","creado_en");--> statement-breakpoint
CREATE INDEX "mensaje_estado_idx" ON "mensaje" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "mensaje_proveedor_id_idx" ON "mensaje" USING btree ("proveedor_id");--> statement-breakpoint
-- Backfill del histórico: el mes calendario 'YYYY-MM' pasa a la ventana
-- [día 1 12:00 UTC, +1 mes). Nota deliberada: como los ciclos nuevos van
-- anclados al aniversario de cobro (no al día 1), estas filas quedan como
-- HISTÓRICO y el ciclo vigente arranca en 0 — es el comportamiento aceptado en
-- el plan (FASE-03, "Riesgos").
UPDATE "consumo_mensajeria"
SET "ciclo_inicio" = (("periodo" || '-01 12:00:00')::timestamp AT TIME ZONE 'UTC'),
    "ciclo_fin"    = (("periodo" || '-01 12:00:00')::timestamp AT TIME ZONE 'UTC') + interval '1 month'
WHERE "ciclo_inicio" IS NULL;--> statement-breakpoint
ALTER TABLE "consumo_mensajeria" ALTER COLUMN "ciclo_inicio" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "consumo_mensajeria" ALTER COLUMN "ciclo_fin" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "consumo_mensajeria" DROP COLUMN "periodo";--> statement-breakpoint
ALTER TABLE "consumo_mensajeria" ADD CONSTRAINT "consumo_mensajeria_uq" UNIQUE("negocio_id","canal","ciclo_inicio");--> statement-breakpoint
-- Índice del reclamo del OutboxWorker: solo las filas listas para enviar.
CREATE INDEX "mensaje_pendiente_idx" ON "mensaje" USING btree ("proximo_intento_en") WHERE "estado" = 'pendiente';--> statement-breakpoint

-- RLS (ADR-001): outbox y alertas son dato de tenant. La API (rol orkalis_app)
-- solo ve/inserta filas de su negocio; el OutboxWorker corre con el rol dueño
-- (adminDb), que bypassea RLS por ser tarea de plataforma cross-tenant.
ALTER TABLE "mensaje" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mensaje" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "mensaje_tenant_isolation" ON "mensaje"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "alerta_admin" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "alerta_admin" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "alerta_admin_tenant_isolation" ON "alerta_admin"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
