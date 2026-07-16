import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';

const API_BASE = 'https://api.mercadopago.com';

/** Estado de un pago de Mercado Pago que consideramos "exitoso". */
export const PAGO_APROBADO = 'approved';

/** Resultado de un pago (forma relevante de `POST/GET /v1/payments`). */
export interface PagoMP {
  id: string;
  status: string; // approved | rejected | in_process | pending | cancelled
  statusDetail?: string;
  externalReference?: string;
  /** Id de la tarjeta que MP guarda al pagar con un Customer (para la recurrencia). */
  cardId?: string;
  /** Últimos 4 dígitos de la tarjeta usada. */
  ultimos4?: string;
}

/** Tarjeta guardada (forma relevante de `POST /v1/customers/:id/cards`). */
export interface TarjetaMP {
  id: string;
  ultimos4: string;
}

/** Datos para verificar la firma `x-signature` de un webhook. */
export interface FirmaWebhook {
  xSignature?: string; // "ts=...,v1=..."
  xRequestId?: string;
  dataId?: string | number;
}

/** Notificación de webhook de Mercado Pago (forma relevante). */
export interface NotificacionMP {
  type?: string; // "payment"
  action?: string; // "payment.created" | "payment.updated"
  data?: { id?: string | number };
}

/**
 * Cliente de Mercado Pago (Plan-Pagos FASE-02). Reemplaza al antiguo cliente de
 * Wompi. La URL del API es la MISMA en prueba y producción (`api.mercadopago.com`):
 * lo que cambia el ambiente es el `MP_ACCESS_TOKEN` (TEST-… vs APP_USR-…).
 *
 * Sin `MP_ACCESS_TOKEN` opera en modo INACTIVO: no llama a la API real (devuelve
 * respuestas simuladas claramente marcadas) para no bloquear el desarrollo. La
 * verificación de firma del webhook funciona si hay `MP_WEBHOOK_SECRET`.
 *
 * No existen "acceptance token" ni "payment source" (eran de Wompi); el método
 * de pago recurrente se guarda como **Customer + Card** y se cobra con
 * `POST /v1/payments` (transacción iniciada por el comercio).
 */
@Injectable()
export class MercadoPagoClient {
  private readonly logger = new Logger('MercadoPago');
  private readonly accessToken?: string;
  private readonly webhookSecret?: string;
  private readonly env: string;

  constructor(config: ConfigService<Env, true>) {
    this.accessToken = config.get('MP_ACCESS_TOKEN', { infer: true });
    this.webhookSecret = config.get('MP_WEBHOOK_SECRET', { infer: true });
    this.env = config.get('MP_ENV', { infer: true });
  }

  /** Hay credenciales para operar contra la API real. */
  get configurado(): boolean {
    return Boolean(this.accessToken);
  }

  // ── Método de pago (Customer + Card) ───────────────────────────────────────

  /** Crea (o reutiliza por email) un Customer y devuelve su id. */
  async crearCustomer(email: string): Promise<string> {
    if (!this.configurado) return `mp-inactivo-customer-${encodeURIComponent(email)}`;
    try {
      const r = await this.post<{ id: string }>('/v1/customers', { email });
      return r.id;
    } catch (e) {
      // Si ya existe un customer con ese email, lo buscamos y reutilizamos.
      const existente = await this.buscarCustomerPorEmail(email);
      if (existente) return existente;
      throw e;
    }
  }

  /** Guarda la tarjeta tokenizada en el front bajo el Customer. */
  async guardarTarjeta(customerId: string, cardToken: string): Promise<TarjetaMP> {
    if (!this.configurado) {
      return { id: `mp-inactivo-card-${cardToken.slice(-6)}`, ultimos4: '0000' };
    }
    const r = await this.post<{ id: string; last_four_digits: string }>(
      `/v1/customers/${customerId}/cards`,
      { token: cardToken },
    );
    return { id: r.id, ultimos4: r.last_four_digits };
  }

  /**
   * Genera un token de un solo uso desde una tarjeta guardada, necesario para
   * cada cobro recurrente (transacción iniciada por el comercio).
   */
  async tokenizarTarjetaGuardada(cardId: string): Promise<string> {
    if (!this.configurado) return `mp-inactivo-tok-${cardId.slice(-6)}`;
    const r = await this.post<{ id: string }>('/v1/card_tokens', { card_id: cardId });
    return r.id;
  }

  // ── Cobro ───────────────────────────────────────────────────────────────────

  /**
   * Crea un pago contra una tarjeta (token). Idempotente por `referencia`
   * (cabecera `X-Idempotency-Key`). El monto va en UNIDADES (COP), no centavos.
   */
  async crearPago(params: {
    token: string;
    montoCOP: number;
    referencia: string;
    payerEmail: string;
    customerId?: string;
    descripcion?: string;
    paymentMethodId?: string;
  }): Promise<PagoMP> {
    if (!this.configurado) {
      this.logger.warn(`Mercado Pago inactivo: pago simulado para ${params.referencia}.`);
      return { id: `mp-inactivo-pay-${params.referencia}`, status: 'in_process' };
    }
    const body: Record<string, unknown> = {
      transaction_amount: params.montoCOP,
      token: params.token,
      installments: 1,
      description: params.descripcion ?? 'Suscripción Orkalis',
      external_reference: params.referencia,
      payer: {
        ...(params.customerId ? { type: 'customer', id: params.customerId } : {}),
        email: params.payerEmail,
      },
    };
    if (params.paymentMethodId) body.payment_method_id = params.paymentMethodId;
    const r = await this.post<RawPago>('/v1/payments', body, {
      'X-Idempotency-Key': params.referencia,
    });
    return this.mapPago(r);
  }

  /** Consulta un pago por id (para confirmar estado si el webhook tarda). */
  async consultarPago(id: string): Promise<PagoMP> {
    if (!this.configurado) return { id, status: 'in_process' };
    const r = await this.get<RawPago>(`/v1/payments/${id}`);
    return this.mapPago(r);
  }

  // ── Webhook ───────────────────────────────────────────────────────────────────

  /**
   * Verifica la firma `x-signature` de un webhook (HMAC-SHA256 con
   * `MP_WEBHOOK_SECRET` sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`).
   */
  verificarFirma({ xSignature, xRequestId, dataId }: FirmaWebhook): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('MP_WEBHOOK_SECRET ausente: no se puede verificar la firma.');
      return false;
    }
    if (!xSignature) return false;
    const { ts, v1 } = this.parseSignature(xSignature);
    if (!ts || !v1) return false;

    const id = dataId === undefined || dataId === null ? '' : String(dataId).toLowerCase();
    const manifest = `id:${id};request-id:${xRequestId ?? ''};ts:${ts};`;
    const esperado = createHmac('sha256', this.webhookSecret).update(manifest).digest('hex');
    return this.igualSeguro(esperado, v1);
  }

  // ── Internos ────────────────────────────────────────────────────────────────

  private mapPago(r: RawPago): PagoMP {
    return {
      id: String(r.id),
      status: r.status,
      statusDetail: r.status_detail,
      externalReference: r.external_reference ?? undefined,
      cardId: r.card?.id != null ? String(r.card.id) : undefined,
      ultimos4: r.card?.last_four_digits ?? undefined,
    };
  }

  private parseSignature(header: string): { ts?: string; v1?: string } {
    const out: { ts?: string; v1?: string } = {};
    for (const parte of header.split(',')) {
      const [k, v] = parte.split('=').map((s) => s.trim());
      if (k === 'ts') out.ts = v;
      else if (k === 'v1') out.v1 = v;
    }
    return out;
  }

  private igualSeguro(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }

  private async buscarCustomerPorEmail(email: string): Promise<string | null> {
    try {
      const r = await this.get<{ results?: { id: string }[] }>(
        `/v1/customers/search?email=${encodeURIComponent(email)}`,
      );
      return r.results?.[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  private async post<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
    return this.request<T>('POST', path, body, headers);
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const texto = await res.text();
    const json = texto ? JSON.parse(texto) : {};
    if (!res.ok) {
      this.logger.error(`MP ${method} ${path} → ${res.status}: ${texto}`);
      throw new Error(`Mercado Pago ${res.status}: ${(json as { message?: string }).message ?? texto}`);
    }
    return json as T;
  }
}

/** Forma cruda del pago que devuelve la API. */
interface RawPago {
  id: string | number;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  card?: { id?: string | number; last_four_digits?: string };
}
