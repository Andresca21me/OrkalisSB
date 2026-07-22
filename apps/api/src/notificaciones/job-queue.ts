import { Injectable, Logger } from '@nestjs/common';

type JobHandler = (payload: unknown) => Promise<void>;

/**
 * Cola en proceso (FASE-11) — abstracción simple, NO bloqueante: `enqueue`
 * retorna de inmediato y el handler corre fuera del hilo de la petición
 * (microtask). `drain()` permite a las pruebas esperar el procesamiento.
 *
 * **Ya NO la usa la mensajería** (Plan-Mensajeria FASE-02): esa pasó al outbox
 * durable (`mensaje` + `OutboxWorker`), porque un reinicio perdía los mensajes
 * en vuelo. Aquí quedan los jobs no-mensajería (`exportacion-pesada`), donde
 * perder el trabajo al reiniciar es aceptable.
 */
@Injectable()
export class JobQueue {
  private readonly logger = new Logger('JobQueue');
  private readonly handlers = new Map<string, JobHandler>();
  private pendientes: Promise<unknown>[] = [];

  registrar(nombre: string, handler: JobHandler): void {
    this.handlers.set(nombre, handler);
  }

  enqueue(nombre: string, payload: unknown): void {
    const handler = this.handlers.get(nombre);
    if (!handler) {
      this.logger.warn(`Sin handler para el job '${nombre}'.`);
      return;
    }
    const p = Promise.resolve()
      .then(() => handler(payload))
      .catch((err) => this.logger.error(`Job '${nombre}' falló: ${(err as Error).message}`));
    this.pendientes.push(p);
  }

  /** Espera a que se procesen los jobs encolados (uso en pruebas). */
  async drain(): Promise<void> {
    const actuales = this.pendientes;
    this.pendientes = [];
    await Promise.allSettled(actuales);
  }
}
