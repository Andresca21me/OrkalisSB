import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { MetricsService } from './metrics.service';

/** Métricas para monitoreo (FASE-14). Público para que el scraper las consulte. */
@Public()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  snapshot() {
    return this.metrics.snapshot();
  }
}
