import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq } from 'drizzle-orm';
import { NivelConfig } from '@orkalis/shared';
import { runInTenantTx, type DrizzleTx } from '../db/tx';
import { configuracion } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { getDefinicion } from './registry';
import { validacionesCruzadas, validarValor } from './validation';
import {
  CONFIG_UPDATED,
  ConfigResolverService,
  type ConfigUpdatedEvent,
} from './config-resolver.service';
import type { ValorConfig } from './config.types';

/**
 * Escritura de overrides de configuración (FASE-06, ADR-002).
 * Valida con el registry (tipo + reglas cruzadas), hace upsert/borrado vía
 * `runInTenantTx` (RLS), y emite `config.updated` para invalidar caché.
 */
@Injectable()
export class ConfigWriteService {
  constructor(
    private readonly resolver: ConfigResolverService,
    private readonly events: EventEmitter2,
  ) {}

  /** Crea o actualiza un override en un nivel. Valida antes de escribir. */
  async upsert(
    ctx: TenantContext,
    nivel: NivelConfig,
    ambitoId: string,
    clave: string,
    valor: ValorConfig,
  ): Promise<void> {
    const def = getDefinicion(clave);
    if (!def) throw new NotFoundException(`Clave de configuración desconocida: ${clave}`);

    if (nivel !== NivelConfig.Negocio && nivel !== NivelConfig.Sucursal) {
      throw new BadRequestException('Solo se pueden definir overrides de negocio o sucursal.');
    }
    if (nivel === NivelConfig.Negocio && ambitoId !== ctx.negocioId) {
      throw new BadRequestException('El ámbito de nivel negocio debe ser el propio negocio.');
    }

    const errTipo = validarValor(def, valor);
    if (errTipo) throw new BadRequestException(`${clave}: ${errTipo}`);

    // Validación cruzada sobre el conjunto efectivo resultante en este ámbito.
    const sucursalId = nivel === NivelConfig.Sucursal ? ambitoId : null;
    const efectivos = await this.resolver.getEfectivos(ctx.negocioId, sucursalId);
    const mapa = new Map<string, ValorConfig>(efectivos.map((e) => [e.clave, e.valor]));
    mapa.set(clave, valor);
    const errCruzado = validacionesCruzadas(mapa);
    if (errCruzado) throw new BadRequestException(errCruzado);

    await runInTenantTx(ctx, (tx) =>
      this.upsertFila(tx, ctx.negocioId, nivel, ambitoId, clave, valor, def.tipo),
    );

    this.emitir(ctx.negocioId);
  }

  /**
   * Fija la repartición profesional/salón de forma ATÓMICA (deben sumar 100).
   * Vía sancionada para cambiar el par: el upsert por clave suelta rechazaría
   * el estado intermedio (p. ej. 60 + 50 = 110) al validar prof + salón = 100.
   */
  async setReparticion(
    ctx: TenantContext,
    nivel: NivelConfig,
    ambitoId: string,
    profesional: number,
    salon: number,
  ): Promise<void> {
    if (nivel === NivelConfig.Negocio && ambitoId !== ctx.negocioId) {
      throw new BadRequestException('El ámbito de nivel negocio debe ser el propio negocio.');
    }
    const defProf = getDefinicion('finanzas.reparticion_profesional')!;
    const defSalon = getDefinicion('finanzas.reparticion_salon')!;
    const e1 = validarValor(defProf, profesional);
    const e2 = validarValor(defSalon, salon);
    if (e1) throw new BadRequestException(`finanzas.reparticion_profesional: ${e1}`);
    if (e2) throw new BadRequestException(`finanzas.reparticion_salon: ${e2}`);
    if (profesional + salon !== 100) {
      throw new BadRequestException('La repartición profesional + salón debe sumar 100%.');
    }

    await runInTenantTx(ctx, async (tx) => {
      await this.upsertFila(tx, ctx.negocioId, nivel, ambitoId, 'finanzas.reparticion_profesional', profesional, 'porcentaje');
      await this.upsertFila(tx, ctx.negocioId, nivel, ambitoId, 'finanzas.reparticion_salon', salon, 'porcentaje');
    });
    this.emitir(ctx.negocioId);
  }

  /** Borra un override = volver a heredar del nivel superior. */
  async remove(ctx: TenantContext, nivel: NivelConfig, ambitoId: string, clave: string): Promise<void> {
    await runInTenantTx(ctx, async (tx) => {
      await tx
        .delete(configuracion)
        .where(
          and(
            eq(configuracion.nivel, nivel),
            eq(configuracion.ambitoId, ambitoId),
            eq(configuracion.clave, clave),
          ),
        );
    });
    this.emitir(ctx.negocioId);
  }

  /**
   * Clona los overrides de NIVEL SUCURSAL del origen al destino (instantánea,
   * RF-011/ADR-002). Ambas sucursales comparten el mismo negocio, así que copiar
   * solo sus overrides propios reproduce la configuración del origen.
   */
  async clonar(ctx: TenantContext, origenSucursalId: string, destinoSucursalId: string): Promise<void> {
    if (origenSucursalId === destinoSucursalId) {
      throw new BadRequestException('Origen y destino no pueden ser la misma sucursal.');
    }
    await runInTenantTx(ctx, async (tx: DrizzleTx) => {
      const filas = await tx
        .select()
        .from(configuracion)
        .where(
          and(
            eq(configuracion.nivel, NivelConfig.Sucursal),
            eq(configuracion.ambitoId, origenSucursalId),
          ),
        );
      for (const f of filas) {
        await this.upsertFila(
          tx,
          ctx.negocioId,
          NivelConfig.Sucursal,
          destinoSucursalId,
          f.clave,
          f.valor as ValorConfig,
          f.tipo ?? undefined,
        );
      }
    });
    this.emitir(ctx.negocioId);
  }

  /** Upsert de una fila de override (clave única: negocio+nivel+ambito+clave). */
  private upsertFila(
    tx: DrizzleTx,
    negocioId: string,
    nivel: NivelConfig,
    ambitoId: string,
    clave: string,
    valor: ValorConfig,
    tipo?: string,
  ): Promise<unknown> {
    return tx
      .insert(configuracion)
      .values({ negocioId, nivel, ambitoId, clave, valor, tipo })
      .onConflictDoUpdate({
        target: [
          configuracion.negocioId,
          configuracion.nivel,
          configuracion.ambitoId,
          configuracion.clave,
        ],
        set: { valor, actualizadoEn: new Date() },
      });
  }

  private emitir(negocioId: string): void {
    this.events.emit(CONFIG_UPDATED, { negocioId } satisfies ConfigUpdatedEvent);
  }
}
