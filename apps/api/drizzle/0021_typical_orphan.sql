ALTER TABLE "sucursal" ADD COLUMN "hora_apertura" time;--> statement-breakpoint
ALTER TABLE "sucursal" ADD COLUMN "hora_cierre" time;--> statement-breakpoint
ALTER TABLE "sucursal_dia_laborable" ADD COLUMN "hora_apertura" time;--> statement-breakpoint
ALTER TABLE "sucursal_dia_laborable" ADD COLUMN "hora_cierre" time;