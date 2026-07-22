CREATE TABLE "negocio_logo" (
	"negocio_id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"datos" "bytea" NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "negocio" ADD COLUMN "descripcion" text;--> statement-breakpoint
ALTER TABLE "negocio" ADD COLUMN "color_primario" text;--> statement-breakpoint
ALTER TABLE "negocio_logo" ADD CONSTRAINT "negocio_logo_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- RLS (ADR-001): el logo se aísla por su negocio. El endpoint público lo lee con
-- el rol dueño, igual que la foto del especialista: es una imagen que ya se
-- muestra en el enlace público de reservas.
ALTER TABLE "negocio_logo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio_logo" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "negocio_logo_tenant_isolation" ON "negocio_logo"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
