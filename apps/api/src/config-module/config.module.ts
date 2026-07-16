import { Global, Module } from '@nestjs/common';
import { ConfigResolverService } from './config-resolver.service';
import { ConfigWriteService } from './config-write.service';
import { ConfigController } from './config.controller';

/**
 * Módulo de configurabilidad (FASE-06, ADR-002). Global: el `ConfigResolver`
 * lo consumen agendamiento, finanzas, notificaciones y reportes.
 */
@Global()
@Module({
  controllers: [ConfigController],
  providers: [ConfigResolverService, ConfigWriteService],
  exports: [ConfigResolverService, ConfigWriteService],
})
export class ConfigurabilidadModule {}
