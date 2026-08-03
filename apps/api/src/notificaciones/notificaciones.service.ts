import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { adminDb } from '../db/admin-client';
import { runInTenantTx } from '../db/tx';
import { mensaje } from '../db/schema';
import { JobQueue } from './job-queue';
import type { Canal } from './notification-sender.port';
import { CuposService, type CanalCupo } from './cupos.service';
import { PlantillasService } from './plantillas.service';
import { RouterCanalService } from './router-canal.service';
import { canalDePago, MensajeriaEstadoService } from './mensajeria-estado.service';
import { plantillas, type DatosCita } from './templates';
import { valoresDe } from './plantillas.render';
import { METRICAS, MetricsService } from '../observability/metrics.service';

/** Tipos de mensaje que emite el dominio (crece por fase). */
export type TipoMensaje =
  | 'otp'
  | 'confirmacion'
  | 'recordatorio'
  | 'aviso'
  | 'aviso_especialista'
  | 'marketing'
  | 'alerta'
  // Correos de acceso/credenciales (Plan-Correo):
  | 'alta_email'
  | 'reset_password'
  | 'cambio_email'
  | 'invitacion';

/** Datos comunes de trazabilidad de un mensaje encolado. */
interface Contexto {
  sucursalId?: string | null;
  citaId?: string | null;
}

/**
 * Orquestador de notificaciones (Plan-Mensajeria FASE-02).
 *
 * `encolar*` **persiste** una fila en el outbox (`mensaje`, estado `pendiente`)
 * dentro del tenant y retorna: no habla con el proveedor ni bloquea la petición
 * (RNF-002). El envío real, los reintentos y la contabilidad de cupos corren en
 * el `OutboxWorker`. Como la cola es durable, reiniciar el proceso ya no pierde
 * mensajes. El dominio sigue viendo solo los métodos `encolar*`.
 */
@Injectable()
export class NotificacionesService implements OnModuleInit {
  private readonly logger = new Logger('Notificaciones');

  constructor(
    private readonly queue: JobQueue,
    private readonly cupos: CuposService,
    private readonly plantillas: PlantillasService,
    private readonly router: RouterCanalService,
    private readonly metrics: MetricsService,
    private readonly estado: MensajeriaEstadoService,
  ) {}

  onModuleInit(): void {
    // La mensajería ya no usa la cola en memoria; queda para jobs no-mensajería.
    this.queue.registrar('exportacion-pesada', (p) => this.hExportacion(p));
  }

  // ── API de encolado (la usa el dominio) ─────────────────────────────────────
  async encolarOtp(negocioId: string, telefono: string, codigo: string, ctx: Contexto = {}): Promise<void> {
    // El OTP también se enruta (WhatsApp-first): su plantilla es de categoría
    // AUTHENTICATION, cuyas variables son POSICIONALES por exigencia de Meta
    // ({"1": código}), a diferencia de las nombradas del resto de eventos.
    const ruta = await this.router.resolver(negocioId, ctx.sucursalId ?? null, 'otp', true);
    await this.encolar(negocioId, {
      tipo: 'otp',
      canal: ruta.canal,
      cupoCanal: ruta.cupoCanal,
      plantillaClave: ruta.plantillaContentSid,
      variables: ruta.canal === 'whatsapp' ? { '1': codigo } : undefined,
      canalPreferido: ruta.canalPreferido,
      motivoFallback: ruta.motivoFallback,
      destino: telefono,
      cuerpo: plantillas.otp(codigo),
      ...ctx,
    });
  }

  async encolarConfirmacion(negocioId: string, telefono: string, datos: DatosCita, ctx: Contexto = {}): Promise<void> {
    await this.encolarCita(negocioId, telefono, datos, 'confirmacion', ctx);
  }

  async encolarRecordatorio(negocioId: string, telefono: string, datos: DatosCita, ctx: Contexto = {}): Promise<void> {
    await this.encolarCita(negocioId, telefono, datos, 'recordatorio', ctx);
  }

  async encolarAviso(negocioId: string, telefono: string, datos: DatosCita, ctx: Contexto = {}): Promise<void> {
    await this.encolarCita(negocioId, telefono, datos, 'aviso', ctx);
  }

  /**
   * Aviso al ESPECIALISTA por un cambio en su agenda (FASE-07, D4).
   * Transaccional: no se corta al agotarse el cupo, como el resto de avisos
   * operativos. El teléfono debe venir ya verificado (FASE-06).
   */
  async encolarAvisoEspecialista(negocioId: string, telefono: string, datos: DatosCita, ctx: Contexto = {}): Promise<void> {
    await this.encolarCita(negocioId, telefono, datos, 'aviso_especialista', ctx);
  }

  /**
   * Mensaje de marketing (NO transaccional): sujeto a bloqueo duro por cupo
   * (D2). Es la costura que usarán las campañas de FASE-05 en adelante.
   */
  async encolarMarketing(negocioId: string, telefono: string, cuerpo: string, ctx: Contexto = {}): Promise<void> {
    const ruta = await this.router.resolver(negocioId, ctx.sucursalId ?? null, 'marketing', false);
    await this.encolar(negocioId, {
      tipo: 'marketing',
      canal: ruta.canal,
      cupoCanal: ruta.cupoCanal,
      plantillaClave: ruta.plantillaContentSid,
      canalPreferido: ruta.canalPreferido,
      motivoFallback: ruta.motivoFallback,
      transaccional: false,
      destino: telefono,
      cuerpo,
      ...ctx,
    });
  }

  /** Aviso por email al administrador (sobreconsumo de cupos, FASE-03). */
  async encolarAlerta(negocioId: string, email: string, asunto: string, cuerpo: string): Promise<void> {
    await this.encolar(negocioId, {
      tipo: 'alerta',
      canal: 'email',
      cupoCanal: 'email',
      destino: email,
      asunto,
      cuerpo,
    });
  }

  /**
   * Correo de acceso/credenciales (Plan-Correo): verificación del alta, reset de
   * contraseña, cambio de correo, invitación de especialista.
   *
   * Difiere del resto de `encolar*` en dos cosas deliberadas:
   * 1. **Puede no tener negocio** (`negocioId` null): la verificación del alta
   *    ocurre antes de que el negocio exista. Por eso inserta con `adminDb`.
   * 2. **SÍ lanza si no puede encolar**: aquí el correo ES la operación (sin él
   *    el usuario queda esperando un enlace que nunca saldrá), así que el
   *    endpoint debe enterarse y responder error, no seguir como si nada.
   *
   * No carga cupo del plan al negocio: es correo de plataforma, no mensajería
   * del negocio (el worker además salta la contabilidad si `negocio_id` es null;
   * con negocio, el tipo transaccional nunca se bloquea por cupo).
   */
  async encolarEmailAcceso(opts: {
    negocioId?: string | null;
    email: string;
    asunto: string;
    cuerpo: string;
    html?: string;
    tipo: Extract<TipoMensaje, 'alta_email' | 'reset_password' | 'cambio_email' | 'invitacion' | 'alerta'>;
  }): Promise<void> {
    await adminDb.insert(mensaje).values({
      negocioId: opts.negocioId ?? null,
      canal: 'email',
      cupoCanal: 'email',
      tipo: opts.tipo,
      transaccional: true,
      destino: opts.email,
      asunto: opts.asunto,
      cuerpo: opts.cuerpo,
      cuerpoHtml: opts.html ?? null,
    });
    this.metrics.incPor(METRICAS.mensajesEncolados, 'email');
  }

  encolarExportacion(payload: Record<string, unknown>): void {
    this.queue.enqueue('exportacion-pesada', payload);
  }

  // ── Interno ─────────────────────────────────────────────────────────────────
  private async encolarCita(
    negocioId: string,
    telefono: string,
    datos: DatosCita,
    tipo: 'confirmacion' | 'recordatorio' | 'aviso' | 'aviso_especialista',
    ctx: Contexto,
  ): Promise<void> {
    // El canal se decide AQUÍ (FASE-05): WhatsApp si el negocio lo prefiere y
    // hay sender, plantilla aprobada y cupo; si no, SMS, anotando el motivo.
    const ruta = await this.router.resolver(negocioId, ctx.sucursalId ?? null, tipo, true);
    // El texto se resuelve también aquí y se guarda ya renderizado en el outbox:
    // editar la plantilla después no reescribe lo que ya estaba en cola.
    const cuerpo = await this.plantillas.cuerpoSms(negocioId, tipo, datos);
    await this.encolar(negocioId, {
      tipo,
      canal: ruta.canal,
      cupoCanal: ruta.cupoCanal,
      plantillaClave: ruta.plantillaContentSid,
      variables: ruta.canal === 'whatsapp' ? valoresDe(datos) : undefined,
      canalPreferido: ruta.canalPreferido,
      motivoFallback: ruta.motivoFallback,
      destino: telefono,
      cuerpo,
      ...ctx,
    });
  }

  /**
   * Inserta la fila del outbox. Un fallo aquí NO debe tumbar la operación de
   * negocio que la originó (la reserva ya está confirmada): se registra y sigue.
   *
   * Política de cupo D2 aplicada **antes de encolar**: el marketing sin cupo
   * entra directo como `sin_cupo` (queda auditado, pero el worker no lo
   * reclamará nunca); lo transaccional siempre se encola y ya decidirá el worker.
   */
  private async encolar(
    negocioId: string,
    fila: {
      tipo: TipoMensaje;
      canal: Canal;
      cupoCanal: CanalCupo;
      destino: string;
      cuerpo?: string;
      asunto?: string;
      plantillaClave?: string;
      variables?: Record<string, string>;
      canalPreferido?: Canal;
      motivoFallback?: string;
      transaccional?: boolean;
      sucursalId?: string | null;
      citaId?: string | null;
    },
  ): Promise<void> {
    // Mensajería pausada por saldo: los RECORDATORIOS y el MARKETING no se
    // encolan — acumular días de recordatorios haría que, al reanudar, salieran
    // todos de golpe avisando de citas pasadas y fundiendo el crédito nuevo.
    // Los mensajes PUNTUALES de una cita (confirmación y avisos) sí se encolan:
    // perderlos en silencio era el motivo de que "a veces no llegara" la
    // confirmación. Quedan `pendiente`, el worker no los reclama mientras dure
    // la pausa y, al reanudar, descarta los que ya caducaron (cita pasada).
    if (this.estado.pausada() && canalDePago(fila.canal)) {
      const puntual = fila.tipo === 'confirmacion' || fila.tipo === 'aviso' || fila.tipo === 'aviso_especialista';
      if (!puntual) {
        this.logger.debug(`Mensajería pausada: '${fila.tipo}' por ${fila.canal} no se encola (negocio ${negocioId}).`);
        return;
      }
      this.logger.log(`Mensajería pausada: '${fila.tipo}' queda en cola y saldrá al reanudar (negocio ${negocioId}).`);
    }

    const transaccional = fila.transaccional ?? true;
    try {
      const sinCupo = !transaccional && !(await this.cupos.verificar(negocioId, fila.cupoCanal)).dentroDeCupo;
      await runInTenantTx({ negocioId, sucursalIds: null, rol: 'sistema' }, (tx) =>
        tx.insert(mensaje).values({
          negocioId,
          sucursalId: fila.sucursalId ?? null,
          canal: fila.canal,
          cupoCanal: fila.cupoCanal,
          tipo: fila.tipo,
          transaccional,
          destino: fila.destino,
          cuerpo: fila.cuerpo,
          asunto: fila.asunto,
          plantillaClave: fila.plantillaClave,
          variables: fila.variables,
          canalPreferido: fila.canalPreferido,
          motivoFallback: fila.motivoFallback,
          citaId: fila.citaId ?? null,
          ...(sinCupo ? { estado: 'sin_cupo' as const, error: `Cupo '${fila.cupoCanal}' agotado: marketing detenido.` } : {}),
        }),
      );
      if (sinCupo) {
        this.metrics.incPor(METRICAS.mensajesSinCupo, fila.canal);
        this.logger.warn(`Marketing no encolado por cupo '${fila.cupoCanal}' agotado (negocio ${negocioId}).`);
      } else {
        this.metrics.incPor(METRICAS.mensajesEncolados, fila.canal);
      }
    } catch (e) {
      this.logger.error(`No se pudo encolar '${fila.tipo}' (negocio ${negocioId}): ${(e as Error).message}`);
    }
  }

  private async hExportacion(payload: unknown): Promise<void> {
    // v1: la generación CSV es sincrónica (FASE-10). El PDF pesado se integrará
    // con un generador real aquí; por ahora se registra el job.
    this.logger.log(`Exportación procesada: ${JSON.stringify(payload)}`);
  }
}
