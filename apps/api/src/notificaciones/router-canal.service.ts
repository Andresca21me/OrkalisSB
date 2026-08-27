import { Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PlanSuscripcion } from '@orkalis/shared';
import { runInTenantTx } from '../db/tx';
import { plantillaMensaje, suscripcion } from '../db/schema';
import { ConfigResolverService } from '../config-module/config-resolver.service';
import { PLANES } from '../plans/plan-registry';
import { RemitenteResolver } from './remitente/remitente.resolver';
import type { EventoWhatsapp, PerfilRemitente } from './remitente/perfil-remitente';
import { CuposService, type CanalCupo } from './cupos.service';
import type { Canal } from './notification-sender.port';

/** Decisión de enrutamiento de un evento (FASE-05). */
export interface Ruta {
  canal: Canal;
  cupoCanal: CanalCupo;
  /** Content SID de la plantilla aprobada (solo WhatsApp). */
  plantillaContentSid?: string;
  /** Canal que se quería usar, cuando hubo que caer a otro. */
  canalPreferido?: Canal;
  /** Por qué se cayó de canal (queda auditado en `mensaje`). */
  motivoFallback?: string;
}

/**
 * Enrutador de canal por evento (Plan-Mensajeria FASE-05).
 *
 * Decide si un evento sale por **WhatsApp o SMS** según la configuración del
 * negocio, su plan y lo que hay realmente disponible. La regla que gobierna todo
 * es **degradar antes que fallar**: si falta el sender, la plantilla aprobada o
 * el cupo de WhatsApp, se envía por SMS y se anota el motivo, en lugar de dejar
 * al cliente sin aviso.
 *
 * Hoy, sin las plantillas de Meta aprobadas (AM-3), este enrutador manda todo
 * por SMS — pero por la vía del fallback, que es la misma que se usará cuando
 * WhatsApp esté disponible. El día que lleguen los Content SID no hay que tocar
 * el dominio: basta con que existan.
 */
@Injectable()
export class RouterCanalService {
  private readonly logger = new Logger('RouterCanal');

  constructor(
    private readonly config: ConfigResolverService,
    private readonly remitente: RemitenteResolver,
    private readonly cupos: CuposService,
  ) {}

  /** Ruta de SMS pura: el destino final cuando WhatsApp no es viable. */
  private rutaSms(motivo?: string, preferido?: Canal): Ruta {
    return motivo
      ? { canal: 'sms', cupoCanal: 'sms', canalPreferido: preferido, motivoFallback: motivo }
      : { canal: 'sms', cupoCanal: 'sms' };
  }

  /**
   * Resuelve el canal de un evento. No lanza nunca: ante cualquier duda
   * devuelve SMS, que es el canal que siempre está disponible.
   */
  async resolver(
    negocioId: string,
    sucursalId: string | null,
    evento: EventoWhatsapp,
    transaccional: boolean,
  ): Promise<Ruta> {
    try {
      const preferencia = await this.config.resolver(negocioId, sucursalId, `mensajeria.canal_${evento}`);
      const elegido = String(preferencia.valor ?? 'auto');
      if (elegido === 'sms') return this.rutaSms();

      const cupoCanal: CanalCupo = transaccional ? 'whatsapp_utility' : 'whatsapp_marketing';

      // 1) Marketing por WhatsApp solo si el plan lo habilita.
      if (!transaccional && !(await this.planPermiteMarketing(negocioId))) {
        return this.rutaSms('El plan no incluye marketing por WhatsApp.', 'whatsapp');
      }

      // 2) Hace falta un sender de WhatsApp dado de alta (AM-3).
      const perfil = this.remitente.resolver(negocioId);
      if (!perfil.whatsappFrom) {
        return this.rutaSms('Sin sender de WhatsApp configurado.', 'whatsapp');
      }

      // 3) Y una plantilla APROBADA por Meta: fuera de la ventana de 24 h no se
      //    puede mandar texto libre, así que sin Content SID no hay envío válido.
      const contentSid = await this.contentSid(negocioId, evento, perfil);
      if (!contentSid) {
        return this.rutaSms('Sin plantilla de WhatsApp aprobada para este evento.', 'whatsapp');
      }

      // 4) Y cupo del canal en el ciclo. Si se agotó, el transaccional baja a
      //    SMS en vez de detenerse (D2); el marketing ya se corta antes.
      const cupo = await this.cupos.verificar(negocioId, cupoCanal);
      if (!cupo.dentroDeCupo) {
        if (!transaccional) return this.rutaSms('Cupo de WhatsApp marketing agotado.', 'whatsapp');
        return this.rutaSms('Cupo de WhatsApp agotado; se envía por SMS.', 'whatsapp');
      }

      return { canal: 'whatsapp', cupoCanal, plantillaContentSid: contentSid };
    } catch (e) {
      this.logger.error(`Routing de '${evento}' falló, se usa SMS: ${(e as Error).message}`);
      return this.rutaSms();
    }
  }

  /**
   * Content SID de la plantilla WhatsApp para ese evento: la fila del negocio
   * (si la personalizó) prevalece; sin ella, el default de plataforma del
   * perfil (`TWILIO_WA_TPL_*`, AM-3).
   */
  private async contentSid(
    negocioId: string,
    evento: EventoWhatsapp,
    perfil: PerfilRemitente,
  ): Promise<string | undefined> {
    const porDefecto = perfil.waTemplates?.[evento];
    const [fila] = await runInTenantTx({ negocioId, sucursalIds: null, rol: 'sistema' }, (tx) =>
      tx
        .select({ sid: plantillaMensaje.whatsappContentSid, activo: plantillaMensaje.activo })
        .from(plantillaMensaje)
        .where(
          and(
            eq(plantillaMensaje.negocioId, negocioId),
            eq(plantillaMensaje.evento, evento),
            eq(plantillaMensaje.canal, 'whatsapp'),
          ),
        )
        .limit(1),
    );
    return (fila?.activo && fila.sid ? fila.sid : undefined) ?? porDefecto;
  }

  private async planPermiteMarketing(negocioId: string): Promise<boolean> {
    const [sus] = await runInTenantTx({ negocioId, sucursalIds: null, rol: 'sistema' }, (tx) =>
      tx
        .select({ plan: suscripcion.plan })
        .from(suscripcion)
        .where(eq(suscripcion.negocioId, negocioId))
        .limit(1),
    );
    const plan = (sus?.plan ?? PlanSuscripcion.Basico) as PlanSuscripcion;
    return PLANES[plan].funciones.marketing !== false;
  }
}
