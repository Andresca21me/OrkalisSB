import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { RolUsuario } from '@orkalis/shared';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { FacturacionService } from './facturacion.service';
import { PlataformaService } from './plataforma.service';
import { CobroCronService } from './cobro-cron.service';
import { CortesiaDto, PausarMensajeriaDto, ReanudarMensajeriaDto } from './dto/plataforma.dto';
import { MensajeriaEstadoService } from '../notificaciones/mensajeria-estado.service';
import type { NotificacionMP } from './mercadopago.client';

/**
 * Webhook público de Mercado Pago (Plan-Pagos FASE-02, RNF-012). La URL a
 * configurar en el panel es `/api/pagos/webhook`. La firma `x-signature` se
 * valida en el servicio. `data.id` puede venir en el body o en el query.
 */
@Public()
@Controller('pagos')
export class MercadoPagoWebhookController {
  constructor(private readonly facturacion: FacturacionService) {}

  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Body() noti: NotificacionMP,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
    @Query('data.id') queryDataId?: string,
  ) {
    // Algunos envíos traen data.id solo en el query (IPN legado): lo normalizamos.
    if (queryDataId && !noti?.data?.id) noti = { ...noti, data: { id: queryDataId } };
    return this.facturacion.procesarWebhook(noti, { xSignature, xRequestId });
  }
}

/** Endpoints del operador de plataforma (FASE-12). Transversal a los negocios. */
@Controller('plataforma')
@Roles(RolUsuario.OperadorPlataforma)
export class PlataformaController {
  constructor(
    private readonly plataforma: PlataformaService,
    private readonly facturacion: FacturacionService,
    private readonly cobroCron: CobroCronService,
    private readonly mensajeria: MensajeriaEstadoService,
  ) {}

  // ── Interruptor de mensajería ───────────────────────────────────────────────
  //
  // El crédito del proveedor es de la plataforma, no de un negocio, así que se
  // gobierna desde aquí. Al agotarse, la plataforma pasa a modo sin mensajes
  // (los códigos se enseñan en pantalla) en vez de quedarse inservible.

  @Get('mensajeria')
  estadoMensajeria() {
    return this.mensajeria.vista();
  }

  /** Corta los envíos a mano (p. ej. antes de que se agote el crédito). */
  @Post('mensajeria/pausar')
  @HttpCode(200)
  async pausarMensajeria(@Body() dto: PausarMensajeriaDto) {
    await this.mensajeria.pausar(dto.motivo?.trim() || 'Pausada manualmente desde la consola.');
    return this.mensajeria.vista();
  }

  /**
   * Reanuda tras recargar. `presupuesto` son los segmentos recién comprados; al
   * indicarlo se reinicia el contador, porque lo gastado pertenece a la recarga
   * anterior y arrastrarlo volvería a apagar el interruptor al instante.
   */
  @Post('mensajeria/reanudar')
  @HttpCode(200)
  async reanudarMensajeria(@Body() dto: ReanudarMensajeriaDto) {
    await this.mensajeria.reanudar(dto.presupuesto);
    return this.mensajeria.vista();
  }

  @Get('suscripciones')
  listar() {
    return this.plataforma.listarSuscripciones();
  }

  /** Dispara el ciclo de cobro recurrente manualmente (operador/dev, FASE-06). */
  @Post('cron/cobros')
  @HttpCode(200)
  ejecutarCron() {
    return this.cobroCron.ejecutarCiclo();
  }

  @Get('negocios/:id')
  detalle(@Param('id') id: string) {
    return this.plataforma.detalleNegocio(id);
  }

  @Post('negocios/:id/cobro')
  @HttpCode(201)
  generarCobro(@Param('id') id: string) {
    return this.facturacion.generarCobro(id);
  }

  @Post('negocios/:id/suspender')
  @HttpCode(204)
  async suspender(@Param('id') id: string): Promise<void> {
    await this.plataforma.suspender(id);
  }

  @Post('negocios/:id/reactivar')
  @HttpCode(204)
  async reactivar(@Param('id') id: string): Promise<void> {
    await this.plataforma.reactivar(id);
  }

  /** Cortesía: beneficios de un plan SIN cobro (pruebas, FASE-10). */
  @Post('negocios/:id/cortesia')
  @HttpCode(204)
  async darCortesia(@Param('id') id: string, @Body() dto: CortesiaDto): Promise<void> {
    await this.plataforma.darCortesia(id, dto);
  }

  @Post('negocios/:id/cortesia/quitar')
  @HttpCode(204)
  async quitarCortesia(@Param('id') id: string): Promise<void> {
    await this.plataforma.quitarCortesia(id);
  }
}
