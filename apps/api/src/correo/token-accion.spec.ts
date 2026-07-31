import { config as loadEnv } from 'dotenv';
loadEnv();

import { createHash } from 'node:crypto';
import { eq, like } from 'drizzle-orm';
import { HttpException } from '@nestjs/common';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { tokenAccion } from '../db/schema';
import { TokenAccionService } from './token-accion.service';

/**
 * Tokens de acción de un solo uso (Plan-Correo E1, D3). Prueban las garantías
 * que sostienen los cuatro flujos: el token en claro nunca toca la base, el
 * gasto es atómico y un destino nunca tiene dos enlaces válidos a la vez.
 */
describe('TokenAccionService (Plan-Correo E1)', () => {
  const servicio = new TokenAccionService();
  let n = 0;
  const email = () => `token-spec-${++n}@orkalis-test.local`;

  afterAll(async () => {
    await adminDb.delete(tokenAccion).where(like(tokenAccion.email, '%@orkalis-test.local'));
    await adminClient.end();
    await client.end();
  });

  it('el token en claro NUNCA se persiste: la fila guarda su SHA-256', async () => {
    const { id, token } = await servicio.crear({ tipo: 'reset_password', email: email() });
    const [fila] = await adminDb.select().from(tokenAccion).where(eq(tokenAccion.id, id));
    expect(fila.tokenHash).not.toBe(token);
    expect(fila.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(fila.expiraEn.getTime()).toBeGreaterThan(Date.now());
  });

  it('crear invalida el enlace vigente anterior del mismo (tipo, email)', async () => {
    const destino = email();
    const primero = await servicio.crear({ tipo: 'reset_password', email: destino });
    const segundo = await servicio.crear({ tipo: 'reset_password', email: destino });

    expect(await servicio.validar('reset_password', primero.token)).toBeNull();
    expect(await servicio.validar('reset_password', segundo.token)).not.toBeNull();
  });

  it('usar es atómico y de un solo uso: el segundo clic no encuentra nada', async () => {
    const { token } = await servicio.crear({ tipo: 'alta_email', email: email(), payload: { nombre: 'Ana' } });
    const primera = await servicio.usar('alta_email', token);
    const segunda = await servicio.usar('alta_email', token);

    expect(primera?.usadoEn).toBeInstanceOf(Date);
    expect(primera?.payload).toEqual({ nombre: 'Ana' });
    expect(segunda).toBeNull();
  });

  it('un token vencido no se puede usar ni validar', async () => {
    const { id, token } = await servicio.crear({ tipo: 'reset_password', email: email() });
    await adminDb.update(tokenAccion).set({ expiraEn: new Date(Date.now() - 1000) }).where(eq(tokenAccion.id, id));

    expect(await servicio.validar('reset_password', token)).toBeNull();
    expect(await servicio.usar('reset_password', token)).toBeNull();
  });

  it('usar exige el tipo correcto: un enlace de reset no verifica un alta', async () => {
    const { token } = await servicio.crear({ tipo: 'reset_password', email: email() });
    expect(await servicio.usar('alta_email', token)).toBeNull();
  });

  it('validar no gasta el token', async () => {
    const { token } = await servicio.crear({ tipo: 'cambio_email', email: email() });
    expect(await servicio.validar('cambio_email', token)).not.toBeNull();
    expect(await servicio.usar('cambio_email', token)).not.toBeNull();
  });

  it('regenerar respeta el cooldown de 60 s (429 recién creado)', async () => {
    const { id } = await servicio.crear({ tipo: 'alta_email', email: email() });
    await expect(servicio.regenerar(id)).rejects.toMatchObject({ status: 429 });
  });

  it('regenerar emite un token nuevo y mata el anterior', async () => {
    const { id, token } = await servicio.crear({ tipo: 'alta_email', email: email() });
    await adminDb.update(tokenAccion).set({ ultimoEnvio: new Date(Date.now() - 61_000) }).where(eq(tokenAccion.id, id));

    const { token: nuevo, fila } = await servicio.regenerar(id);
    expect(nuevo).not.toBe(token);
    expect(fila.reenvios).toBe(1);
    expect(await servicio.validar('alta_email', token)).toBeNull();
    expect(await servicio.validar('alta_email', nuevo)).not.toBeNull();
  });

  it('regenerar se niega tras el tope de reenvíos o con el token ya usado', async () => {
    const destino = email();
    const { id, token } = await servicio.crear({ tipo: 'alta_email', email: destino });
    await adminDb.update(tokenAccion).set({ reenvios: 5, ultimoEnvio: new Date(0) }).where(eq(tokenAccion.id, id));
    await expect(servicio.regenerar(id)).rejects.toBeInstanceOf(HttpException);

    const otro = await servicio.crear({ tipo: 'alta_email', email: destino });
    await servicio.usar('alta_email', otro.token);
    await expect(servicio.regenerar(otro.id)).rejects.toMatchObject({ status: 400 });
    expect(token).toBeDefined();
  });

  it('consumir es de un solo uso: un enlace verificado no ejecuta la acción dos veces', async () => {
    const { id, token } = await servicio.crear({ tipo: 'alta_email', email: email() });
    await servicio.usar('alta_email', token);

    expect(await servicio.consumir(id)).not.toBeNull();
    expect(await servicio.consumir(id)).toBeNull();
  });
});
