CREATE TYPE "public"."canal_mensajeria" AS ENUM('whatsapp_utility', 'whatsapp_marketing', 'sms', 'email');--> statement-breakpoint
CREATE TABLE "consumo_mensajeria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"canal" "canal_mensajeria" NOT NULL,
	"periodo" text NOT NULL,
	"cantidad" integer DEFAULT 0 NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consumo_mensajeria_uq" UNIQUE("negocio_id","canal","periodo")
);
--> statement-breakpoint
ALTER TABLE "cita" ADD COLUMN "recordatorio_enviado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "consumo_mensajeria" ADD CONSTRAINT "consumo_mensajeria_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- FASE-11 · RLS + grants para consumo_mensajeria (coherente con FASE-04).
GRANT SELECT, INSERT, UPDATE, DELETE ON "consumo_mensajeria" TO orkalis_app;--> statement-breakpoint
ALTER TABLE "consumo_mensajeria" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consumo_mensajeria" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "consumo_mensajeria_tenant_isolation" ON "consumo_mensajeria"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
