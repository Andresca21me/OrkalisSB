CREATE TABLE "token_accion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"usuario_id" uuid,
	"negocio_id" uuid,
	"payload" jsonb,
	"expira_en" timestamp with time zone NOT NULL,
	"usado_en" timestamp with time zone,
	"consumido_en" timestamp with time zone,
	"reenvios" integer DEFAULT 0 NOT NULL,
	"ultimo_envio" timestamp with time zone DEFAULT now() NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "token_accion_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "mensaje" ALTER COLUMN "negocio_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "email_verificado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mensaje" ADD COLUMN "cuerpo_html" text;--> statement-breakpoint
ALTER TABLE "token_accion" ADD CONSTRAINT "token_accion_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_accion" ADD CONSTRAINT "token_accion_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "token_accion_tipo_email_idx" ON "token_accion" USING btree ("tipo","email");--> statement-breakpoint
-- Solo el rol dueño (adminDb) la toca: los flujos de correo ocurren sin sesión
-- (y el del alta, antes de que exista el negocio), así que en vez de una
-- política de tenant se niega el acceso al rol de aplicación, como en
-- `mensajeria_saldo`. Sin FORCE, el dueño sigue pasando por encima.
ALTER TABLE "token_accion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "token_accion_solo_plataforma" ON "token_accion" USING (false) WITH CHECK (false);