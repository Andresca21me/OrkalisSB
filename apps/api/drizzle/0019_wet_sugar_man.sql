CREATE TABLE "especialista_servicio" (
	"especialista_id" uuid NOT NULL,
	"servicio_id" uuid NOT NULL,
	CONSTRAINT "especialista_servicio_especialista_id_servicio_id_pk" PRIMARY KEY("especialista_id","servicio_id")
);
--> statement-breakpoint
ALTER TABLE "especialista_servicio" ADD CONSTRAINT "especialista_servicio_especialista_id_especialista_id_fk" FOREIGN KEY ("especialista_id") REFERENCES "public"."especialista"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "especialista_servicio" ADD CONSTRAINT "especialista_servicio_servicio_id_servicio_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- RLS de la tabla de unión, calcada de `especialista_sucursal` (0002): al no
-- tener `negocio_id` propio, el aislamiento se hereda de la tabla padre vía
-- EXISTS. FORCE para que tampoco el dueño de la tabla la salte.
ALTER TABLE "especialista_servicio" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "especialista_servicio" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "especialista_servicio_tenant_isolation" ON "especialista_servicio"
  USING (EXISTS (SELECT 1 FROM "especialista" e WHERE e."id" = "especialista_servicio"."especialista_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "especialista" e WHERE e."id" = "especialista_servicio"."especialista_id"));
