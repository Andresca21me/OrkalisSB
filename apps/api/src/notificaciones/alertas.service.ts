import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { RolUsuario } from '@orkalis/shared';
import { adminDb } from '../db/admin-client';
import { runInTenantTx } from '../db/tx';
import { alertaAdmin, usuario } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';
import { NotificacionesService } from './notificaciones.service';
import { CuposService, type EstadoCupo } from './cupos.service';

/** Umbrales de aviso de consumo, en % del cupo del ciclo. */
const UMBRALES = [100, 80] as const;

const ETIQUETA: Record<string, string> = {
  whatsapp_utility: 'WhatsApp (servicio)',
  whatsapp_marketing: 'WhatsApp (marketing)',
  sms: 'SMS',
  email: 'Email',
};

export interface AlertaAdminDto {
  id: string;
  tipo: string;
  severidad: string;
  titulo: string;
  detalle: string | null;
  leidaEn: Date | null;
  creadoEn: Date;
}

/**
 * Avisos persistentes al administrador (Plan-Mensajeria FASE-03).
 *
 * Hoy cubre el sobreconsumo de mensajería: al cruzar el 80 % y el 100 % del cupo
 * de un canal se deja un aviso in-app y, si el canal de email tiene margen, se
 * envía además un correo. La **anti-spam vive en la base de datos**: la `clave`
 * incluye canal + umbral + ciclo y el índice único hace que el segundo intento
 * sea un no-op, aunque dos workers evalúen el mismo envío a la vez.
 */
@Injectable()
export class AlertasService {
  private readonly logger = new Logger('Alertas');

  constructor(
    private readonly notificaciones: NotificacionesService,
    private readonly cupos: CuposService,
  ) {}

  /**
   * Evalúa el estado de un cupo tras un envío y crea el aviso del umbral más
   * alto cruzado. No lanza: un fallo aquí nunca debe afectar al envío.
   */
  async avisarCupo(negocioId: string, estado: EstadoCupo): Promise<void> {
    try {
      if (estado.cupo <= 0) return;
      const pct = (estado.consumo / estado.cupo) * 100;
      const umbral = UMBRALES.find((u) => pct >= u);
      if (!umbral) return;

      const canal = ETIQUETA[estado.canal] ?? estado.canal;
      const ciclo = estado.cicloInicio.slice(0, 10);
      const creada = await this.crear(negocioId, {
        tipo: 'cupo_mensajeria',
        clave: `cupo:${estado.canal}:${umbral}:${ciclo}`,
        severidad: umbral === 100 ? 'critico' : 'aviso',
        titulo:
          umbral === 100
            ? `Cupo de ${canal} agotado`
            : `Cupo de ${canal} al ${Math.floor(pct)} %`,
        detalle:
          umbral === 100
            ? `Usaste ${estado.consumo} de ${estado.cupo} mensajes de ${canal} en este ciclo. Los mensajes de marketing se detienen; las confirmaciones y recordatorios se siguen enviando. Sube de plan para ampliar el cupo.`
            : `Llevas ${estado.consumo} de ${estado.cupo} mensajes de ${canal} en este ciclo (quedan ${estado.restante}).`,
      });

      // Solo al crearla por primera vez, y nunca por el propio canal de email
      // (si el problema es el cupo de correo, avisar por correo no ayuda).
      if (creada && estado.canal !== 'email') await this.avisarPorEmail(negocioId, canal, umbral);
    } catch (e) {
      this.logger.error(`No se pudo evaluar la alerta de cupo (negocio ${negocioId}): ${(e as Error).message}`);
    }
  }

  /** Inserta el aviso; `false` si ya existía (misma clave en el mismo negocio). */
  async crear(
    negocioId: string,
    a: { tipo: string; clave: string; severidad: string; titulo: string; detalle?: string },
  ): Promise<boolean> {
    const filas = await adminDb
      .insert(alertaAdmin)
      .values({ negocioId, ...a })
      .onConflictDoNothing({ target: [alertaAdmin.negocioId, alertaAdmin.clave] })
      .returning({ id: alertaAdmin.id });
    if (filas.length) this.logger.warn(`Alerta '${a.clave}' creada (negocio ${negocioId}).`);
    return filas.length > 0;
  }

  /** Avisos del negocio, sin leer primero y luego los más recientes. */
  async listar(ctx: TenantContext, soloSinLeer = false): Promise<AlertaAdminDto[]> {
    return runInTenantTx(ctx, (tx) =>
      tx
        .select({
          id: alertaAdmin.id,
          tipo: alertaAdmin.tipo,
          severidad: alertaAdmin.severidad,
          titulo: alertaAdmin.titulo,
          detalle: alertaAdmin.detalle,
          leidaEn: alertaAdmin.leidaEn,
          creadoEn: alertaAdmin.creadoEn,
        })
        .from(alertaAdmin)
        .where(
          soloSinLeer
            ? and(eq(alertaAdmin.negocioId, ctx.negocioId), isNull(alertaAdmin.leidaEn))
            : eq(alertaAdmin.negocioId, ctx.negocioId),
        )
        .orderBy(desc(alertaAdmin.creadoEn))
        .limit(50),
    );
  }

  /** Marca un aviso como leído (idempotente: no reescribe la fecha original). */
  async marcarLeida(ctx: TenantContext, id: string): Promise<void> {
    await runInTenantTx(ctx, (tx) =>
      tx
        .update(alertaAdmin)
        .set({ leidaEn: new Date() })
        .where(and(eq(alertaAdmin.id, id), eq(alertaAdmin.negocioId, ctx.negocioId), isNull(alertaAdmin.leidaEn))),
    );
  }

  /** Correo al admin, solo si el cupo de email del ciclo tiene margen. */
  private async avisarPorEmail(negocioId: string, canal: string, umbral: number): Promise<void> {
    const cupoEmail = await this.cupos.verificar(negocioId, 'email');
    if (!cupoEmail.dentroDeCupo) return;

    const [admin] = await adminDb
      .select({ email: usuario.email })
      .from(usuario)
      .where(and(eq(usuario.negocioId, negocioId), eq(usuario.rol, RolUsuario.Admin)))
      .limit(1);
    if (!admin?.email) return;

    const titulo = umbral === 100 ? `Cupo de ${canal} agotado` : `Cupo de ${canal} al ${umbral} %`;
    const cuerpo =
      umbral === 100
        ? `Se agotó el cupo de ${canal} de este ciclo. Los mensajes de marketing quedan detenidos; las confirmaciones y recordatorios se siguen enviando. Puedes ampliarlo subiendo de plan desde Configuración → Cuenta.`
        : `Ya usaste el ${umbral} % del cupo de ${canal} de este ciclo. Revisa el consumo en Configuración → Notificaciones.`;
    await this.notificaciones.encolarAlerta(negocioId, admin.email, titulo, cuerpo);
  }
}
