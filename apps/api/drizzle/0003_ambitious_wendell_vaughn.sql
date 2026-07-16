CREATE TYPE "public"."plan_suscripcion" AS ENUM('basico', 'pro', 'premium', 'empresarial');--> statement-breakpoint
ALTER TABLE "suscripcion" ALTER COLUMN "plan" SET DATA TYPE plan_suscripcion USING "plan"::"plan_suscripcion";--> statement-breakpoint
ALTER TABLE "suscripcion" ALTER COLUMN "plan" SET DEFAULT 'basico';--> statement-breakpoint
ALTER TABLE "suscripcion" ADD COLUMN "num_especialistas" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "suscripcion" DROP COLUMN "num_sucursales";