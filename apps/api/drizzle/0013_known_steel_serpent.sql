CREATE TYPE "public"."ventana_recordatorio" AS ENUM('h24', 'h2', 'config');--> statement-breakpoint
CREATE TABLE "cita_recordatorio" (
	"cita_id" uuid NOT NULL,
	"ventana" "ventana_recordatorio" NOT NULL,
	"enviado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cita_recordatorio_cita_id_ventana_pk" PRIMARY KEY("cita_id","ventana")
);
--> statement-breakpoint
ALTER TABLE "cita_recordatorio" ADD CONSTRAINT "cita_recordatorio_cita_id_cita_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."cita"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- RLS (ADR-001): `cita_recordatorio` no tiene negocio_id propio; se aísla a
-- través de su cita, igual que `atencion_pago`.
ALTER TABLE "cita_recordatorio" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cita_recordatorio" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "cita_recordatorio_tenant_isolation" ON "cita_recordatorio"
  USING (EXISTS (SELECT 1 FROM "cita" c WHERE c."id" = "cita_recordatorio"."cita_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "cita" c WHERE c."id" = "cita_recordatorio"."cita_id"));--> statement-breakpoint

-- Backfill: las citas que YA tenían el booleano marcado no deben volver a
-- recibir el recordatorio de la ventana configurable tras el despliegue.
INSERT INTO "cita_recordatorio" ("cita_id", "ventana", "enviado_en")
SELECT "id", 'config', "actualizado_en" FROM "cita" WHERE "recordatorio_enviado" = true
ON CONFLICT DO NOTHING;
