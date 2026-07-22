import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  VARIABLES_PLANTILLA,
  type CanalPlantilla,
  type EventoPlantilla,
  type PlantillaMensaje,
} from '@orkalis/shared';
import { runInTenantTx } from '../db/tx';
import { plantillaMensaje } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import type { DatosCita } from './templates';
import { EVENTOS, PERMITIDAS, renderizar, textoPorDefecto, valoresDe, variablesDe } from './plantillas.render';

export { EVENTOS, renderizar, valoresDe, variablesDe } from './plantillas.render';

/**
 * Plantillas de mensaje por negocio (Plan-Mensajeria FASE-04, D5).
 *
 * La resolución ocurre **al encolar**, no al enviar: el outbox guarda el texto ya
 * renderizado. Así, editar una plantilla no reescribe mensajes que ya estaban en
 * cola — el cliente recibe lo que estaba vigente cuando ocurrió el hecho.
 */
@Injectable()
export class PlantillasService {
  /**
   * Cuerpo del SMS para un evento: plantilla del negocio si existe y está
   * activa; si no, el default de plataforma. Nunca lanza — ante cualquier
   * problema cae al default, porque quedarse sin avisar al cliente es peor que
   * avisarle con el texto genérico.
   */
  async cuerpoSms(negocioId: string, evento: EventoPlantilla, datos: DatosCita): Promise<string> {
    const porDefecto = this.porDefecto(evento, datos);
    try {
      const [fila] = await runInTenantTx({ negocioId, sucursalIds: null, rol: 'sistema' }, (tx) =>
        tx
          .select({ contenido: plantillaMensaje.contenidoSms, activo: plantillaMensaje.activo })
          .from(plantillaMensaje)
          .where(
            and(
              eq(plantillaMensaje.negocioId, negocioId),
              eq(plantillaMensaje.evento, evento),
              eq(plantillaMensaje.canal, 'sms'),
            ),
          )
          .limit(1),
      );
      if (!fila?.activo || !fila.contenido?.trim()) return porDefecto;
      const cuerpo = renderizar(fila.contenido, valoresDe(datos));
      return cuerpo || porDefecto;
    } catch {
      return porDefecto;
    }
  }

  /** Texto de plataforma de un evento (fallback y previsualización del panel). */
  porDefecto(evento: EventoPlantilla, datos: DatosCita): string {
    return textoPorDefecto(evento, datos);
  }

  /** Las plantillas del negocio + el default de cada evento, para el panel. */
  async listar(ctx: TenantContext, canal: CanalPlantilla = 'sms'): Promise<PlantillaMensaje[]> {
    const filas = await runInTenantTx(ctx, (tx) =>
      tx
        .select()
        .from(plantillaMensaje)
        .where(and(eq(plantillaMensaje.negocioId, ctx.negocioId), eq(plantillaMensaje.canal, canal))),
    );
    const porEvento = new Map(filas.map((f) => [f.evento as EventoPlantilla, f]));
    return EVENTOS.map((evento) => {
      const f = porEvento.get(evento);
      return {
        evento,
        canal,
        contenidoSms: f?.contenidoSms ?? null,
        whatsappContentSid: f?.whatsappContentSid ?? null,
        activo: f?.activo ?? true,
        porDefecto: this.porDefecto(evento, EJEMPLO),
        actualizadoEn: f?.actualizadoEn?.toISOString() ?? null,
      };
    });
  }

  /**
   * Guarda la plantilla de un evento/canal. Validar aquí (y no solo en el
   * navegador) es lo que impide que un `{{fehca}}` llegue a un cliente real.
   */
  async guardar(
    ctx: TenantContext,
    evento: EventoPlantilla,
    canal: CanalPlantilla,
    datos: { contenidoSms?: string | null; whatsappContentSid?: string | null; activo?: boolean },
  ): Promise<void> {
    const contenido = datos.contenidoSms?.trim() || null;
    if (canal === 'sms' && contenido) this.validarSms(contenido);

    await runInTenantTx(ctx, (tx) =>
      tx
        .insert(plantillaMensaje)
        .values({
          negocioId: ctx.negocioId,
          evento,
          canal,
          contenidoSms: contenido,
          whatsappContentSid: datos.whatsappContentSid?.trim() || null,
          activo: datos.activo ?? true,
        })
        .onConflictDoUpdate({
          target: [plantillaMensaje.negocioId, plantillaMensaje.evento, plantillaMensaje.canal],
          set: {
            contenidoSms: contenido,
            whatsappContentSid: datos.whatsappContentSid?.trim() || null,
            activo: datos.activo ?? true,
            actualizadoEn: new Date(),
          },
        }),
    );
  }

  private validarSms(contenido: string): void {
    const desconocidas = variablesDe(contenido).filter((v) => !PERMITIDAS.has(v));
    if (desconocidas.length) {
      throw new BadRequestException(
        `Variables no permitidas: ${desconocidas.map((v) => `{{${v}}}`).join(', ')}. ` +
          `Disponibles: ${VARIABLES_PLANTILLA.map((v) => `{{${v}}}`).join(', ')}.`,
      );
    }
    // Tope defensivo: un SMS de 6 segmentos es casi siempre un error de edición.
    if (contenido.length > 900) {
      throw new BadRequestException('El mensaje es demasiado largo (máximo 900 caracteres).');
    }
  }
}

/** Datos de muestra para previsualizar los textos por defecto en el panel. */
const EJEMPLO: DatosCita = {
  clienteNombre: 'Ana',
  sucursalNombre: 'Sede Centro',
  especialistaNombre: 'Carlos',
  servicioNombre: 'Corte',
  inicio: new Date('2030-03-10T19:00:00Z'),
};
