import { Body, Controller, ForbiddenException, Headers, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import type { Env } from '../config/env.validation';
import { OutboxWorker, type EstadoProveedor } from './outbox.worker';

/** Cuerpo (form-urlencoded) del Status Callback de Twilio. */
interface EstadoTwilio {
  MessageSid?: string;
  SmsSid?: string;
  MessageStatus?: string;
  SmsStatus?: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

/**
 * Mapa de estados de Twilio → ciclo de vida del outbox. `queued/accepted/
 * sending/sent` confirman la entrega al operador; `delivered/read` la entrega
 * real al destinatario; `undelivered/failed` el fallo definitivo.
 */
const MAPA: Record<string, EstadoProveedor> = {
  queued: 'enviado',
  accepted: 'enviado',
  scheduled: 'enviado',
  sending: 'enviado',
  sent: 'enviado',
  delivered: 'entregado',
  read: 'entregado',
  undelivered: 'fallido',
  failed: 'fallido',
};

/**
 * Webhook público de estado de Twilio (Plan-Mensajeria FASE-02, AM-4).
 * URL a configurar como Status Callback: `/api/webhooks/twilio/status`.
 *
 * Se valida la cabecera `X-Twilio-Signature` (HMAC del auth token sobre la URL
 * + los campos del formulario): sin firma válida se rechaza, porque el endpoint
 * es público y de otro modo cualquiera podría falsear entregas. Siempre responde
 * 204 para que Twilio no reintente eventos ya procesados.
 */
@Public()
@Controller('webhooks/twilio')
export class TwilioWebhooksController {
  private readonly logger = new Logger('TwilioWebhook');

  constructor(
    private readonly outbox: OutboxWorker,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('status')
  @HttpCode(204)
  async status(
    @Body() body: EstadoTwilio,
    @Headers('x-twilio-signature') firma: string | undefined,
    @Req() req: Request,
  ): Promise<void> {
    await this.verificarFirma(req, body as Record<string, string>, firma);

    const sid = body.MessageSid ?? body.SmsSid;
    const estadoTwilio = (body.MessageStatus ?? body.SmsStatus ?? '').toLowerCase();
    const nuevo = MAPA[estadoTwilio];
    if (!sid || !nuevo) {
      this.logger.warn(`Callback ignorado (sid=${sid ?? '-'}, status=${estadoTwilio || '-'}).`);
      return;
    }

    const error = body.ErrorCode ? `Twilio ${body.ErrorCode}: ${body.ErrorMessage ?? ''}`.trim() : undefined;
    // El código numérico viaja aparte: el worker decide con él (p. ej. degradar
    // un WhatsApp a SMS) sin tener que parsear el texto.
    const errorCode = body.ErrorCode ? Number(body.ErrorCode) : undefined;
    const res = await this.outbox.aplicarEstadoProveedor(sid, nuevo, error, Number.isFinite(errorCode) ? errorCode : undefined);
    if (res === 'desconocido') this.logger.warn(`Callback de un mensaje no registrado (${sid}).`);
  }

  /** Valida `X-Twilio-Signature` contra la URL pública y los campos del form. */
  private async verificarFirma(req: Request, params: Record<string, string>, firma?: string): Promise<void> {
    const token = this.config.get('TWILIO_AUTH_TOKEN', { infer: true });
    if (!token) throw new ForbiddenException('Webhook de estado no configurado.');
    if (!firma) throw new ForbiddenException('Falta la firma del webhook.');

    // La firma se calcula sobre la URL EXACTA que Twilio invocó: se prefiere la
    // configurada (detrás del proxy de Railway el host/protocolo pueden variar).
    const url = this.config.get('TWILIO_STATUS_CALLBACK_URL', { infer: true }) ?? `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    const especificador = 'twilio';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(especificador).catch(() => {
      throw new ForbiddenException('No se puede validar la firma: falta el paquete "twilio".');
    });
    const validar = (mod.validateRequest ?? mod.default?.validateRequest) as
      | ((token: string, firma: string, url: string, params: Record<string, string>) => boolean)
      | undefined;
    if (!validar) throw new ForbiddenException('No se puede validar la firma del webhook.');
    if (!validar(token, firma, url, params ?? {})) throw new ForbiddenException('Firma del webhook inválida.');
  }
}
