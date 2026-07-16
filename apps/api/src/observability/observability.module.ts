import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { LoggingInterceptor } from './logging.interceptor';

/** Observabilidad (FASE-14, RNF-019): métricas, latencias y logging. Global. */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }],
  exports: [MetricsService],
})
export class ObservabilityModule {}
