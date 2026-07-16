CREATE TYPE "public"."estado_cobro" AS ENUM('pendiente', 'pagado', 'fallido');--> statement-breakpoint
CREATE TABLE "cobro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"periodo" text NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"estado" "estado_cobro" DEFAULT 'pendiente' NOT NULL,
	"referencia" text NOT NULL,
	"wompi_transaction_id" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"pagado_en" timestamp with time zone,
	CONSTRAINT "cobro_referencia_unique" UNIQUE("referencia")
);
--> statement-breakpoint
ALTER TABLE "cobro" ADD CONSTRAINT "cobro_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- FASE-12 · RLS + grants para cobro (coherente con FASE-04).
GRANT SELECT, INSERT, UPDATE, DELETE ON "cobro" TO orkalis_app;--> statement-breakpoint
ALTER TABLE "cobro" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cobro" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "cobro_tenant_isolation" ON "cobro"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
