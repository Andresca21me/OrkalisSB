CREATE TABLE "servicio_dia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"servicio_id" uuid NOT NULL,
	"dia_semana" integer NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servicio_dia_unq" UNIQUE("servicio_id","dia_semana")
);
--> statement-breakpoint
CREATE TABLE "sucursal_dia_laborable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"dia_semana" integer NOT NULL,
	"laborable" boolean DEFAULT true NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sucursal_dia_laborable_unq" UNIQUE("sucursal_id","dia_semana")
);
--> statement-breakpoint
ALTER TABLE "servicio_dia" ADD CONSTRAINT "servicio_dia_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicio_dia" ADD CONSTRAINT "servicio_dia_servicio_id_servicio_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sucursal_dia_laborable" ADD CONSTRAINT "sucursal_dia_laborable_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sucursal_dia_laborable" ADD CONSTRAINT "sucursal_dia_laborable_sucursal_id_sucursal_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- ============================================================================
-- FASE-04 · RLS multi-tenant para las tablas nuevas (mismo patrón que 0002).
-- Las tablas creadas por el rol dueño heredan los GRANT vía ALTER DEFAULT
-- PRIVILEGES (0002); los reiteramos explícitos por seguridad.
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON "sucursal_dia_laborable" TO orkalis_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "servicio_dia" TO orkalis_app;--> statement-breakpoint
ALTER TABLE "sucursal_dia_laborable" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sucursal_dia_laborable" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sucursal_dia_laborable_tenant_isolation" ON "sucursal_dia_laborable"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "servicio_dia" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "servicio_dia" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "servicio_dia_tenant_isolation" ON "servicio_dia"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);