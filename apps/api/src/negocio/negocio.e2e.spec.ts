import { config as loadEnv } from 'dotenv';
loadEnv();

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { PerfilNegocio, PlanSuscripcion } from '@orkalis/shared';
import { AppModule } from '../app.module';
import { adminClient, adminDb } from '../db/admin-client';
import { client } from '../db/client';
import { negocio } from '../db/schema';

/**
 * E2E de FASE-07: onboarding, suscripción (cargo por plan + nº especialistas),
 * gating de sucursales por plan, cambio de plan y baja de especialista.
 */
describe('Negocio / suscripción (e2e)', () => {
  let app: INestApplication;
  const sufijo = Date.now();
  const NOMBRE = `Negocio E2E ${sufijo}`;
  const EMAIL = `admin.e2e.${sufijo}@orkalis.test`;
  const PASSWORD = 'Onboard123!';
  let access = '';

  const auth = () => ({ Authorization: `Bearer ${access}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await adminDb.delete(negocio).where(eq(negocio.nombre, NOMBRE));
    await app.close();
    await adminClient.end();
    await client.end();
  });

  const http = () => request(app.getHttpServer());

  it('onboarding crea el negocio (público) y permite login del admin', async () => {
    const onb = await http().post('/api/negocios').send({
      negocioNombre: NOMBRE,
      perfil: PerfilNegocio.Barberia,
      plan: PlanSuscripcion.Basico,
      adminNombre: 'Dueño E2E',
      adminEmail: EMAIL,
      adminPassword: PASSWORD,
    });
    expect(onb.status).toBe(201);
    expect(onb.body.negocioId).toEqual(expect.any(String));

    const login = await http().post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(login.status).toBe(200);
    access = login.body.accessToken;
  });

  it('suscripción inicial: plan básico, 0 especialistas, cargo base 80.000', async () => {
    const res = await http().get('/api/suscripcion').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe(PlanSuscripcion.Basico);
    expect(res.body.numEspecialistas).toBe(0);
    expect(res.body.cargoMensual).toBe(80000);
    expect(res.body.maxSucursales).toBe(1);
  });

  it('cupo: permite crear hasta los incluidos (2); el 3.º se rechaza (FASE-08)', async () => {
    for (const nombre of ['Esp 1', 'Esp 2']) {
      const r = await http().post('/api/especialistas').set(auth()).send({ nombre });
      expect(r.status).toBe(201);
    }
    const tercero = await http().post('/api/especialistas').set(auth()).send({ nombre: 'Esp 3' });
    expect(tercero.status).toBe(403); // cupo básico (incluidos 2) alcanzado

    const res = await http().get('/api/suscripcion').set(auth());
    expect(res.body.uso.especialistas).toBe(2);
    expect(res.body.limites.especialistas).toBe(2); // cupo efectivo del básico
    expect(res.body.cargoMensual).toBe(80000); // dentro de los incluidos
  });

  it('crear una 2ª sucursal en plan Básico es rechazado (gating por plan)', async () => {
    const res = await http().post('/api/sucursales').set(auth()).send({ nombre: 'Sede 2' });
    expect(res.status).toBe(400);
  });

  it('cambiar a Premium permite una 2ª sucursal pero no una 3ª', async () => {
    const cambio = await http().patch('/api/suscripcion/plan').set(auth()).send({ plan: PlanSuscripcion.Premium });
    expect(cambio.status).toBe(200);
    expect(cambio.body.maxSucursales).toBe(2);

    const s2 = await http().post('/api/sucursales').set(auth()).send({ nombre: 'Sede 2' });
    expect(s2.status).toBe(201);

    const s3 = await http().post('/api/sucursales').set(auth()).send({ nombre: 'Sede 3' });
    expect(s3.status).toBe(400); // Premium = máx 2 sedes
  });

  it('dar de baja un especialista libera un cupo (el cargo no cambia, FASE-08)', async () => {
    const lista = await http().get('/api/especialistas').set(auth());
    const activo = lista.body.find((e: { activo: boolean }) => e.activo);
    const baja = await http().delete(`/api/especialistas/${activo.id}`).set(auth());
    expect(baja.status).toBe(204);

    // El cupo pagado no se autoajusta: el cargo sigue siendo el base de Premium.
    const res = await http().get('/api/suscripcion').set(auth());
    expect(res.body.cargoMensual).toBe(210000); // Premium base

    // Con un slot libre (1 activo de 2) se puede volver a crear.
    const nuevo = await http().post('/api/especialistas').set(auth()).send({ nombre: 'Reemplazo' });
    expect(nuevo.status).toBe(201);
  });

  it('cambiar el perfil del negocio no falla y es no destructivo', async () => {
    const onb = await http().get('/api/suscripcion').set(auth());
    expect(onb.status).toBe(200);
    const res = await http()
      .patch('/api/negocios/whatever/perfil')
      .set(auth())
      .send({ perfil: PerfilNegocio.Salon });
    expect(res.status).toBe(204);
    // Los especialistas (datos operativos) siguen existiendo tras el cambio.
    const lista = await http().get('/api/especialistas').set(auth());
    expect(lista.body.length).toBeGreaterThanOrEqual(1);
  });

  it('subir el cupo de especialistas permite crear uno más (upgrade, FASE-09)', async () => {
    const sub = await http().patch('/api/suscripcion/plan').set(auth()).send({ numEspecialistas: 3 });
    expect(sub.status).toBe(200);
    expect(sub.body.numEspecialistas).toBe(3);
    expect(sub.body.limites.especialistas).toBe(3);
    // Con el cupo en 3 y 2 activos, ahora sí se puede crear el 3.º.
    const nuevo = await http().post('/api/especialistas').set(auth()).send({ nombre: 'Tercero' });
    expect(nuevo.status).toBe(201);
  });

  it('bajar el cupo por debajo de los activos es rechazado (FASE-09)', async () => {
    const baja = await http().patch('/api/suscripcion/plan').set(auth()).send({ numEspecialistas: 1 });
    expect(baja.status).toBe(400); // hay 3 activos; el cupo efectivo (2) < 3
  });
});
