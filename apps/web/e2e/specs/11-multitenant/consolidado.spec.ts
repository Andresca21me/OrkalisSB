import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { USERS, loginAPI } from '../../fixtures/roles';
import {
  sucursalesDe, serviciosPublicos, especialistasPublicos, crearCitaInterna, accionCitaApi,
  completarCitaApi, analisisApi, clientesDe, authHeaders, type Sucursal,
} from '../../fixtures/api';
import { reseed } from '../../fixtures/seed';
import { hoyISO } from '../../fixtures/data';

/**
 * FASE-11 v3 · Jerarquía negocio→sucursal (HU-ADM-002) y blindaje negativo de
 * RLS: el consolidado es la SUMA de las sedes (sin filtración cruzada) y un token
 * de un tenant no alcanza recursos de otro aunque se manipule el id.
 */
test.describe('Multi-tenant · consolidado y RLS', () => {
  let api: APIRequestContext;
  let centro: Sucursal;
  let norte: Sucursal;

  const rangoMes = () => ({
    desde: `${hoyISO().slice(0, 8)}01T00:00:00.000Z`,
    hasta: new Date(Date.now() + 86_400_000).toISOString(),
  });

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => {
    reseed();
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    centro = sucursales.find((s) => /centro/i.test(s.nombre))!;
    norte = sucursales.find((s) => /norte/i.test(s.nombre))!;
  });

  test('el consolidado es la suma de las sedes (Centro + Norte)', async () => {
    // Genera ingresos en Norte (el seed solo tiene en Centro) completando un turno.
    const servicioId = (await serviciosPublicos(api, centro.id))[0].id;
    const carlosId = (await especialistasPublicos(api, centro.id)).find((e) => /carlos/i.test(e.nombre))!.id;
    const inicio = new Date(`${hoyISO()}T16:00:00-05:00`).toISOString();
    const cita = await crearCitaInterna(api, USERS.adminBarberia, { sucursalId: norte.id, especialistaId: carlosId, servicioIds: [servicioId], inicio });
    await accionCitaApi(api, USERS.adminBarberia, cita.id, 'iniciar');
    await completarCitaApi(api, USERS.adminBarberia, cita.id);

    const { desde, hasta } = rangoMes();
    const [cons, cen, nor] = await Promise.all([
      analisisApi(api, USERS.adminBarberia, desde, hasta),
      analisisApi(api, USERS.adminBarberia, desde, hasta, centro.id),
      analisisApi(api, USERS.adminBarberia, desde, hasta, norte.id),
    ]);
    expect(nor.ingresosTotales).toBeGreaterThan(0); // Norte ya tiene ingresos
    expect(cons.ingresosTotales).toBeCloseTo(cen.ingresosTotales + nor.ingresosTotales, 2);
    expect(cons.ingresosSalon).toBeCloseTo(cen.ingresosSalon + nor.ingresosSalon, 2);
  });

  test('un token de un tenant no alcanza recursos de otro (RLS)', async () => {
    const tokenBarberia = await loginAPI(api, USERS.adminBarberia);
    const salonSuc = (await sucursalesDe(api, USERS.adminSalon))[0];
    const salonCliente = (await clientesDe(api, USERS.adminSalon))[0];

    // Citas de una sucursal del salón con token de la barbería → vacío (RLS acota al tenant).
    const desde = `${hoyISO()}T05:00:00.000Z`;
    const hasta = new Date(Date.now() + 86_400_000).toISOString();
    const citas = await api.get(`/api/citas?desde=${desde}&hasta=${hasta}&sucursalId=${salonSuc.id}`, { headers: authHeaders(tokenBarberia) });
    expect(citas.ok()).toBeTruthy();
    expect(await citas.json(), 'no se filtran citas del salón').toEqual([]);

    // Historial de un cliente del salón con token de la barbería → no encontrado.
    const hist = await api.get(`/api/clientes/${salonCliente.id}/historial`, { headers: authHeaders(tokenBarberia) });
    expect(hist.status(), 'cliente de otro tenant no es accesible').toBeGreaterThanOrEqual(400);
  });
});
