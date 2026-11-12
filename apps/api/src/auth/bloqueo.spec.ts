import { config as loadEnv } from 'dotenv';
loadEnv();

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { and, desc, eq, like } from 'drizzle-orm';
import request from 'supertest';
import { PerfilNegocio, RolUsuario } from '@orkalis/shared';
import { AppModule } from '../app.module';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { mensaje, negocio, usuario } from '../db/schema';

/**
 * FASE-02 del piloto (ORK-67): bloqueo de la cuenta por intentos fallidos de
 * login. 5 contraseñas malas seguidas → 15 min bloqueada (429), aunque luego
 * llegue la correcta. Un login correcto o un restablecimiento reinicia el
 * contador. Los correos inexistentes nunca se "bloquean" (siempre 401).
 */
describe('Bloqueo de login por intentos fallidos (FASE-02 piloto)', () => {
  let app: INestApplication;
  const NEGOCIO = `E2E-BLOQUEO-${Date.now()}`;
  const PASSWORD = 'ClaveBuena123';
  let negocioId: string;

  const http = () => request(app.getHttpServer());
  const login = (email: string, password: string) => http().post('/api/auth/login').send({ email, password });

  /** Usuario de prueba nuevo (no se toca el admin del seed). */
  async function crearUsuario(sufijo: string): Promise<string> {
    const email = `bloqueo.${sufijo}.${Date.now()}@e2e.test`;
    await adminDb.insert(usuario).values({
      negocioId,
      nombre: 'Prueba Bloqueo',
      email,
      passwordHash: await argon2.hash(PASSWORD),
      rol: RolUsuario.Admin,
    });
    return email;
  }

  async function estado(email: string) {
    const [u] = await adminDb
      .select({ intentos: usuario.intentosFallidos, hasta: usuario.bloqueadoHasta })
      .from(usuario)
      .where(eq(usuario.email, email));
    return u;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    const [neg] = await adminDb.insert(negocio).values({ nombre: NEGOCIO, perfil: PerfilNegocio.Barberia }).returning();
    negocioId = neg.id;
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NEGOCIO));
    await adminDb.delete(mensaje).where(like(mensaje.destino, 'bloqueo.%@e2e.test'));
    await app.close();
    await adminClient.end();
    await client.end();
  });

  it('5 contraseñas malas bloquean: la 5.ª ya avisa (429) y luego ni la correcta entra', async () => {
    const email = await crearUsuario('a');
    for (let i = 0; i < 4; i++) expect((await login(email, 'mala-' + i)).status).toBe(401);
    const quinta = await login(email, 'mala-4');
    expect(quinta.status).toBe(429);
    const res = await login(email, PASSWORD);
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/Demasiados intentos/);
    const e = await estado(email);
    expect(e.hasta!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
  });

  it('pasado el bloqueo, la contraseña correcta entra y el contador vuelve a 0', async () => {
    const email = await crearUsuario('b');
    for (let i = 0; i < 5; i++) await login(email, 'mala');
    // Simula que pasaron los 15 minutos.
    await adminDb.update(usuario).set({ bloqueadoHasta: new Date(Date.now() - 1000) }).where(eq(usuario.email, email));
    expect((await login(email, PASSWORD)).status).toBe(200);
    expect(await estado(email)).toEqual({ intentos: 0, hasta: null });
  });

  it('un login correcto reinicia el contador: 3 malas + 1 buena + 3 malas no bloquea', async () => {
    const email = await crearUsuario('c');
    for (let i = 0; i < 3; i++) await login(email, 'mala');
    expect((await login(email, PASSWORD)).status).toBe(200);
    for (let i = 0; i < 3; i++) expect((await login(email, 'mala')).status).toBe(401);
    expect((await login(email, PASSWORD)).status).toBe(200);
  });

  it('restablecer la contraseña desbloquea la cuenta y pone el contador en 0', async () => {
    const email = await crearUsuario('d');
    for (let i = 0; i < 5; i++) await login(email, 'mala');
    expect((await login(email, PASSWORD)).status).toBe(429);

    expect((await http().post('/api/auth/password/olvido').send({ email })).status).toBe(204);
    const [m] = await adminDb
      .select({ cuerpo: mensaje.cuerpo })
      .from(mensaje)
      .where(eq(mensaje.destino, email))
      .orderBy(desc(mensaje.creadoEn))
      .limit(1);
    // Que el worker de otra suite no reclame este correo.
    await adminDb.update(mensaje).set({ estado: 'enviado' }).where(and(eq(mensaje.destino, email), eq(mensaje.estado, 'pendiente')));
    const token = /token=([A-Za-z0-9_-]+)/.exec(m?.cuerpo ?? '')![1];

    expect((await http().post('/api/auth/password/restablecer').send({ token, password: 'OtraClave456' })).status).toBe(204);
    expect(await estado(email)).toEqual({ intentos: 0, hasta: null });
    expect((await login(email, 'OtraClave456')).status).toBe(200);
  });

  it('un correo inexistente siempre da 401, nunca 429', async () => {
    const email = `nadie.bloqueo.${Date.now()}@e2e.test`;
    for (let i = 0; i < 7; i++) expect((await login(email, 'lo-que-sea')).status).toBe(401);
  });

  it('intentos simultáneos no se pisan: 5 malas en paralelo también bloquean', async () => {
    const email = await crearUsuario('e');
    await Promise.all(Array.from({ length: 5 }, (_, i) => login(email, 'paralela-' + i)));
    expect((await login(email, PASSWORD)).status).toBe(429);
  });
});
