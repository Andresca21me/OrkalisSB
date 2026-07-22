CREATE TABLE "especialista_foto" (
	"especialista_id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"datos" "bytea" NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "especialista_foto" ADD CONSTRAINT "especialista_foto_especialista_id_especialista_id_fk" FOREIGN KEY ("especialista_id") REFERENCES "public"."especialista"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- RLS (ADR-001): la foto no tiene negocio_id propio, se aísla a través de su
-- especialista (mismo patrón que `atencion_pago` y `cita_recordatorio`).
-- El endpoint público la lee con el rol dueño, que bypassea RLS: son fotos que
-- ya se muestran en el enlace público de reservas.
ALTER TABLE "especialista_foto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "especialista_foto" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "especialista_foto_tenant_isolation" ON "especialista_foto"
  USING (EXISTS (SELECT 1 FROM "especialista" e WHERE e."id" = "especialista_foto"."especialista_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "especialista" e WHERE e."id" = "especialista_foto"."especialista_id"));
