import { randomUUID } from 'node:crypto';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * Interceptor de observabilidad (FASE-14): asigna un request-id de correlación,
 * mide la latencia por ruta (para p95) y loguea cada petición de forma
 * estructurada. No registra cuerpos ni cabeceras sensibles.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
    res.setHeader('x-request-id', requestId);

    const inicio = Date.now();
    // Ruta "plantilla" (sin ids) para agrupar latencias.
    const ruta = `${req.method} ${(req.route?.path as string) ?? req.path}`;

    return next.handle().pipe(
      tap({
        next: () => this.registrar(ruta, inicio, res.statusCode, requestId),
        error: () => this.registrar(ruta, inicio, res.statusCode || 500, requestId),
      }),
    );
  }

  private registrar(ruta: string, inicio: number, status: number, requestId: string) {
    const ms = Date.now() - inicio;
    this.metrics.observarLatencia(ruta, ms);
    this.logger.log(`${ruta} ${status} ${ms}ms reqId=${requestId}`);
  }
}
