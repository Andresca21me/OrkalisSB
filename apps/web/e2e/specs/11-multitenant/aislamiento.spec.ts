import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, especialistasPublicos, equipoDe, sembrarReserva, type Sucursal } from '../../fixtures/api';
import { AdminAgendaPage } from '../../pages/agenda.page';
import { GestionPage } from '../../pages/gestion.page';
import { reseed } from '../../fixtures/seed';

/**
 * FASE-11 v3 · Aislamiento multi-tenant desde el front (ADR-001): ningún tenant
 * ve datos de otro en equipo, agenda ni en el enlace público. Generaliza
 * `isolation.spec.ts` (clientes) a más pantallas.
 */
test.describe('Multi-tenant · aislamiento', () => {
  let api: APIRequestContext;
  let centro: Sucursal;
  let salonPrincipal: Sucursal;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => {
    reseed();
    centro = (await sucursalesDe(api, USERS.adminBarberia)).find((s) => /centro/i.test(s.nombre))!;
    salonPrincipal = (await sucursalesDe(api, USERS.adminSalon))[0];
  });

  test('el equipo de un tenant no aparece en el otro', async ({ browser }) => {
    // Oráculo: los equipos son disjuntos por nombre.
    const barberia = (await equipoDe(api, USERS.adminBarberia)).map((e) => e.nombre);
    const salon = (await equipoDe(api, USERS.adminSalon)).map((e) => e.nombre);
    expect(barberia.some((n) => /valentina|sara/i.test(n))).toBeFalsy();
    expect(salon.some((n) => /carlos|diana/i.test(n))).toBeFalsy();

    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const g = new GestionPage(s.adminBarberia.page);
      await g.abrir();
      await g.subtab('Equipo');
      await expect(s.adminBarberia.page.getByText('Carlos Barbero')).toBeVisible({ timeout: 15_000 });
      await expect(s.adminBarberia.page.getByText('Valentina Ríos')).toHaveCount(0);
      await expect(s.adminBarberia.page.getByText('Sara Mendoza')).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('una cita de la barbería no aparece para el admin del salón', async ({ browser }) => {
    const servicioId = (await serviciosPublicos(api, centro.id))[0].id;
    const carlos = (await especialistasPublicos(api, centro.id)).find((e) => /carlos/i.test(e.nombre))!;
    const reserva = await sembrarReserva(api, centro.id, servicioId, { especialista: carlos.id, maxDias: 0 });

    const s = await abrirRoles(browser, ['adminBarberia', 'adminSalon']);
    try {
      const barb = new AdminAgendaPage(s.adminBarberia.page);
      await barb.abrir();
      await expect(barb.fila(reserva.citaId)).toBeVisible({ timeout: 15_000 });

      const salon = new AdminAgendaPage(s.adminSalon.page);
      await salon.abrir();
      await expect(salon.fila(reserva.citaId)).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('el enlace público de una sede solo ofrece especialistas de su tenant', async () => {
    const pubBarberia = (await especialistasPublicos(api, centro.id)).map((e) => e.nombre);
    const pubSalon = (await especialistasPublicos(api, salonPrincipal.id)).map((e) => e.nombre);
    expect(pubBarberia.some((n) => /carlos|diana/i.test(n))).toBeTruthy();
    expect(pubBarberia.some((n) => /valentina|sara/i.test(n))).toBeFalsy();
    expect(pubSalon.some((n) => /valentina|sara/i.test(n))).toBeTruthy();
    expect(pubSalon.some((n) => /carlos|diana/i.test(n))).toBeFalsy();
  });
});
