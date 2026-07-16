import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { EstadoSuscripcion } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { negocio, suscripcion } from '../db/schema';
import { EventoSuscripcion, transicionar } from './suscripcion-estado';

/** Campos de la suscripción que una transición puede fijar de paso. */
export interface CamposSuscripcion {
  plan?: string;
  numEspecialistas?: number;
  trialFin?: Date | null;
  diaCobro?: number | null;
  proximoCobro?: Date | null;
  ultimoCobroOk?: Date | null;
  mpCustomerId?: string | null;
  mpCardId?: string | null;
  mpPayerEmail?: string | null;
  metodoUltimos4?: string | null;
  intentosFallidos?: number;
  graciaInicio?: Date | null;
}

/**
 * Aplica transiciones de la máquina de estados y mantiene SINCRONIZADAS las dos
 * tablas que reflejan el estado (Plan-Pagos FASE-00):
 *  - `suscripcion.estado` (fuente del cobro y los límites), y
 *  - `negocio.estadoSuscripcion` (lo que lee `auth/me` para el acceso).
 *
 * Usa la conexión admin (transversal a tenants, igual que `PlataformaService`):
 * el ciclo de cobro lo orquesta la plataforma, no un usuario del negocio.
 */
@Injectable()
export class SuscripcionEstadoService {
  private readonly logger = new Logger('SuscripcionEstado');

  /**
   * Lee el estado actual, calcula el siguiente con `transicionar` (lanza si la
   * transición es inválida) y actualiza ambas tablas en una sola transacción,
   * fijando de paso los `campos` indicados. Devuelve el nuevo estado.
   */
  async aplicar(
    negocioId: string,
    evento: EventoSuscripcion,
    campos: CamposSuscripcion = {},
  ): Promise<EstadoSuscripcion> {
    return adminDb.transaction(async (tx) => {
      const [sus] = await tx
        .select({ estado: suscripcion.estado })
        .from(suscripcion)
        .where(eq(suscripcion.negocioId, negocioId))
        .limit(1);
      if (!sus) throw new NotFoundException('El negocio no tiene suscripción.');

      const nuevo = transicionar(sus.estado as EstadoSuscripcion, evento);
      const ahora = new Date();

      await tx
        .update(suscripcion)
        .set({ ...campos, estado: nuevo, actualizadoEn: ahora })
        .where(eq(suscripcion.negocioId, negocioId));

      const filas = await tx
        .update(negocio)
        .set({ estadoSuscripcion: nuevo, actualizadoEn: ahora })
        .where(eq(negocio.id, negocioId))
        .returning({ id: negocio.id });
      if (filas.length === 0) throw new NotFoundException('Negocio no encontrado.');

      this.logger.log(`Negocio ${negocioId}: ${sus.estado} --${evento}--> ${nuevo}`);
      return nuevo;
    });
  }
}
