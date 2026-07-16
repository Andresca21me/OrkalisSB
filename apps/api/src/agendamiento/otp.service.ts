import { randomInt } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, desc, eq } from 'drizzle-orm';
import type { DrizzleTx } from '../db/tx';
import { otpCodigo } from '../db/schema';

const TTL_MIN = 5;
const MAX_INTENTOS = 5;

/**
 * OTP por SMS para identificar al cliente final sin cuenta (FASE-08, ADR-003).
 * El envío real (Twilio) es FASE-11; en desarrollo se loguea y se retorna el
 * código para poder probar el flujo (NUNCA en producción).
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger('OTP');

  /** Genera y persiste (hasheado) un OTP. Devuelve el código en claro (dev). */
  async generar(tx: DrizzleTx, negocioId: string, telefono: string): Promise<string> {
    const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codigoHash = await argon2.hash(codigo);
    await tx.insert(otpCodigo).values({
      negocioId,
      telefono,
      codigoHash,
      expiraEn: new Date(Date.now() + TTL_MIN * 60_000),
    });
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`OTP para ${telefono}: ${codigo} (dev)`);
    }
    return codigo;
  }

  /** Verifica el OTP más reciente del teléfono. Lanza si inválido/expirado. */
  async verificar(tx: DrizzleTx, negocioId: string, telefono: string, codigo: string): Promise<void> {
    const [otp] = await tx
      .select()
      .from(otpCodigo)
      .where(and(eq(otpCodigo.negocioId, negocioId), eq(otpCodigo.telefono, telefono), eq(otpCodigo.consumido, false)))
      .orderBy(desc(otpCodigo.creadoEn))
      .limit(1);

    if (!otp) throw new BadRequestException('No hay un código vigente; solicita uno nuevo.');
    if (otp.expiraEn.getTime() < Date.now()) {
      throw new BadRequestException('El código expiró; solicita uno nuevo.');
    }
    if (otp.intentos >= MAX_INTENTOS) {
      throw new BadRequestException('Demasiados intentos; solicita un código nuevo.');
    }

    const ok = await argon2.verify(otp.codigoHash, codigo);
    if (!ok) {
      await tx.update(otpCodigo).set({ intentos: otp.intentos + 1 }).where(eq(otpCodigo.id, otp.id));
      throw new BadRequestException('Código incorrecto.');
    }
    await tx.update(otpCodigo).set({ consumido: true }).where(eq(otpCodigo.id, otp.id));
  }
}
