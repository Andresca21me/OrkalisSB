import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { runInTenantTx } from '../db/tx';
import { cita, citaServicio, cliente, especialista, servicio, sucursal } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

/**
 * Avisos por mensajería al ESPECIALISTA (Plan-Mensajeria FASE-07, D4).
 *
 * Vive aparte porque lo disparan dos flujos distintos —la agenda interna y la
 * reserva pública— y duplicar la consulta en ambos sería pedir que se
 * desincronicen.
 */
@Injectable()
export class AvisosEspecialistaService {
  private readonly logger = new Logger('AvisosEspecialista');

  constructor(private readonly notificaciones: NotificacionesService) {}

  /**
   * Avisa al especialista de un cambio en su agenda (FASE-07, D4).
   *
   * Se llama SIEMPRE **post-commit** y **nunca lanza**: la cita ya es un hecho,
   * así que un problema al notificar no puede deshacerla. Si el especialista no
   * tiene celular registrado se omite y se registra en el log.
   */
  async avisar(ctx: TenantContext, citaId: string, motivo: string): Promise<void> {
    try {
      const { d, servicios } = await runInTenantTx(ctx, async (tx) => {
        const [fila] = await tx
          .select({
            inicio: cita.inicio,
            sucursalId: cita.sucursalId,
            telefono: especialista.telefono,
            especialistaNombre: especialista.nombre,
            sucursalNombre: sucursal.nombre,
            clienteNombre: cliente.nombre,
          })
          .from(cita)
          .innerJoin(especialista, eq(especialista.id, cita.especialistaId))
          .innerJoin(sucursal, eq(sucursal.id, cita.sucursalId))
          .leftJoin(cliente, eq(cliente.id, cita.clienteId))
          .where(eq(cita.id, citaId))
          .limit(1);
        if (!fila) return { d: undefined, servicios: [] as string[] };
        const svs = await tx
          .select({ nombre: servicio.nombre })
          .from(citaServicio)
          .innerJoin(servicio, eq(servicio.id, citaServicio.servicioId))
          .where(eq(citaServicio.citaId, citaId));
        return { d: fila, servicios: svs.map((s) => s.nombre) };
      });
      if (!d) return;
      if (!d.telefono) {
        this.logger.log(`Cita ${citaId}: especialista sin celular registrado, no se avisa.`);
        return;
      }
      await this.notificaciones.encolarAvisoEspecialista(
        ctx.negocioId,
        d.telefono,
        {
          sucursalNombre: d.sucursalNombre,
          especialistaNombre: d.especialistaNombre,
          clienteNombre: d.clienteNombre ?? undefined,
          // Con varios servicios se listan juntos (la plantilla tiene una sola variable).
          servicioNombre: servicios.length ? servicios.join(' + ') : undefined,
          motivo,
          inicio: d.inicio,
        },
        { sucursalId: d.sucursalId, citaId },
      );
    } catch (e) {
      this.logger.error(`No se pudo avisar al especialista de la cita ${citaId}: ${(e as Error).message}`);
    }
  }
}
