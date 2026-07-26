import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { SplitType } from '@orkalis/shared';
import { runInTenantTx } from '../db/tx';
import { servicio } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

type Servicio = typeof servicio.$inferSelect;

export interface ServicioInput {
  nombre: string;
  precio: number;
  duracionMin: number;
  categoria?: string;
  splitType?: SplitType;
  splitValor?: number;
  favorito?: boolean;
}

/** Catálogo de servicios (FASE-10, RF-035/RF-036). Alimenta el motor financiero. */
@Injectable()
export class ServiciosService {
  listar(ctx: TenantContext): Promise<Servicio[]> {
    return runInTenantTx(ctx, (tx) => tx.select().from(servicio).where(eq(servicio.activo, true)));
  }

  crear(ctx: TenantContext, input: ServicioInput): Promise<Servicio> {
    return runInTenantTx(ctx, async (tx) => {
      const [s] = await tx
        .insert(servicio)
        .values({
          negocioId: ctx.negocioId,
          nombre: input.nombre,
          precio: input.precio.toFixed(2),
          duracionMin: input.duracionMin,
          categoria: input.categoria,
          splitType: input.splitType ?? SplitType.Porcentaje,
          splitValor: (input.splitValor ?? 0).toFixed(2),
          favorito: input.favorito ?? false,
        })
        .returning();
      return s;
    });
  }

  async editar(ctx: TenantContext, id: string, input: Partial<ServicioInput>): Promise<Servicio> {
    const set: Record<string, unknown> = { actualizadoEn: new Date() };
    if (input.nombre !== undefined) set.nombre = input.nombre;
    if (input.precio !== undefined) set.precio = input.precio.toFixed(2);
    if (input.duracionMin !== undefined) set.duracionMin = input.duracionMin;
    if (input.categoria !== undefined) set.categoria = input.categoria;
    if (input.splitType !== undefined) set.splitType = input.splitType;
    if (input.splitValor !== undefined) set.splitValor = input.splitValor.toFixed(2);
    if (input.favorito !== undefined) set.favorito = input.favorito;

    const [s] = await runInTenantTx(ctx, (tx) =>
      tx.update(servicio).set(set).where(eq(servicio.id, id)).returning(),
    );
    if (!s) throw new NotFoundException('Servicio no encontrado.');
    return s;
  }

  async desactivar(ctx: TenantContext, id: string): Promise<void> {
    const [s] = await runInTenantTx(ctx, (tx) =>
      tx.update(servicio).set({ activo: false, actualizadoEn: new Date() }).where(eq(servicio.id, id)).returning(),
    );
    if (!s) throw new NotFoundException('Servicio no encontrado.');
  }
}
