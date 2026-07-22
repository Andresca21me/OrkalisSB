import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { PerfilNegocio, PlanSuscripcion, RolUsuario } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { runInTenantTx } from '../db/tx';
import { negocio, negocioLogo, sucursal, suscripcion, usuario } from '../db/schema';
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

/**
 * Marca del negocio: descripción, color primario y logo (branding dinámico).
 *
 * Se lee en dos sitios muy distintos —el panel del admin y el enlace público de
 * reservas—, así que vive en su propio servicio para que ninguno de los dos
 * tenga que saber cómo está guardado.
 */
@Injectable()
export class MarcaService {
  /** Marca visible: se usa en la reserva pública y en la tarjeta al compartir. */
  async marcaDe(negocioId: string): Promise<{
    nombre: string;
    descripcion: string | null;
    colorPrimario: string | null;
    logoVersion: string | null;
  } | null> {
    const [neg] = await adminDb
      .select({ nombre: negocio.nombre, descripcion: negocio.descripcion, colorPrimario: negocio.colorPrimario })
      .from(negocio)
      .where(eq(negocio.id, negocioId))
      .limit(1);
    if (!neg) return null;
    const [logo] = await adminDb
      .select({ v: negocioLogo.actualizadoEn })
      .from(negocioLogo)
      .where(eq(negocioLogo.negocioId, negocioId))
      .limit(1);
    return { ...neg, logoVersion: logo?.v.toISOString() ?? null };
  }

  /**
   * Guarda descripción y color. El color se valida como hex de 6 dígitos: un
   * valor suelto se inyectaría tal cual en una variable CSS del navegador del
   * cliente final, así que no puede pasar sin comprobar.
   */
  async actualizar(
    ctx: TenantContext,
    datos: { descripcion?: string | null; colorPrimario?: string | null },
  ): Promise<void> {
    const cambios: Record<string, unknown> = { actualizadoEn: new Date() };
    if (datos.descripcion !== undefined) {
      cambios.descripcion = datos.descripcion?.trim() || null;
    }
    if (datos.colorPrimario !== undefined) {
      const c = datos.colorPrimario?.trim().toLowerCase() || null;
      if (c && !/^#[0-9a-f]{6}$/.test(c)) {
        throw new BadRequestException('El color debe venir en formato #RRGGBB.');
      }
      cambios.colorPrimario = c;
    }
    await runInTenantTx(ctx, (tx) => tx.update(negocio).set(cambios).where(eq(negocio.id, ctx.negocioId)));
  }

  /** Guarda el logo desde un data URL (ya reducido en el navegador). */
  async guardarLogo(ctx: TenantContext, dataUrl: string): Promise<{ logoVersion: string }> {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
    if (!m) throw new BadRequestException('El logo debe ser una imagen JPEG, PNG o WebP.');
    const datos = Buffer.from(m[2], 'base64');
    if (datos.length === 0) throw new BadRequestException('El logo llegó vacío.');
    if (datos.length > 400_000) throw new BadRequestException('El logo pesa demasiado (máximo 400 KB).');

    const actualizadoEn = new Date();
    await runInTenantTx(ctx, (tx) =>
      tx
        .insert(negocioLogo)
        .values({ negocioId: ctx.negocioId, mime: m[1], datos, actualizadoEn })
        .onConflictDoUpdate({ target: negocioLogo.negocioId, set: { mime: m[1], datos, actualizadoEn } }),
    );
    return { logoVersion: actualizadoEn.toISOString() };
  }

  async borrarLogo(ctx: TenantContext): Promise<void> {
    await runInTenantTx(ctx, (tx) => tx.delete(negocioLogo).where(eq(negocioLogo.negocioId, ctx.negocioId)));
  }

  /** Bytes del logo. Se lee con la conexión admin: el endpoint es público. */
  async leerLogo(negocioId: string): Promise<{ mime: string; datos: Buffer; actualizadoEn: Date } | null> {
    const [l] = await adminDb.select().from(negocioLogo).where(eq(negocioLogo.negocioId, negocioId)).limit(1);
    return l ? { mime: l.mime, datos: l.datos, actualizadoEn: l.actualizadoEn } : null;
  }
}
