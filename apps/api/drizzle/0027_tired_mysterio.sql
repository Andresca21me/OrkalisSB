ALTER TABLE "usuario" ADD COLUMN "intentos_fallidos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "bloqueado_hasta" timestamp with time zone;