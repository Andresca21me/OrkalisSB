ALTER TABLE "gasto" ADD COLUMN "fecha" date;--> statement-breakpoint
ALTER TABLE "gasto" ADD COLUMN "dia_cobro" integer;--> statement-breakpoint
ALTER TABLE "gasto" ADD COLUMN "desactivado_en" timestamp with time zone;--> statement-breakpoint
-- Backfill (Plan-Gastos): las variables existentes toman como fecha su día de
-- creación (Bogotá) y los fijos existentes se cobran el día del mes en que se
-- registraron — reproduce el comportamiento anterior sin perder históricos.
UPDATE "gasto" SET "fecha" = ((("creado_en" AT TIME ZONE 'America/Bogota'))::date) WHERE "tipo" = 'variable' AND "fecha" IS NULL;--> statement-breakpoint
UPDATE "gasto" SET "dia_cobro" = EXTRACT(DAY FROM ("creado_en" AT TIME ZONE 'America/Bogota'))::int WHERE "tipo" = 'fijo' AND "dia_cobro" IS NULL;
