import { Injectable } from '@nestjs/common';

/**
 * Métricas en memoria de operaciones críticas (FASE-14, RNF-019).
 * Contadores de negocio + latencias p95 por ruta. Se exponen en `/api/metrics`.
 * (En producción puede sustituirse por un exportador Prometheus sin tocar los
 * sitios que incrementan.)
 */
@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly latencias = new Map<string, number[]>();
  private readonly MAX_MUESTRAS = 500;

  inc(metrica: string, n = 1): void {
    this.counters.set(metrica, (this.counters.get(metrica) ?? 0) + n);
  }

  /**
   * Incrementa una métrica y su desglose por etiqueta (`metrica_etiqueta`).
   * Usado por el outbox para contar mensajes por canal (FASE-02).
   */
  incPor(metrica: string, etiqueta: string, n = 1): void {
    this.inc(metrica, n);
    this.inc(`${metrica}_${etiqueta}`, n);
  }

  observarLatencia(ruta: string, ms: number): void {
    const arr = this.latencias.get(ruta) ?? [];
    arr.push(ms);
    if (arr.length > this.MAX_MUESTRAS) arr.shift();
    this.latencias.set(ruta, arr);
  }

  private percentil(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const ordenado = [...arr].sort((a, b) => a - b);
    const idx = Math.min(ordenado.length - 1, Math.ceil((p / 100) * ordenado.length) - 1);
    return Math.round(ordenado[idx]);
  }

  /** Instantánea de métricas (contadores + p95 por ruta clave). */
  snapshot(): {
    contadores: Record<string, number>;
    latenciasP95Ms: Record<string, number>;
    uptimeSegundos: number;
  } {
    const latenciasP95Ms: Record<string, number> = {};
    for (const [ruta, muestras] of this.latencias) {
      latenciasP95Ms[ruta] = this.percentil(muestras, 95);
    }
    return {
      contadores: Object.fromEntries(this.counters),
      latenciasP95Ms,
      uptimeSegundos: Math.round(process.uptime()),
    };
  }
}

/** Nombres canónicos de las métricas de negocio. */
export const METRICAS = {
  reservasCreadas: 'reservas_creadas',
  turnosCompletados: 'turnos_completados',
  turnosRevertidos: 'turnos_revertidos',
  exclusionViolaciones: 'concurrencia_exclusion_violaciones',
  notificacionesEnviadas: 'notificaciones_enviadas',
  loginExitosos: 'login_exitosos',
  // Outbox de mensajería (FASE-02) — se desglosan por canal con `incPor`.
  mensajesEncolados: 'mensajes_encolados',
  mensajesEnviados: 'mensajes_enviados',
  mensajesEntregados: 'mensajes_entregados',
  mensajesFallidos: 'mensajes_fallidos',
  mensajesSinCupo: 'mensajes_sin_cupo',
  mensajesReintentados: 'mensajes_reintentados',
  /** WhatsApp falló y el mensaje se reenvió por SMS (fallback de canal). */
  mensajesDegradados: 'mensajes_degradados',
} as const;
