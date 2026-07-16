import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { NivelConfig, PerfilNegocio } from '@orkalis/shared';
import { runInTenantTx } from '../db/tx';
import { configuracion, negocio } from '../db/schema';
import { CLAVES, getDefinicion } from './registry';
import type { ValorConfig, ValorEfectivo } from './config.types';

interface EntradaCache {
  perfil: PerfilNegocio;
  negocioOverrides: Map<string, ValorConfig>;
  sucursalOverrides: Map<string, Map<string, ValorConfig>>;
}

/** Payload del evento de invalidación de configuración. */
export interface ConfigUpdatedEvent {
  negocioId: string;
}
export const CONFIG_UPDATED = 'config.updated';

/**
 * ConfigResolver (FASE-06, ADR-002).
 *
 * Resuelve cada clave por la cadena sistema(default por vertical) → negocio →
 * sucursal (gana el más específico) y reporta su PROCEDENCIA. Cachea por
 * negocio (una entrada con todos sus overrides) e invalida por evento.
 */
@Injectable()
export class ConfigResolverService {
  private readonly cache = new Map<string, EntradaCache>();

  /** Resuelve una clave: valor efectivo + procedencia. */
  async resolver(
    negocioId: string,
    sucursalId: string | null,
    clave: string,
  ): Promise<ValorEfectivo> {
    const def = getDefinicion(clave);
    if (!def) throw new NotFoundException(`Clave de configuración desconocida: ${clave}`);

    const entrada = await this.cargar(negocioId);

    const ovSucursal = sucursalId ? entrada.sucursalOverrides.get(sucursalId) : undefined;
    if (ovSucursal && ovSucursal.has(clave)) {
      return { clave, valor: ovSucursal.get(clave)!, procedencia: NivelConfig.Sucursal, tipo: def.tipo };
    }
    if (entrada.negocioOverrides.has(clave)) {
      return { clave, valor: entrada.negocioOverrides.get(clave)!, procedencia: NivelConfig.Negocio, tipo: def.tipo };
    }
    return { clave, valor: def.defaults[entrada.perfil], procedencia: NivelConfig.Sistema, tipo: def.tipo };
  }

  /** Helper tipado para banderas de módulo. */
  async resolverModulo(negocioId: string, sucursalId: string | null, clave: string): Promise<boolean> {
    const { valor } = await this.resolver(negocioId, sucursalId, clave);
    return valor === true;
  }

  /** Helper tipado para parámetros numéricos (porcentaje/numero/dinero/duracion). */
  async resolverNumero(negocioId: string, sucursalId: string | null, clave: string): Promise<number> {
    const { valor } = await this.resolver(negocioId, sucursalId, clave);
    return typeof valor === 'number' ? valor : Number(valor);
  }

  /** TODAS las claves resueltas con su procedencia (UI de admin, RF-010). */
  async getEfectivos(negocioId: string, sucursalId: string | null): Promise<ValorEfectivo[]> {
    await this.cargar(negocioId);
    return Promise.all(CLAVES.map((clave) => this.resolver(negocioId, sucursalId, clave)));
  }

  /** Invalida la caché de un negocio (al guardar/borrar/clonar overrides). */
  invalidar(negocioId: string): void {
    this.cache.delete(negocioId);
  }

  @OnEvent(CONFIG_UPDATED)
  onConfigUpdated(payload: ConfigUpdatedEvent): void {
    this.invalidar(payload.negocioId);
  }

  /** Carga (o reutiliza de caché) los overrides + perfil del negocio. */
  private async cargar(negocioId: string): Promise<EntradaCache> {
    const cacheada = this.cache.get(negocioId);
    if (cacheada) return cacheada;

    const entrada = await runInTenantTx(
      { negocioId, sucursalIds: null, rol: 'sistema' },
      async (tx) => {
        const [neg] = await tx
          .select({ perfil: negocio.perfil })
          .from(negocio)
          .where(eq(negocio.id, negocioId))
          .limit(1);
        if (!neg) throw new NotFoundException('Negocio no encontrado.');

        const filas = await tx.select().from(configuracion);

        const negocioOverrides = new Map<string, ValorConfig>();
        const sucursalOverrides = new Map<string, Map<string, ValorConfig>>();
        for (const f of filas) {
          const valor = f.valor as ValorConfig;
          if (f.nivel === NivelConfig.Sucursal) {
            const m = sucursalOverrides.get(f.ambitoId) ?? new Map<string, ValorConfig>();
            m.set(f.clave, valor);
            sucursalOverrides.set(f.ambitoId, m);
          } else {
            negocioOverrides.set(f.clave, valor);
          }
        }
        return { perfil: neg.perfil as PerfilNegocio, negocioOverrides, sucursalOverrides };
      },
    );

    this.cache.set(negocioId, entrada);
    return entrada;
  }
}
