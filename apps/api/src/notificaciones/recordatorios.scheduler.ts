import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { and, eq, gt, lt } from 'drizzle-orm';
import { EstadoCita } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { cita, cliente, especialista, retencionFranja, sucursal } from '../db/schema';
import { ConfigResolverService } from '../config-module/config-resolver.service';
import { NotificacionesService } from './notificaciones.service';

/**
 * Jobs programados (FASE-11): escanea citas próximas para encolar recordatorios
 * (respetando `ventana_recordatorio_horas`) y limpia retenciones expiradas.
 * Usa la conexión admin (tarea de plataforma, cross-tenant).
 */
@Injectable()
export class RecordatoriosScheduler {
  private readonly logger = new Logger('RecordatoriosScheduler');

  constructor(
    private readonly config: ConfigResolverService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  @Interval(60_000)
  async revisar(): Promise<void> {
    await this.escanearRecordatorios();
  }

  @Interval(60_000)
  async limpiar(): Promise<void> {
    await adminDb.delete(retencionFranja).where(lt(retencionFranja.expiraEn, new Date()));
  }

  /**
   * Encola recordatorios para citas confirmadas dentro de su ventana y aún no
   * notificadas. Devuelve cuántas encoló (útil para pruebas).
   */
  async escanearRecordatorios(ahora = new Date()): Promise<number> {
    const proximas = await adminDb
      .select({
        id: cita.id,
        negocioId: cita.negocioId,
        sucursalId: cita.sucursalId,
        inicio: cita.inicio,
        telefono: cliente.telefono,
        clienteNombre: cliente.nombre,
        sucursalNombre: sucursal.nombre,
        especialistaNombre: especialista.nombre,
      })
      .from(cita)
      .innerJoin(sucursal, eq(sucursal.id, cita.sucursalId))
      .innerJoin(especialista, eq(especialista.id, cita.especialistaId))
      .leftJoin(cliente, eq(cliente.id, cita.clienteId))
      .where(
        and(
          eq(cita.estado, EstadoCita.Confirmada),
          eq(cita.recordatorioEnviado, false),
          gt(cita.inicio, ahora),
        ),
      );

    let encolados = 0;
    for (const c of proximas) {
      const ventanaHoras = await this.config.resolverNumero(
        c.negocioId,
        c.sucursalId,
        'agendamiento.ventana_recordatorio_horas',
      );
      const dentroDeVentana = c.inicio.getTime() - ahora.getTime() <= ventanaHoras * 3600_000;
      if (!dentroDeVentana) continue;

      if (c.telefono) {
        await this.notificaciones.encolarRecordatorio(
          c.negocioId,
          c.telefono,
          { sucursalNombre: c.sucursalNombre, especialistaNombre: c.especialistaNombre, clienteNombre: c.clienteNombre ?? undefined, inicio: c.inicio },
          { sucursalId: c.sucursalId, citaId: c.id },
        );
        encolados++;
      }
      await adminDb.update(cita).set({ recordatorioEnviado: true }).where(eq(cita.id, c.id));
    }
    if (encolados) this.logger.log(`Recordatorios encolados: ${encolados}`);
    return encolados;
  }
}
