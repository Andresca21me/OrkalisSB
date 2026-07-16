import { ConsoleLogger, type LoggerService } from '@nestjs/common';

/**
 * Logger estructurado (FASE-14, RNF-019). En producción emite JSON por línea
 * (apto para agregadores como los de Railway); en desarrollo usa el formato
 * legible de Nest. NUNCA loguear secretos, contraseñas ni códigos OTP.
 */
export class JsonLogger extends ConsoleLogger implements LoggerService {
  private readonly json = process.env.NODE_ENV === 'production';

  private emitir(level: string, message: unknown, context?: string) {
    if (!this.json) {
      // Delegar al formato legible de Nest en desarrollo.
      return;
    }
    process.stdout.write(
      JSON.stringify({
        ts: new Date().toISOString(),
        level,
        context: context ?? this.context,
        msg: typeof message === 'string' ? message : JSON.stringify(message),
      }) + '\n',
    );
  }

  log(message: unknown, context?: string) {
    if (this.json) return this.emitir('info', message, context);
    super.log(message as string, context as string);
  }
  error(message: unknown, stack?: string, context?: string) {
    if (this.json) {
      process.stdout.write(
        JSON.stringify({ ts: new Date().toISOString(), level: 'error', context: context ?? this.context, msg: String(message), stack }) + '\n',
      );
      return;
    }
    super.error(message as string, stack as string, context as string);
  }
  warn(message: unknown, context?: string) {
    if (this.json) return this.emitir('warn', message, context);
    super.warn(message as string, context as string);
  }
  debug(message: unknown, context?: string) {
    if (this.json) return this.emitir('debug', message, context);
    super.debug?.(message as string, context as string);
  }
}
