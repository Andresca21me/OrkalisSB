import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { RolUsuario, type UsuarioInterno } from '@orkalis/shared';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import { usuario, usuarioSucursal } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

/**
 * Usuarios internos por rol (FASE-09, H6). Cuentas con login (admin/recepción/
 * especialista). El email es único global; el alcance se modela en
 * `usuario_sucursal`. La baja es lógica.
 */
@Injectable()
export class UsuariosService {
  /** Lista los usuarios del negocio con sus sucursales asignadas. */
  listar(ctx: TenantContext): Promise<UsuarioInterno[]> {
    return runInTenantTx(ctx, async (tx) => {
      const us = await tx.select().from(usuario);
      const rels = await tx
        .select({ usuarioId: usuarioSucursal.usuarioId, sucursalId: usuarioSucursal.sucursalId })
        .from(usuarioSucursal);
      const porUsuario = new Map<string, string[]>();
      for (const r of rels) {
        const arr = porUsuario.get(r.usuarioId) ?? [];
        arr.push(r.sucursalId);
        porUsuario.set(r.usuarioId, arr);
      }
      return us.map((u) => ({
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        rol: u.rol as RolUsuario,
        activo: u.activo,
        sucursalIds: porUsuario.get(u.id) ?? [],
      }));
    });
  }

  async crear(
    ctx: TenantContext,
    dto: { nombre: string; email: string; password: string; rol: RolUsuario; sucursalIds?: string[] },
  ): Promise<UsuarioInterno> {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(dto.password);
    const sucursales = dto.rol === RolUsuario.Admin ? [] : (dto.sucursalIds ?? []);

    return runInTenantTx(ctx, async (tx) => {
      const [existe] = await tx.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, email)).limit(1);
      if (existe) throw new ConflictException('Ya existe un usuario con ese correo.');

      const [u] = await tx
        .insert(usuario)
        .values({ negocioId: ctx.negocioId, nombre: dto.nombre.trim(), email, passwordHash, rol: dto.rol })
        .returning();
      if (sucursales.length) await this.fijarSucursales(tx, u.id, sucursales);
      return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol as RolUsuario, activo: u.activo, sucursalIds: sucursales };
    });
  }

  async editar(
    ctx: TenantContext,
    id: string,
    cambios: { nombre?: string; rol?: RolUsuario; activo?: boolean; sucursalIds?: string[] },
  ): Promise<UsuarioInterno> {
    return runInTenantTx(ctx, async (tx) => {
      const set: Record<string, unknown> = { actualizadoEn: new Date() };
      if (cambios.nombre !== undefined) set.nombre = cambios.nombre.trim();
      if (cambios.rol !== undefined) set.rol = cambios.rol;
      if (cambios.activo !== undefined) set.activo = cambios.activo;
      const [u] = await tx.update(usuario).set(set).where(eq(usuario.id, id)).returning();
      if (!u) throw new NotFoundException('Usuario no encontrado.');

      // El admin accede a todas las sucursales: se limpia su alcance explícito.
      if (u.rol === RolUsuario.Admin) {
        await tx.delete(usuarioSucursal).where(eq(usuarioSucursal.usuarioId, id));
      } else if (cambios.sucursalIds !== undefined) {
        await this.fijarSucursales(tx, id, cambios.sucursalIds, true);
      }

      const rels = await tx
        .select({ sucursalId: usuarioSucursal.sucursalId })
        .from(usuarioSucursal)
        .where(eq(usuarioSucursal.usuarioId, id));
      return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol as RolUsuario, activo: u.activo, sucursalIds: rels.map((r) => r.sucursalId) };
    });
  }

  /** Baja lógica (conserva el usuario y su historial). */
  async desactivar(ctx: TenantContext, id: string): Promise<void> {
    const [u] = await runInTenantTx(ctx, (tx) =>
      tx.update(usuario).set({ activo: false, actualizadoEn: new Date() }).where(eq(usuario.id, id)).returning(),
    );
    if (!u) throw new NotFoundException('Usuario no encontrado.');
  }

  private async fijarSucursales(tx: DrizzleTx, usuarioId: string, sucursalIds: string[], reemplazar = false): Promise<void> {
    if (reemplazar) await tx.delete(usuarioSucursal).where(eq(usuarioSucursal.usuarioId, usuarioId));
    if (!sucursalIds.length) {
      if (!reemplazar) throw new BadRequestException('Asigna al menos una sucursal.');
      return;
    }
    await tx.insert(usuarioSucursal).values(sucursalIds.map((sid) => ({ usuarioId, sucursalId: sid })));
  }
}
