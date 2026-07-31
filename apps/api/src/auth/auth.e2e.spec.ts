import { config as loadEnv } from 'dotenv';
loadEnv();

import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { and, desc, eq, like } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../app.module';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { mensaje, negocio, suscripcion, tokenAccion, usuario } from '../db/schema';

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
    // Limpia los negocios creados por las pruebas de registro (cascada). Los
    // correos del alta y sus tokens NO caen en la cascada (negocio_id NULL):
    // se barren aparte para no dejar filas `pendiente` que el worker de otra
    // suite reclamaría (rompería sus conteos).
    await adminDb.delete(negocio).where(like(negocio.nombre, `${REG}%`));
    await adminDb.delete(mensaje).where(like(mensaje.destino, '%@e2e.test'));
    await adminDb.delete(tokenAccion).where(like(tokenAccion.email, '%@e2e.test'));
    await app.close();
    await adminClient.end();
    await client.end();
  });

  /**
   * Extrae el token del enlace del último correo encolado a ese destino y marca
   * la fila como enviada: así el outbox de OTRA suite corriendo en paralelo no
   * la reclama y le descuadra los conteos de su mock.
   */
  async function tokenDeCorreoEncolado(destino: string): Promise<string> {
    const [m] = await adminDb
      .select({ id: mensaje.id, cuerpo: mensaje.cuerpo })
      .from(mensaje)
      .where(eq(mensaje.destino, destino))
      .orderBy(desc(mensaje.creadoEn))
      .limit(1);
    const match = /token=([A-Za-z0-9_-]+)/.exec(m?.cuerpo ?? '');
    expect(match).not.toBeNull();
    // Se marcan TODOS los correos de prueba (no solo este): cualquier fila
    // `pendiente` nuestra que reclame el worker de otra suite le descuadra los
    // conteos de su mock.
    await adminDb
      .update(mensaje)
      .set({ estado: 'enviado' })
      .where(and(like(mensaje.destino, '%@e2e.test'), eq(mensaje.estado, 'pendiente')));
    return match![1];
  }

  const http = () => request(app.getHttpServer());

  /**
   * Verificación de correo ya completada, insertada directo en BD (Plan-Correo
   * E2). Evita gastar el throttle del endpoint público en cada registro de
   * estas pruebas; la cadena completa por HTTP se prueba en su propio describe.
   */
  async function verificacionUsada(email: string): Promise<string> {
    const [v] = await adminDb
      .insert(tokenAccion)
      .values({
        tipo: 'alta_email',
        tokenHash: randomUUID(),
        email: email.toLowerCase().trim(),
        usadoEn: new Date(),
        expiraEn: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning({ id: tokenAccion.id });
    return v.id;
  }

  /** POST /auth/registro con su verificación de correo ya resuelta. */
  async function registrar(datos: { admin: { email: string; [k: string]: unknown } } & Record<string, unknown>) {
    const verificacionId = await verificacionUsada(datos.admin.email);
    return http().post('/api/auth/registro').send({ ...datos, verificacionId });
  }

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
      const res = await registrar(base());
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
      const res = await registrar(base({ negocioNombre: `${REG} Pago`, modo: 'pago' }));
      expect(res.status).toBe(201);
      expect(res.body.requierePago).toBe(true);
    });

    it('email duplicado → 409', async () => {
      const datos = base({ negocioNombre: `${REG} Dup` });
      const r1 = await registrar(datos);
      expect(r1.status).toBe(201);
      const r2 = await registrar(datos); // mismo email
      expect(r2.status).toBe(409);
    });

    it('numEspecialistas por debajo de los incluidos → 400', async () => {
      const res = await registrar(base({ negocioNombre: `${REG} Min`, plan: 'pro', numEspecialistas: 1 }));
      expect(res.status).toBe(400);
    });

    it('contraseña corta (< 8) → 400 de validación', async () => {
      const res = await registrar(base({ negocioNombre: `${REG} Pass`, admin: { nombre: 'X', email: `x.${Date.now()}@e2e.test`, password: 'corta' } }));
      expect(res.status).toBe(400);
    });
  });

  // ── Verificación de correo en el alta (Plan-Correo E2) ──────────────────────
  describe('Verificación de correo del alta (Paso 2 → 3)', () => {
    const emailDe = (tag: string) => `${tag}.${Date.now()}@e2e.test`;

    it('la cadena completa: iniciar → correo encolado → clic → polling verificado → registro', async () => {
      const email = emailDe('cadena');
      const ini = await http().post('/api/auth/alta/verificacion').send({ email, nombre: 'Ana Prueba' });
      expect(ini.status).toBe(201);
      const verificacionId = ini.body.verificacionId as string;

      // Aún sin clic: el polling dice que no, y el registro se niega (403).
      const antes = await http().get(`/api/auth/alta/verificacion/${verificacionId}`);
      expect(antes.body.verificado).toBe(false);
      const bloqueado = await http().post('/api/auth/registro').send({
        negocioNombre: `${REG} SinClic`,
        perfil: 'barberia',
        plan: 'pro',
        numEspecialistas: 2,
        admin: { nombre: 'Ana Prueba', email, password: 'Password123' },
        modo: 'prueba',
        verificacionId,
      });
      expect(bloqueado.status).toBe(403);
      expect(bloqueado.body.codigo).toBe('CORREO_NO_VERIFICADO');

      // El correo quedó en el outbox como fila de PLATAFORMA (sin negocio).
      const token = await tokenDeCorreoEncolado(email);

      // Clic en el enlace (idempotente: el segundo clic responde amistoso).
      const clic = await http().post('/api/auth/verificar-correo').send({ token });
      expect(clic.status).toBe(200);
      expect(clic.body.contexto).toBe('alta');
      const doble = await http().post('/api/auth/verificar-correo').send({ token });
      expect(doble.status).toBe(200);

      // El polling del wizard ya lo ve y el registro pasa.
      const despues = await http().get(`/api/auth/alta/verificacion/${verificacionId}`);
      expect(despues.body.verificado).toBe(true);
      const reg = await http().post('/api/auth/registro').send({
        negocioNombre: `${REG} ConClic`,
        perfil: 'barberia',
        plan: 'pro',
        numEspecialistas: 2,
        admin: { nombre: 'Ana Prueba', email, password: 'Password123' },
        modo: 'prueba',
        verificacionId,
      });
      expect(reg.status).toBe(201);

      // El registro estampó la prueba de que el correo es del dueño.
      const [u] = await adminDb.select().from(usuario).where(eq(usuario.email, email));
      expect(u.emailVerificadoEn).toBeInstanceOf(Date);

      // La verificación quedó consumida: no pare una segunda cuenta.
      const otra = await http().post('/api/auth/registro').send({
        negocioNombre: `${REG} Segunda`,
        perfil: 'barberia',
        plan: 'pro',
        numEspecialistas: 2,
        admin: { nombre: 'Ana Prueba', email: emailDe('otra'), password: 'Password123' },
        modo: 'prueba',
        verificacionId,
      });
      expect(otra.status).toBe(403);
    });

    it('la verificación exige que el email del registro sea EL verificado', async () => {
      const email = emailDe('cruce');
      const verificacionId = await verificacionUsada(email);
      const res = await http().post('/api/auth/registro').send({
        negocioNombre: `${REG} Cruce`,
        perfil: 'barberia',
        plan: 'pro',
        numEspecialistas: 2,
        admin: { nombre: 'Otro', email: emailDe('impostor'), password: 'Password123' },
        modo: 'prueba',
        verificacionId,
      });
      expect(res.status).toBe(403);
      expect(res.body.codigo).toBe('CORREO_NO_VERIFICADO');
    });

    it('un correo ya registrado se detecta al INICIAR la verificación (409)', async () => {
      const res = await http().post('/api/auth/alta/verificacion').send({ email: EMAIL, nombre: 'Alguien' });
      expect(res.status).toBe(409);
    });

    it('el enlace inválido responde 400 sin filtrar nada', async () => {
      const res = await http().post('/api/auth/verificar-correo').send({ token: 'x'.repeat(43) });
      expect(res.status).toBe(400);
    });
  });

  // ── Recuperación de contraseña (Plan-Correo E3) ─────────────────────────────
  describe('Olvido y restablecimiento de contraseña', () => {
    it('con un correo inexistente responde 204 igual (anti-enumeración)', async () => {
      const res = await http().post('/api/auth/password/olvido').send({ email: `nadie.${Date.now()}@e2e.test` });
      expect(res.status).toBe(204);
    });

    it('el flujo completo: olvido → enlace → nueva contraseña → sesiones viejas revocadas', async () => {
      const email = `reset.${Date.now()}@e2e.test`;
      const reg = await registrar({
        negocioNombre: `${REG} Reset`,
        perfil: 'barberia',
        plan: 'pro',
        numEspecialistas: 2,
        admin: { nombre: 'Reset Owner', email, password: 'Password123' },
        modo: 'prueba',
      });
      expect(reg.status).toBe(201);
      const refreshViejo = reg.body.refreshToken as string;

      expect((await http().post('/api/auth/password/olvido').send({ email })).status).toBe(204);
      const token = await tokenDeCorreoEncolado(email);

      // La página valida el enlace antes de pintar el formulario.
      const val = await http().get(`/api/auth/password/token/${token}`);
      expect(val.body.valido).toBe(true);

      const cambio = await http().post('/api/auth/password/restablecer').send({ token, password: 'NuevaClave456' });
      expect(cambio.status).toBe(204);

      // La contraseña vieja murió; la nueva entra.
      expect((await http().post('/api/auth/login').send({ email, password: 'Password123' })).status).toBe(401);
      expect((await http().post('/api/auth/login').send({ email, password: 'NuevaClave456' })).status).toBe(200);

      // El refresh emitido antes del reset quedó revocado (D8).
      expect((await http().post('/api/auth/refresh').send({ refreshToken: refreshViejo })).status).toBe(401);

      // El enlace sirve UNA vez: el segundo intento es 401 y la clave no cambia.
      expect((await http().post('/api/auth/password/restablecer').send({ token, password: 'Pirata789x' })).status).toBe(401);
      expect((await http().post('/api/auth/login').send({ email, password: 'NuevaClave456' })).status).toBe(200);
      expect((await http().get(`/api/auth/password/token/${token}`)).body.valido).toBe(false);
    });
  });

  // ── Credenciales desde Configuración (Plan-Correo E4) ───────────────────────
  describe('Credenciales en Configuración (cambiar contraseña y correo)', () => {
    let token: string;
    let refreshTk: string;
    let email: string;
    const auth = () => ({ Authorization: `Bearer ${token}` });

    beforeAll(async () => {
      email = `cred.${Date.now()}@e2e.test`;
      const r = await registrar({
        negocioNombre: `${REG} Credenciales`,
        perfil: 'salon',
        plan: 'pro',
        numEspecialistas: 2,
        admin: { nombre: 'Cred Owner', email, password: 'Password123' },
        modo: 'prueba',
      });
      token = r.body.accessToken;
      refreshTk = r.body.refreshToken;
    });

    it('cambiar contraseña exige la actual y revoca las sesiones', async () => {
      const mala = await http().post('/api/auth/password/cambiar').set(auth()).send({ passwordActual: 'equivocada1', passwordNueva: 'OtraClave456' });
      expect(mala.status).toBe(401);

      const ok = await http().post('/api/auth/password/cambiar').set(auth()).send({ passwordActual: 'Password123', passwordNueva: 'OtraClave456' });
      expect(ok.status).toBe(204);

      expect((await http().post('/api/auth/login').send({ email, password: 'Password123' })).status).toBe(401);
      const relogin = await http().post('/api/auth/login').send({ email, password: 'OtraClave456' });
      expect(relogin.status).toBe(200);
      expect((await http().post('/api/auth/refresh').send({ refreshToken: refreshTk })).status).toBe(401);
      token = relogin.body.accessToken;
    });

    it('cambiar el correo: se consolida SOLO al confirmar la dirección nueva', async () => {
      const nuevo = `cred.nuevo.${Date.now()}@e2e.test`;

      // Password mala → 401; correo del seed (ya en uso) → 409.
      expect((await http().post('/api/auth/email/cambio').set(auth()).send({ password: 'equivocada1', nuevoEmail: nuevo })).status).toBe(401);
      expect((await http().post('/api/auth/email/cambio').set(auth()).send({ password: 'OtraClave456', nuevoEmail: EMAIL })).status).toBe(409);

      expect((await http().post('/api/auth/email/cambio').set(auth()).send({ password: 'OtraClave456', nuevoEmail: nuevo })).status).toBe(204);
      expect((await http().get('/api/auth/email/cambio').set(auth())).body.pendiente).toBe(nuevo);

      // Todavía se entra con el correo viejo; con el nuevo no existe cuenta.
      expect((await http().post('/api/auth/login').send({ email, password: 'OtraClave456' })).status).toBe(200);
      expect((await http().post('/api/auth/login').send({ email: nuevo, password: 'OtraClave456' })).status).toBe(401);

      // Clic en el enlace enviado a la dirección NUEVA → consolida.
      const t = await tokenDeCorreoEncolado(nuevo);
      const clic = await http().post('/api/auth/verificar-correo').send({ token: t });
      expect(clic.status).toBe(200);
      expect(clic.body.contexto).toBe('cambio_email');

      expect((await http().post('/api/auth/login').send({ email: nuevo, password: 'OtraClave456' })).status).toBe(200);
      expect((await http().post('/api/auth/login').send({ email, password: 'OtraClave456' })).status).toBe(401);
      expect((await http().get('/api/auth/email/cambio').set(auth())).body.pendiente).toBeNull();

      // Quedó encolado el aviso a la dirección anterior.
      const [aviso] = await adminDb
        .select({ tipo: mensaje.tipo })
        .from(mensaje)
        .where(eq(mensaje.destino, email))
        .orderBy(desc(mensaje.creadoEn))
        .limit(1);
      expect(aviso?.tipo).toBe('cambio_email');
      await adminDb
        .update(mensaje)
        .set({ estado: 'enviado' })
        .where(and(like(mensaje.destino, '%@e2e.test'), eq(mensaje.estado, 'pendiente')));
      email = nuevo;
    });

    it('cancelar la solicitud mata el enlace enviado', async () => {
      const otro = `cred.cancelado.${Date.now()}@e2e.test`;
      expect((await http().post('/api/auth/email/cambio').set(auth()).send({ password: 'OtraClave456', nuevoEmail: otro })).status).toBe(204);
      const t = await tokenDeCorreoEncolado(otro);

      const canc = await http().delete('/api/auth/email/cambio').set(auth());
      expect(canc.status).toBe(204);
      expect((await http().get('/api/auth/email/cambio').set(auth())).body.pendiente).toBeNull();
      expect((await http().post('/api/auth/verificar-correo').send({ token: t })).status).toBe(400);
    });

    it('sin sesión, los endpoints de credenciales responden 401', async () => {
      expect((await http().post('/api/auth/password/cambiar').send({ passwordActual: 'x', passwordNueva: 'Password123' })).status).toBe(401);
      expect((await http().get('/api/auth/email/cambio')).status).toBe(401);
    });
  });

  // ── Control de acceso por prueba de 15 días (Plan-Pagos FASE-04) ────────────
  describe('Prueba de 15 días · acceso y corte', () => {
    let token: string;
    let negocioId: string;
    const auth = () => `Bearer ${token}`;

    beforeAll(async () => {
      const r = await registrar({
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
      const r = await registrar({
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
      const r = await registrar({
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
