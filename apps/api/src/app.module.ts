import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health/health.controller';
import { validateEnv } from './config/env.validation';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { ConfigurabilidadModule } from './config-module/config.module';
import { PlanModule } from './plans/plan.module';
import { NegocioModule } from './negocio/negocio.module';
import { AgendamientoModule } from './agendamiento/agendamiento.module';
import { FinanzasModule } from './finanzas/finanzas.module';
import { OperacionModule } from './operacion/operacion.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { CorreoModule } from './correo/correo.module';
import { PagosModule } from './pagos/pagos.module';
import { ObservabilityModule } from './observability/observability.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { SuscripcionAccesoGuard } from './auth/guards/suscripcion-acceso.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ObservabilityModule,
    // Rate limiting (RNF-011): protege sobre todo los endpoints públicos.
    // Límite/ventana configurables por env (default 120 req/min/IP) para poder
    // subir el techo donde varios usuarios comparten IP o en pruebas E2E.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => [
        {
          ttl: cfg.get<number>('THROTTLE_TTL_MS', 60_000),
          limit: cfg.get<number>('THROTTLE_LIMIT', 120),
        },
      ],
    }),
    DbModule,
    AuthModule,
    ConfigurabilidadModule,
    PlanModule,
    NegocioModule,
    FinanzasModule,
    NotificacionesModule,
    CorreoModule,
    AgendamientoModule,
    OperacionModule,
    PagosModule,
  ],
  controllers: [HealthController],
  providers: [
    // Rate limiting global.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Guards globales (FASE-05): autenticación + RBAC por rol. Endpoints
    // públicos se marcan con @Public(); roles con @Roles(...).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Bloqueo por estado de suscripción (FASE-11). Va al final: lee el
    // tenantContext que pone JwtAuthGuard; exime los endpoints @AccesoFacturacion().
    { provide: APP_GUARD, useClass: SuscripcionAccesoGuard },
  ],
})
export class AppModule {}
