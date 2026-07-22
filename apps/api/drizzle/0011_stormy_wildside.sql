CREATE TYPE "public"."evento_plantilla" AS ENUM('confirmacion', 'recordatorio', 'aviso', 'aviso_especialista', 'marketing');--> statement-breakpoint
CREATE TABLE "plantilla_mensaje" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"evento" "evento_plantilla" NOT NULL,
	"canal" "canal_envio" NOT NULL,
	"contenido_sms" text,
	"whatsapp_content_sid" text,
	"whatsapp_variables" jsonb,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plantilla_mensaje_uq" UNIQUE("negocio_id","evento","canal")
);
--> statement-breakpoint
ALTER TABLE "plantilla_mensaje" ADD CONSTRAINT "plantilla_mensaje_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- RLS (ADR-001): las plantillas son dato de tenant. El dispatcher las lee dentro
-- de la transacción del negocio, así que la política estándar basta.
ALTER TABLE "plantilla_mensaje" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plantilla_mensaje" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "plantilla_mensaje_tenant_isolation" ON "plantilla_mensaje"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
