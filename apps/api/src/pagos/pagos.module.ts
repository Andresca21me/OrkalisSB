import { Module } from '@nestjs/common';
import { MercadoPagoClient } from './mercadopago.client';
import { FacturacionService } from './facturacion.service';
import { PlataformaService } from './plataforma.service';
import { SuscripcionEstadoService } from './suscripcion-estado.service';
import { PagoSuscripcionService } from './pago-suscripcion.service';
import { CobroCronService } from './cobro-cron.service';
import {
  MercadoPagoWebhookController,
  PlataformaController,
} from './pagos.controllers';
import { PagoSuscripcionController } from './pago-suscripcion.controller';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

/** Suscripción y pasarela de pagos con Mercado Pago (ADR-009, Plan-Pagos). */
@Module({
  // Por el interruptor de mensajería: se gobierna desde la consola de
  // plataforma porque el crédito del proveedor es de la plataforma, no de un
  // negocio.
  imports: [NotificacionesModule],
  controllers: [MercadoPagoWebhookController, PlataformaController, PagoSuscripcionController],
  providers: [
    MercadoPagoClient,
    FacturacionService,
    PlataformaService,
    SuscripcionEstadoService,
    PagoSuscripcionService,
    CobroCronService,
  ],
  exports: [FacturacionService, SuscripcionEstadoService],
})
export class PagosModule {}
