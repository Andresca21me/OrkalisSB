import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import { EstadoCita } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { cita, citaRecordatorio, cliente, especialista, retencionFranja, sucursal } from '../db/schema';
import { ConfigResolverService } from '../config-module/config-resolver.service';
import { NotificacionesService } from './notificaciones.service';
import { MensajeriaEstadoService } from './mensajeria-estado.service';

/** Ventanas soportadas (FASE-08). `config` es la ventana libre del negocio. */
type Ventana = 'h24' | 'h2' | 'config';

/**
 * Jobs programados: escanea citas próximas para encolar recordatorios y limpia
 * retenciones expiradas. Usa la conexión admin (tarea de plataforma, cross-tenant).
 *
 * **FASE-08 — varias ventanas.** Antes había un único booleano
 * `cita.recordatorio_enviado`, así que solo cabía un recordatorio por cita.
 * Ahora cada ventana (24 h, 2 h y la configurable del negocio) se resuelve por
 * separado y deja su propia fila en `cita_recordatorio`; la clave primaria
 * `(cita_id, ventana)` es lo que garantiza que un reinicio a mitad de escaneo no
 * duplique avisos.
 */
@Injectable()
export class RecordatoriosScheduler {
  private readonly logger = new Logger('RecordatoriosScheduler');

  constructor(
    private readonly config: ConfigResolverService,
    private readonly notificaciones: NotificacionesService,
    private readonly estado: MensajeriaEstadoService,
  ) {}

  @Interval(60_000)
  async revisar(): Promise<void> {
    try {
      await this.escanearRecordatorios();
    } catch (e) {
      this.logger.error(`Escaneo de recordatorios falló: ${(e as Error).message}`);
    }
  }

  @Interval(60_000)
  async limpiar(): Promise<void> {
    await adminDb.delete(retencionFranja).where(lt(retencionFranja.expiraEn, new Date()));
  }

  /**
   * Encola los recordatorios que toquen. Devuelve cuántos encoló (para pruebas).
   *
   * Regla clave: de las ventanas que ya "vencieron" para una cita se envía
   * **solo la más cercana** a la hora de la cita; las mayores se registran sin
   * enviar. Esto evita el caso de una reserva creada con 1 h de antelación, que
   * si no dispararía a la vez el aviso de 24 h y el de 2 h.
   */
  async escanearRecordatorios(ahora = new Date()): Promise<number> {
    // Sin mensajería operativa no se escanea siquiera: no se marcan ventanas
    // como atendidas, así que al reanudar los avisos que aún tengan sentido
    // vuelven a entrar solos y los de citas ya pasadas se quedan fuera.
    if (this.estado.pausada()) {
      this.estado.avisarPausaUnaVez('Mensajería pausada por saldo: los recordatorios no se programan.');
      return 0;
    }

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
      .where(and(eq(cita.estado, EstadoCita.Confirmada), gt(cita.inicio, ahora)));
    if (!proximas.length) return 0;

    // Una sola consulta para saber qué ventanas ya están resueltas.
    const resueltas = await adminDb
      .select({ citaId: citaRecordatorio.citaId, ventana: citaRecordatorio.ventana })
      .from(citaRecordatorio)
      .where(inArray(citaRecordatorio.citaId, proximas.map((c) => c.id)));
    const yaHechas = new Set(resueltas.map((r) => `${r.citaId}:${r.ventana}`));

    let encolados = 0;
    for (const c of proximas) {
      const horasRestantes = (c.inicio.getTime() - ahora.getTime()) / 3600_000;
      const ventanas = await this.ventanasDe(c.negocioId, c.sucursalId);

      // Vencidas = su umbral ya se alcanzó y no están registradas todavía.
      const vencidas = ventanas
        .filter((v) => horasRestantes <= v.horas && !yaHechas.has(`${c.id}:${v.ventana}`))
        .sort((a, b) => a.horas - b.horas);
      if (!vencidas.length) continue;

      // La más cercana a la cita es la única que se envía; el resto solo se marca.
      const [aEnviar, ...soloMarcar] = vencidas;
      const puedeEnviar = Boolean(c.telefono);

      if (puedeEnviar) {
        await this.notificaciones.encolarRecordatorio(
          c.negocioId,
          c.telefono!,
          {
            sucursalNombre: c.sucursalNombre,
            especialistaNombre: c.especialistaNombre,
            clienteNombre: c.clienteNombre ?? undefined,
            inicio: c.inicio,
          },
          { sucursalId: c.sucursalId, citaId: c.id },
        );
        encolados++;
      }

      await adminDb
        .insert(citaRecordatorio)
        .values([
          { citaId: c.id, ventana: aEnviar.ventana, enviadoEn: puedeEnviar ? ahora : null },
          ...soloMarcar.map((v) => ({ citaId: c.id, ventana: v.ventana, enviadoEn: null })),
        ])
        // Si otro proceso ganó la carrera, su fila manda: no se reenvía.
        .onConflictDoNothing({ target: [citaRecordatorio.citaId, citaRecordatorio.ventana] });
    }

    if (encolados) this.logger.log(`Recordatorios encolados: ${encolados}`);
    return encolados;
  }

  /** Ventanas activas del negocio/sucursal, en horas antes de la cita. */
  private async ventanasDe(
    negocioId: string,
    sucursalId: string,
  ): Promise<{ ventana: Ventana; horas: number }[]> {
    const [h24, h2, horasConfig] = await Promise.all([
      this.config.resolverModulo(negocioId, sucursalId, 'agendamiento.recordatorio_24h'),
      this.config.resolverModulo(negocioId, sucursalId, 'agendamiento.recordatorio_2h'),
      this.config.resolverNumero(negocioId, sucursalId, 'agendamiento.ventana_recordatorio_horas'),
    ]);
    const ventanas: { ventana: Ventana; horas: number }[] = [];
    if (h24) ventanas.push({ ventana: 'h24', horas: 24 });
    if (h2) ventanas.push({ ventana: 'h2', horas: 2 });
    // La ventana libre solo aporta si no coincide con las fijas ya activas.
    if (horasConfig > 0 && !ventanas.some((v) => v.horas === horasConfig)) {
      ventanas.push({ ventana: 'config', horas: horasConfig });
    }
    return ventanas;
  }
}
