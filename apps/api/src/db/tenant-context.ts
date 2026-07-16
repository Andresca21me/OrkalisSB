/**
 * TenantContext — el contexto de aislamiento que viaja por petición (ADR-001).
 *
 * Lo poblará Auth en FASE-05 a partir de los claims del JWT. La GUC
 * `app.current_tenant` se fija a partir de `negocioId` en cada transacción
 * (ver `tx.ts`) para que RLS (FASE-04) actúe.
 */
export interface TenantContext {
  /** Tenant principal: unidad de aislamiento (`negocio_id`). */
  negocioId: string;
  /**
   * Alcance: sucursales a las que el usuario tiene acceso.
   * `null` = todas (admin consolidado).
   */
  sucursalIds: string[] | null;
  /** Sucursal activa seleccionada para la operación actual (opcional). */
  sucursalActivaId?: string | null;
  /** Rol del usuario (`RolUsuario` de @orkalis/shared). */
  rol: string;
  /** Id del usuario autenticado (opcional). */
  usuarioId?: string;
}
