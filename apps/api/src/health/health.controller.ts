import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from '../auth/decorators/public.decorator';
import { db } from '../db/client';

/**
 * Healthcheck (FASE-01/14). `/health` = liveness; `/health/ready` = readiness
 * (verifica la BD). Railway usa estos endpoints para monitorear. Públicos.
 */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: string; service: string; timestamp: string } {
    return { status: 'ok', service: 'orkalis-api', timestamp: new Date().toISOString() };
  }

  /** Readiness: la app puede atender (BD accesible). */
  @Public()
  @Get('ready')
  async ready(): Promise<{ status: string; db: string }> {
    try {
      await db.execute(sql`SELECT 1`);
      return { status: 'ok', db: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'degraded', db: 'down' });
    }
  }
}
