import { config as loadEnv } from 'dotenv';
loadEnv();

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq, like } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../app.module';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { negocio, suscripcion } from '../db/schema';

/**
 * E2E del flujo de autenticación (FASE-05). Requiere el seed aplicado
 * (admin@orkalis.demo / Orkalis2026!) y Postgres local levantado.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  const EMAIL = 'admin@orkalis.demo';
  const PASSWORD = 'Orkalis2026!';
  // Prefijo único de esta corrida para los negocios que crea el registro.
  const REG = `E2E-REG-${Date.now()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    // Limpia los negocios creados por las pruebas de registro (cascada).
    await adminDb.delete(negocio).where(like(negocio.nombre, `${REG}%`));
    await app.close();
    await adminClient.end();
    await client.end();
  });

  const http = () => request(app.getHttpServer());

  it('login con credenciales válidas devuelve access + refresh', async () => {
    const res = await http().post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  it('login con contraseña incorrecta → 401', async () => {
    const res = await http().post('/api/auth/login').send({ email: EMAIL, password: 'mala' });
    expect(res.status).toBe(401);
  });

  it('endpoint protegido sin token → 401', async () => {
    const res = await http().get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('endpoint protegido con token válido → 200 y contexto del negocio', async () => {
    const login = await http().post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    const res = await http()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(EMAIL);
    expect(res.body.rol).toBe('admin');
    expect(res.body.negocioId).toEqual(expect.any(String));
  });

  it('refresh rota el token y el refresh viejo deja de servir (detección de reuso)', async () => {
    const login = await http().post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    const viejo = login.body.refreshToken as string;

    const rot = await http().post('/api/auth/refresh').send({ refreshToken: viejo });
    expect(rot.status).toBe(200);
    expect(rot.body.refreshToken).not.toBe(viejo);

    // Reusar el refresh ya rotado debe fallar (y revocar la familia).
    const reuso = await http().post('/api/auth/refresh').send({ refreshToken: viejo });
    expect(reuso.status).toBe(401);

    // El nuevo refresh, tras el reuso detectado, también queda revocado.
    const nuevo = rot.body.refreshToken as string;
    const trasReuso = await http().post('/api/auth/refresh').send({ refreshToken: nuevo });
    expect(trasReuso.status).toBe(401);
  });

  it('logout revoca el refresh token', async () => {
    const login = await http().post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    const rt = login.body.refreshToken as string;

    const out = await http().post('/api/auth/logout').send({ refreshToken: rt });
    expect(out.status).toBe(204);

    const after = await http().post('/api/auth/refresh').send({ refreshToken: rt });
    expect(after.status).toBe(401);
  });

  // ── Registro público de un negocio (Plan-Pagos FASE-03) ─────────────────────
  describe('POST /auth/registro', () => {
    const base = (over: Record<string, unknown> = {}) => ({
      negocioNombre: `${REG} Prueba`,
      perfil: 'barberia',
      plan: 'pro',
      numEspecialistas: 2,
      admin: { nombre: 'Dueño Test', email: `reg.${Date.now()}.${Math.random()}@e2e.test`, password: 'Password123' },
      modo: 'prueba',
      ...over,
    });

    it('modo prueba crea el tenant, inicia sesión y arranca en prueba', async () => {
      const res = await http().post('/api/auth/registro').send(base());
      expect(res.status).toBe(201);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.requierePago).toBe(false);

      // La sesión devuelta funciona y el negocio quedó en estado prueba.
      const me = await http().get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`);
      expect(me.status).toBe(200);
      expect(me.body.rol).toBe('admin');
      expect(me.body.negocio.estadoSuscripcion).toBe('prueba');

      // La suscripción refleja plan y nº de especialistas elegidos.
      const sus = await http().get('/api/suscripcion').set('Authorization', `Bearer ${res.body.accessToken}`);
      expect(sus.body.plan).toBe('pro');
      expect(sus.body.numEspecialistas).toBe(2);
    });

    it('modo pago marca requierePago = true (irá al checkout)', async () => {
      const res = await http()
        .post('/api/auth/registro')
        .send(base({ negocioNombre: `${REG} Pago`, modo: 'pago' }));
      expect(res.status).toBe(201);
      expect(res.body.requierePago).toBe(true);
    });

    it('email duplicado → 409', async () => {
      const datos = base({ negocioNombre: `${REG} Dup` });
      const r1 = await http().post('/api/auth/registro').send(datos);
      expect(r1.status).toBe(201);
      const r2 = await http().post('/api/auth/registro').send(datos); // mismo email
      expect(r2.status).toBe(409);
    });

    it('numEspecialistas por debajo de los incluidos → 400', async () => {
      const res = await http()
        .post('/api/auth/registro')
        .send(base({ negocioNombre: `${REG} Min`, plan: 'pro', numEspecialistas: 1 }));
      expect(res.status).toBe(400);
    });

    it('contraseña corta (< 8) → 400 de validación', async () => {
      const res = await http()
        .post('/api/auth/registro')
        .send(base({ negocioNombre: `${REG} Pass`, admin: { nombre: 'X', email: `x.${Date.now()}@e2e.test`, password: 'corta' } }));
      expect(res.status).toBe(400);
    });
  });

  // ── Control de acceso por prueba de 15 días (Plan-Pagos FASE-04) ────────────
  describe('Prueba de 15 días · acceso y corte', () => {
    let token: string;
    let negocioId: string;
    const auth = () => `Bearer ${token}`;

    beforeAll(async () => {
      const r = await http()
        .post('/api/auth/registro')
        .send({
          negocioNombre: `${REG} Trial`,
          perfil: 'barberia',
          plan: 'pro',
          numEspecialistas: 2,
          admin: { nombre: 'Trial Owner', email: `trial.${Date.now()}@e2e.test`, password: 'Password123' },
          modo: 'prueba',
        });
      token = r.body.accessToken;
      negocioId = r.body.negocioId;
    });

    it('con la prueba vigente entra y /suscripcion da días restantes', async () => {
      const me = await http().get('/api/auth/me').set('Authorization', auth());
      expect(me.status).toBe(200);
      const sus = await http().get('/api/suscripcion').set('Authorization', auth());
      expect(sus.body.trialDiasRestantes).toBeGreaterThan(0);
      expect(sus.body.trialDiasRestantes).toBeLessThanOrEqual(15);
    });

    it('al vencer la prueba, el corte en caliente bloquea (403 prueba_vencida) y suspende', async () => {
      // Vence la prueba "a mano" (lo que haría el paso del tiempo).
      await adminDb
        .update(suscripcion)
        .set({ trialFin: new Date(Date.now() - 86_400_000) })
        .where(eq(suscripcion.negocioId, negocioId));

      // El mismo token, ya válido, ahora es rechazado en cada request.
      const me = await http().get('/api/auth/me').set('Authorization', auth());
      expect(me.status).toBe(403);
      expect(me.body.motivo).toBe('prueba_vencida');
      expect(me.body.codigo).toBe('SUSCRIPCION_BLOQUEADA');

      // El corte transicionó la cuenta a suspendida (sin esperar al cron).
      const [s] = await adminDb.select().from(suscripcion).where(eq(suscripcion.negocioId, negocioId));
      expect(s.estado).toBe('suspendida');
    });

    // ── Sesión limitada de facturación (FASE-11) ─────────────────────────────
    it('estando bloqueada, GET /suscripcion SÍ es accesible y reporta el bloqueo', async () => {
      const sus = await http().get('/api/suscripcion').set('Authorization', auth());
      expect(sus.status).toBe(200); // @AccesoFacturacion exime este endpoint
      expect(sus.body.bloqueado).toBe(true);
      expect(sus.body.estado).toBe('suspendida');
    });

    it('estando bloqueada, un endpoint normal de tenant sigue dando 403', async () => {
      const r = await http().get('/api/especialistas').set('Authorization', auth());
      expect(r.status).toBe(403);
      expect(r.body.codigo).toBe('SUSCRIPCION_BLOQUEADA');
    });

    it('estando bloqueada, los endpoints de PAGO son alcanzables (no 403 por suscripción)', async () => {
      // Cuerpo vacío → 400 de validación, NUNCA 403 SUSCRIPCION_BLOQUEADA: el guard
      // exime @AccesoFacturacion para que la cuenta pueda pagar y recuperarse.
      const pagar = await http().post('/api/suscripcion/pagar').set('Authorization', auth()).send({});
      expect(pagar.status).not.toBe(403);
      expect(pagar.status).toBe(400);
      const metodo = await http().post('/api/suscripcion/metodo-pago').set('Authorization', auth()).send({});
      expect(metodo.status).not.toBe(403);
    });

    it('estando bloqueada, NO se puede cambiar de plan (no es endpoint de facturación)', async () => {
      const cambiar = await http()
        .post('/api/suscripcion/cambiar')
        .set('Authorization', auth())
        .send({ plan: 'pro' });
      expect(cambiar.status).toBe(403);
      expect(cambiar.body.codigo).toBe('SUSCRIPCION_BLOQUEADA');
    });
  });

  // Estados CON acceso: en_gracia (morosa, en periodo de gracia) y cortesía
  // entran al panel con normalidad (regla única `tieneAcceso`, ADR-P2).
  describe('Estados con acceso entran al panel (FASE-11)', () => {
    async function cuentaEn(estado: 'en_gracia' | 'cortesia'): Promise<string> {
      const r = await http()
        .post('/api/auth/registro')
        .send({
          negocioNombre: `${REG} ${estado}`,
          perfil: 'barberia',
          plan: 'pro',
          numEspecialistas: 2,
          admin: { nombre: 'Owner', email: `${estado}.${Date.now()}@e2e.test`, password: 'Password123' },
          modo: 'prueba',
        });
      const id = r.body.negocioId as string;
      await adminDb.update(suscripcion).set({ estado }).where(eq(suscripcion.negocioId, id));
      await adminDb.update(negocio).set({ estadoSuscripcion: estado }).where(eq(negocio.id, id));
      return r.body.accessToken as string;
    }

    it('en_gracia: el admin entra (me 200) y opera el panel (especialistas 200)', async () => {
      const token = `Bearer ${await cuentaEn('en_gracia')}`;
      expect((await http().get('/api/auth/me').set('Authorization', token)).status).toBe(200);
      expect((await http().get('/api/especialistas').set('Authorization', token)).status).toBe(200);
    });

    it('cortesía: el admin entra (me 200) y opera el panel (especialistas 200)', async () => {
      const token = `Bearer ${await cuentaEn('cortesia')}`;
      expect((await http().get('/api/auth/me').set('Authorization', token)).status).toBe(200);
      expect((await http().get('/api/especialistas').set('Authorization', token)).status).toBe(200);
    });
  });

  // El login de una cuenta sin acceso ya NO se bloquea: emite una sesión
  // limitada para que el admin pueda pagar y recuperar la cuenta (FASE-11).
  describe('Login de cuenta bloqueada → sesión limitada (FASE-11)', () => {
    let email: string;
    let negocioId: string;

    beforeAll(async () => {
      const r = await http()
        .post('/api/auth/registro')
        .send({
          negocioNombre: `${REG} Bloqueo`,
          perfil: 'salon',
          plan: 'basico',
          numEspecialistas: 2,
          admin: { nombre: 'Bloqueo Owner', email: (email = `bloq.${Date.now()}@e2e.test`), password: 'Password123' },
          modo: 'prueba',
        });
      negocioId = r.body.negocioId;
      // Suspende la cuenta directamente (morosidad simulada).
      await adminDb.update(suscripcion).set({ estado: 'suspendida' }).where(eq(suscripcion.negocioId, negocioId));
      await adminDb.update(negocio).set({ estadoSuscripcion: 'suspendida' }).where(eq(negocio.id, negocioId));
    });

    it('login devuelve tokens (no 403) aunque la cuenta esté suspendida', async () => {
      const login = await http().post('/api/auth/login').send({ email, password: 'Password123' });
      expect(login.status).toBe(200);
      expect(login.body.accessToken).toEqual(expect.any(String));

      // La sesión limitada lee facturación pero no el panel.
      const token = `Bearer ${login.body.accessToken}`;
      const sus = await http().get('/api/suscripcion').set('Authorization', token);
      expect(sus.status).toBe(200);
      expect(sus.body.bloqueado).toBe(true);
      const me = await http().get('/api/auth/me').set('Authorization', token);
      expect(me.status).toBe(403);
    });
  });
});
