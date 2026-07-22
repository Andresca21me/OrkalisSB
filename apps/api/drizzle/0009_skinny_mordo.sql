CREATE TABLE "atencion_pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"atencion_id" uuid NOT NULL,
	"metodo" "metodo_pago" NOT NULL,
	"monto" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atencion_pago" ADD CONSTRAINT "atencion_pago_atencion_id_atencion_id_fk" FOREIGN KEY ("atencion_id") REFERENCES "public"."atencion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atencion_pago" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "atencion_pago" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "atencion_pago_tenant_isolation" ON "atencion_pago"
  USING (EXISTS (SELECT 1 FROM "atencion" a WHERE a."id" = "atencion_pago"."atencion_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "atencion" a WHERE a."id" = "atencion_pago"."atencion_id"));--> statement-breakpoint
-- Backfill: cada atención existente pasa a tener una línea de pago = total con su método (mensajería histórica correcta en "por método").
INSERT INTO "atencion_pago" ("atencion_id", "metodo", "monto")
SELECT "id", "metodo_pago", "total" FROM "atencion"
WHERE NOT EXISTS (SELECT 1 FROM "atencion_pago" p WHERE p."atencion_id" = "atencion"."id");