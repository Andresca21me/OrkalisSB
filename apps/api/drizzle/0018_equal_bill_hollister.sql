ALTER TABLE "atencion" ADD COLUMN "comision_productos" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "atencion_producto" ADD COLUMN "costo_unitario" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "atencion_producto" ADD COLUMN "comision" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD COLUMN "costo_total" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "movimiento_inventario" ADD COLUMN "stock_resultante" integer;--> statement-breakpoint
ALTER TABLE "venta_producto" ADD COLUMN "costo_unitario" numeric(12, 2) DEFAULT '0' NOT NULL;