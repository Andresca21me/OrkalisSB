CREATE TYPE "public"."estado_verificacion" AS ENUM('pendiente', 'verificado', 'expirado', 'cancelado');--> statement-breakpoint
CREATE TABLE "verificacion_especialista" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"negocio_id" uuid NOT NULL,
	"telefono" text NOT NULL,
	"datos_borrador" jsonb NOT NULL,
	"estado" "estado_verificacion" DEFAULT 'pendiente' NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"reenvios" integer DEFAULT 0 NOT NULL,
	"ultimo_envio_en" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "especialista" ADD COLUMN "apellidos" text;--> statement-breakpoint
ALTER TABLE "especialista" ADD COLUMN "telefono" text;--> statement-breakpoint
ALTER TABLE "especialista" ADD COLUMN "telefono_verificado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verificacion_especialista" ADD CONSTRAINT "verificacion_especialista_negocio_id_negocio_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."negocio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Las columnas nuevas de `especialista` son NULLABLE a propósito: los
-- especialistas creados antes de FASE-06 no tienen celular y deben seguir
-- funcionando; se les pedirá verificación al editarlos (mejora futura).

-- RLS (ADR-001): la verificación guarda el borrador del alta (datos del equipo).
ALTER TABLE "verificacion_especialista" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verificacion_especialista" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "verificacion_especialista_tenant_isolation" ON "verificacion_especialista"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

-- El worker de limpieza busca las pendientes vencidas.
CREATE INDEX "verificacion_especialista_pendiente_idx"
  ON "verificacion_especialista" USING btree ("expira_en") WHERE "estado" = 'pendiente';
