import { config as loadEnv } from 'dotenv';
loadEnv();

import { sql } from 'drizzle-orm';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { esErrorDeSaldo, esErrorDeWhatsapp, MensajeriaEstadoService } from './mensajeria-estado.service';

/**
 * Interruptor de saldo de la mensajería.
 *
 * Lo que se protege aquí es que la plataforma **no se quede inservible** cuando
 * se acaba el crédito del proveedor: el corte tiene que llegar solo, no debe
 * dejar de contar por el camino, y reanudar tiene que dejar el contador listo
 * para la recarga nueva.
 */
describe('Interruptor de mensajería (saldo de plataforma)', () => {
  const estado = new MensajeriaEstadoService();

  /** Deja la fila única en un punto de partida conocido. */
  async function sembrar(presupuesto: number, consumidos = 0, activa = true): Promise<void> {
    await adminDb.execute(sql`
      INSERT INTO "mensajeria_saldo" ("id", "activa", "presupuesto", "consumidos", "motivo", "pausada_en")
      VALUES (1, ${activa}, ${presupuesto}, ${consumidos}, NULL, NULL)
      ON CONFLICT ("id") DO UPDATE
      SET "activa" = ${activa}, "presupuesto" = ${presupuesto}, "consumidos" = ${consumidos},
          "motivo" = NULL, "pausada_en" = NULL
    `);
    await estado.refrescar();
  }

  afterAll(async () => {
    // Se deja encendida y sin tope: es el estado neutro para el resto de suites.
    await sembrar(0, 0, true);
    await adminClient.end();
    await client.end();
  });

  it('arranca operativa y deja pasar los envíos', async () => {
    await sembrar(0);
    expect(estado.pausada()).toBe(false);
    expect(estado.vista().restantes).toBeNull(); // sin tope declarado
  });

  it('descuenta segmentos, no mensajes', async () => {
    await sembrar(100);
    await estado.registrarEnvio(3); // un SMS largo son varios segmentos
    expect(estado.vista().consumidos).toBe(3);
    expect(estado.vista().restantes).toBe(97);
  });

  it('se apaga sola al agotarse el presupuesto', async () => {
    await sembrar(10, 8);
    await estado.registrarEnvio(1);
    expect(estado.pausada()).toBe(false); // 9 de 10: aún queda

    await estado.registrarEnvio(1);
    expect(estado.pausada()).toBe(true);
    expect(estado.vista().motivo).toMatch(/se agotaron/i);
    expect(estado.vista().pausadaEn).toBeInstanceOf(Date);
  });

  it('un envío que se pasa del tope también corta (no hace falta caer justo)', async () => {
    await sembrar(10, 8);
    await estado.registrarEnvio(5); // 13 > 10
    expect(estado.pausada()).toBe(true);
    expect(estado.vista().consumidos).toBe(13); // se contabiliza lo gastado de verdad
  });

  it('sin presupuesto declarado nunca se apaga sola', async () => {
    await sembrar(0);
    await estado.registrarEnvio(5_000);
    expect(estado.pausada()).toBe(false);
  });

  it('pausar a mano conserva el motivo original si ya estaba pausada', async () => {
    await sembrar(0);
    await estado.pausar('Primer motivo');
    await estado.pausar('Segundo motivo');
    expect(estado.vista().motivo).toBe('Primer motivo');
  });

  it('reanudar con presupuesto nuevo reinicia el contador', async () => {
    // Si no se reiniciara, los 300 ya gastados dejarían el interruptor apagado
    // otra vez en el primer envío tras la recarga.
    await sembrar(300, 300, false);
    await estado.reanudar(500);
    expect(estado.pausada()).toBe(false);
    expect(estado.vista().consumidos).toBe(0);
    expect(estado.vista().presupuesto).toBe(500);
    expect(estado.vista().motivo).toBeNull();
  });

  it('reanudar sin indicar presupuesto conserva contador y tope', async () => {
    await sembrar(300, 120, false);
    await estado.reanudar();
    expect(estado.pausada()).toBe(false);
    expect(estado.vista().consumidos).toBe(120);
    expect(estado.vista().presupuesto).toBe(300);
  });

  it('el estado sobrevive al reinicio del proceso (vive en base, no en memoria)', async () => {
    await sembrar(50, 50, false);
    const otraInstancia = new MensajeriaEstadoService();
    await otraInstancia.refrescar();
    expect(otraInstancia.pausada()).toBe(true);
  });
});

describe('esErrorDeSaldo', () => {
  it('reconoce los rechazos de Twilio por dinero', () => {
    expect(esErrorDeSaldo({ code: 20003 })).toBe(true); // cuenta suspendida
    expect(esErrorDeSaldo({ code: 30002 })).toBe(true);
    expect(esErrorDeSaldo({ status: 402 })).toBe(true);
    expect(esErrorDeSaldo(new Error('Account is suspended'))).toBe(true);
    expect(esErrorDeSaldo(new Error('insufficient funds to send message'))).toBe(true);
  });

  it('NO confunde un fallo corriente con falta de saldo', () => {
    // Apagar la mensajería por un número mal escrito dejaría a toda la
    // plataforma sin mensajes por culpa de un solo cliente.
    expect(esErrorDeSaldo({ code: 21211, message: "The 'To' number is not a valid phone number." })).toBe(false);
    expect(esErrorDeSaldo(new Error('ETIMEDOUT'))).toBe(false);
    expect(esErrorDeSaldo({ status: 500 })).toBe(false);
    expect(esErrorDeSaldo(undefined)).toBe(false);
  });
});

describe('esErrorDeWhatsapp', () => {
  it('reconoce los fallos propios del canal WhatsApp (63xxx y afines)', () => {
    expect(esErrorDeWhatsapp({ code: 63016 })).toBe(true); // fuera de ventana 24h
    expect(esErrorDeWhatsapp({ code: 63024 })).toBe(true);
    expect(esErrorDeWhatsapp({ code: '63003' })).toBe(true); // Twilio a veces lo da como string
    expect(esErrorDeWhatsapp({ code: 21910 })).toBe(true); // par From/To de canales distintos
    expect(esErrorDeWhatsapp({ code: 21655 })).toBe(true); // ContentSid inválido
  });

  it('NO clasifica como WhatsApp los errores de saldo, red o número inválido', () => {
    // Degradar a SMS por un error de saldo escondería que la cuenta está seca;
    // degradarlo por un timeout perdería el reintento por el mismo canal.
    expect(esErrorDeWhatsapp({ code: 30002 })).toBe(false);
    expect(esErrorDeWhatsapp({ code: 21211 })).toBe(false);
    expect(esErrorDeWhatsapp(new Error('ETIMEDOUT'))).toBe(false);
    expect(esErrorDeWhatsapp({ status: 500 })).toBe(false);
    expect(esErrorDeWhatsapp(undefined)).toBe(false);
  });
});
