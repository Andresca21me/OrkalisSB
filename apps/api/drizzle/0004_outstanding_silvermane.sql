CREATE TABLE "refresh_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jti" uuid NOT NULL,
	"familia" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"negocio_id" uuid NOT NULL,
	"revocado" boolean DEFAULT false NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_token_jti_unique" UNIQUE("jti")
);
--> statement-breakpoint
ALTER TABLE "usuario" DROP CONSTRAINT "usuario_email_negocio_uq";--> statement-breakpoint
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_email_uq" UNIQUE("email");--> statement-breakpoint
-- FASE-05 · RLS + grants para refresh_token (coherente con FASE-04).
-- La auth la gestiona la conexión admin (antes de tener contexto de tenant),
-- pero la tabla lleva RLS forzada por defensa en profundidad.
GRANT SELECT, INSERT, UPDATE, DELETE ON "refresh_token" TO orkalis_app;--> statement-breakpoint
ALTER TABLE "refresh_token" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "refresh_token" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "refresh_token_tenant_isolation" ON "refresh_token"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);