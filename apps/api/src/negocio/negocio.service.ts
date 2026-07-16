import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { PerfilNegocio, PlanSuscripcion, RolUsuario } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { runInTenantTx } from '../db/tx';
import { negocio, sucursal, suscripcion, usuario } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { ConfigResolverService } from '../config-module/config-resolver.service';

export interface OnboardingInput {
  negocioNombre: string;
  perfil: PerfilNegocio;
  plan?: PlanSuscripcion;
  sucursalNombre?: string;
  adminNombre: string;
  adminEmail: string;
  adminPassword: string;
}

/**
 * Onboarding y perfil del negocio (FASE-07, RF-001/RF-002).
 */
@Injectable()
export class NegocioService {
  constructor(private readonly config: ConfigResolverService) {}

  /**
   * Alta self-service de un negocio: crea negocio + suscripción + 1ª sucursal +
   * usuario admin. Cross-tenant (no hay contexto aún) → usa la conexión admin.
   * Los defaults del perfil se resuelven en lectura (ConfigResolver), no se
   * materializan: la tabla `configuracion` solo guarda overrides.
   */
  async onboard(input: OnboardingInput): Promise<{ negocioId: string; sucursalId: string; adminEmail: string }> {
    const email = input.adminEmail.toLowerCase().trim();

    const [existente] = await adminDb.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, email)).limit(1);
    if (existente) throw new ConflictException('Ya existe un usuario con ese email.');

    const passwordHash = await argon2.hash(input.adminPassword);

    return adminDb.transaction(async (tx) => {
      const [neg] = await tx
        .insert(negocio)
        .values({ nombre: input.negocioNombre, perfil: input.perfil })
        .returning();

      await tx.insert(suscripcion).values({
        negocioId: neg.id,
        plan: input.plan ?? PlanSuscripcion.Basico,
        numEspecialistas: 0,
      });

      const [suc] = await tx
        .insert(sucursal)
        .values({ negocioId: neg.id, nombre: input.sucursalNombre ?? 'Principal' })
        .returning();

      await tx.insert(usuario).values({
        negocioId: neg.id,
        nombre: input.adminNombre,
        email,
        passwordHash,
        rol: RolUsuario.Admin,
      });

      return { negocioId: neg.id, sucursalId: suc.id, adminEmail: email };
    });
  }

  /**
   * Cambia el perfil del negocio SIN borrar datos operativos. Al cambiar el
   * vertical, los defaults resueltos cambian para las claves no sobrescritas;
   * se invalida la caché de configuración.
   */
  async cambiarPerfil(ctx: TenantContext, perfil: PerfilNegocio): Promise<void> {
    await runInTenantTx(ctx, (tx) =>
      tx
        .update(negocio)
        .set({ perfil, actualizadoEn: new Date() })
        .where(eq(negocio.id, ctx.negocioId)),
    );
    this.config.invalidar(ctx.negocioId);
  }
}
