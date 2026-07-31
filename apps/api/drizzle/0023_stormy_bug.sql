CREATE TABLE "atencion_servicio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"atencion_id" uuid NOT NULL,
	"servicio_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"precio" numeric(12, 2) NOT NULL,
	"regla_tipo" text NOT NULL,
	"regla_valor" numeric(12, 2) NOT NULL,
	"regla_origen" text NOT NULL,
	"gan_prof" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "liquidacion" ADD COLUMN "desde" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "liquidacion" ADD COLUMN "hasta" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "liquidacion" ADD COLUMN "comision_servicios" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "liquidacion" ADD COLUMN "comision_productos" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "atencion_servicio" ADD CONSTRAINT "atencion_servicio_atencion_id_atencion_id_fk" FOREIGN KEY ("atencion_id") REFERENCES "public"."atencion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atencion_servicio" ADD CONSTRAINT "atencion_servicio_servicio_id_servicio_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicio"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- RLS heredada de la atención padre, mismo patrón que atencion_producto/atencion_pago:
-- la política de `atencion` ya acota por tenant, así que basta con exigir que la
-- fila padre sea visible.
ALTER TABLE "atencion_servicio" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "atencion_servicio" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "atencion_servicio_tenant_isolation" ON "atencion_servicio"
  USING (EXISTS (SELECT 1 FROM "atencion" a WHERE a."id" = "atencion_servicio"."atencion_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "atencion" a WHERE a."id" = "atencion_servicio"."atencion_id"));--> statement-breakpoint
CREATE INDEX "atencion_servicio_atencion_idx" ON "atencion_servicio" ("atencion_id");