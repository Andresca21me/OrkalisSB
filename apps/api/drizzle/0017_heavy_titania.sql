CREATE TABLE "mensajeria_saldo" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"presupuesto" integer DEFAULT 0 NOT NULL,
	"consumidos" integer DEFAULT 0 NOT NULL,
	"motivo" text,
	"pausada_en" timestamp with time zone,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verificacion_especialista" ADD COLUMN "codigo_local_hash" text;--> statement-breakpoint
-- Fila única: el interruptor es de plataforma, no puede haber dos verdades.
ALTER TABLE "mensajeria_saldo" ADD CONSTRAINT "mensajeria_saldo_fila_unica" CHECK ("id" = 1);--> statement-breakpoint
INSERT INTO "mensajeria_saldo" ("id") VALUES (1) ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Solo el rol dueño (adminDb) la toca: no lleva `negocio_id`, así que en vez de
-- una política de tenant se niega el acceso al rol de aplicación. Sin FORCE, el
-- dueño sigue pasando por encima, que es justo lo que hace falta.
ALTER TABLE "mensajeria_saldo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "mensajeria_saldo_solo_plataforma" ON "mensajeria_saldo" USING (false) WITH CHECK (false);
