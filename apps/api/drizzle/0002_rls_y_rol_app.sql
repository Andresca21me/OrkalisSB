-- Custom SQL migration file, put your code below! --

-- ============================================================================
-- FASE-04 · Aislamiento multi-tenant (NO NEGOCIABLE) — ADR-001
-- Capa 2 de defensa: Row-Level Security, independiente del código de la app.
-- ============================================================================

-- 1) Rol de aplicación SIN superusuario ni BYPASSRLS. La API se conecta con él
--    (DATABASE_URL → orkalis_app), de modo que RLS SIEMPRE aplique. Las
--    migraciones y el seed usan el rol dueño (superusuario), que sí la bypassa.
--    Password de DESARROLLO; en producción (FASE-14) se provisiona aparte.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'orkalis_app') THEN
    CREATE ROLE orkalis_app LOGIN PASSWORD 'orkalis_app';
  END IF;
END$$;--> statement-breakpoint

-- Privilegios de datos (NO DDL). CONNECT viene por defecto vía PUBLIC.
GRANT USAGE ON SCHEMA public TO orkalis_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO orkalis_app;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO orkalis_app;--> statement-breakpoint
-- Tablas/secuencias futuras creadas por el rol dueño actual (migraciones).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO orkalis_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO orkalis_app;--> statement-breakpoint

-- 2) Caso especial: `negocio` se aísla por su PROPIA `id` (es el tenant raíz).
ALTER TABLE "negocio" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "negocio_tenant_isolation" ON "negocio"
  USING ("id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

-- 3) Tablas con `negocio_id`: política estándar de aislamiento por tenant.
--    USING filtra lecturas; WITH CHECK impide escribir filas de otro negocio.
--    Si la GUC no está fijada, current_setting devuelve NULL → no ve nada.
ALTER TABLE "suscripcion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suscripcion" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "suscripcion_tenant_isolation" ON "suscripcion"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "sucursal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sucursal" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sucursal_tenant_isolation" ON "sucursal"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "usuario" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usuario" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "usuario_tenant_isolation" ON "usuario"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "especialista" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "especialista" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "especialista_tenant_isolation" ON "especialista"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "cliente" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cliente" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "cliente_tenant_isolation" ON "cliente"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "servicio" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "servicio" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "servicio_tenant_isolation" ON "servicio"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "cita" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cita" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "cita_tenant_isolation" ON "cita"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "atencion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "atencion" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "atencion_tenant_isolation" ON "atencion"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "producto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "producto" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "producto_tenant_isolation" ON "producto"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "movimiento_inventario" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "movimiento_inventario" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "movimiento_inventario_tenant_isolation" ON "movimiento_inventario"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "venta_producto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "venta_producto" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "venta_producto_tenant_isolation" ON "venta_producto"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "gasto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gasto" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "gasto_tenant_isolation" ON "gasto"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "liquidacion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "liquidacion" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "liquidacion_tenant_isolation" ON "liquidacion"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "cierre_periodo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cierre_periodo" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "cierre_periodo_tenant_isolation" ON "cierre_periodo"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "configuracion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "configuracion" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "configuracion_tenant_isolation" ON "configuracion"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "disponibilidad" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "disponibilidad" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "disponibilidad_tenant_isolation" ON "disponibilidad"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "retencion_franja" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "retencion_franja" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "retencion_franja_tenant_isolation" ON "retencion_franja"
  USING ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

-- 4) `otp_codigo`: `negocio_id` es NULLABLE (flujo público antes de resolver el
--    negocio). Se permite la fila sin tenant (NULL); cuando ya tiene negocio_id
--    debe coincidir con el tenant activo. El refinamiento del flujo es FASE-08.
ALTER TABLE "otp_codigo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "otp_codigo" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "otp_codigo_tenant_isolation" ON "otp_codigo"
  USING ("negocio_id" IS NULL OR "negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK ("negocio_id" IS NULL OR "negocio_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint

-- 5) Tablas hijas SIN `negocio_id` propio: se protegen TRANSITIVAMENTE. El
--    EXISTS consulta la tabla padre, que YA tiene RLS forzada, así que solo
--    resuelve true si el padre pertenece al tenant activo. Defensa en profundidad.
ALTER TABLE "usuario_sucursal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usuario_sucursal" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "usuario_sucursal_tenant_isolation" ON "usuario_sucursal"
  USING (EXISTS (SELECT 1 FROM "usuario" u WHERE u."id" = "usuario_sucursal"."usuario_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "usuario" u WHERE u."id" = "usuario_sucursal"."usuario_id"));--> statement-breakpoint

ALTER TABLE "especialista_sucursal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "especialista_sucursal" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "especialista_sucursal_tenant_isolation" ON "especialista_sucursal"
  USING (EXISTS (SELECT 1 FROM "especialista" e WHERE e."id" = "especialista_sucursal"."especialista_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "especialista" e WHERE e."id" = "especialista_sucursal"."especialista_id"));--> statement-breakpoint

ALTER TABLE "cita_servicio" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cita_servicio" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "cita_servicio_tenant_isolation" ON "cita_servicio"
  USING (EXISTS (SELECT 1 FROM "cita" c WHERE c."id" = "cita_servicio"."cita_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "cita" c WHERE c."id" = "cita_servicio"."cita_id"));--> statement-breakpoint

ALTER TABLE "atencion_producto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "atencion_producto" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "atencion_producto_tenant_isolation" ON "atencion_producto"
  USING (EXISTS (SELECT 1 FROM "atencion" a WHERE a."id" = "atencion_producto"."atencion_id"))
  WITH CHECK (EXISTS (SELECT 1 FROM "atencion" a WHERE a."id" = "atencion_producto"."atencion_id"));
