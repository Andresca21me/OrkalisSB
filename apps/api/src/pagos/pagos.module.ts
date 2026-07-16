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

/** Suscripción y pasarela de pagos con Mercado Pago (ADR-009, Plan-Pagos). */
@Module({
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
