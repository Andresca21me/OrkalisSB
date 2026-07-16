ALTER TYPE "public"."estado_suscripcion" ADD VALUE 'prueba' BEFORE 'activa';--> statement-breakpoint
ALTER TYPE "public"."estado_suscripcion" ADD VALUE 'en_gracia' BEFORE 'suspendida';--> statement-breakpoint
ALTER TYPE "public"."estado_suscripcion" ADD VALUE 'cortesia';--> statement-breakpoint
ALTER TYPE "public"."estado_suscripcion" ADD VALUE 'cancelada';--> statement-breakpoint
ALTER TABLE "cobro" RENAME COLUMN "wompi_transaction_id" TO "mp_payment_id";--> statement-breakpoint
ALTER TABLE "suscripcion" ADD COLUMN "trial_fin" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "suscripcion" ADD COLUMN "dia_cobro" integer;--> statement-breakpoint
ALTER TABLE "suscripcion" ADD COLUMN "proximo_cobro" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "suscripcion" ADD COLUMN "ultimo_cobro_ok" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "suscripcion" ADD COLUMN "mp_customer_id" text;--> statement-breakpoint
ALTER TABLE "suscripcion" ADD COLUMN "mp_card_id" text;--> statement-breakpoint
ALTER TABLE "suscripcion" ADD COLUMN "mp_payer_email" text;--> statement-breakpoint
ALTER TABLE "suscripcion" ADD COLUMN "metodo_ultimos4" text;--> statement-breakpoint
ALTER TABLE "suscripcion" ADD COLUMN "intentos_fallidos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "suscripcion" ADD COLUMN "gracia_inicio" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cobro" ADD COLUMN "intento" integer DEFAULT 1 NOT NULL;