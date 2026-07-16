import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, especialistasPublicos, equipoDe, type Sucursal } from '../../fixtures/api';
import { GestionPage } from '../../pages/gestion.page';
import { reseed } from '../../fixtures/seed';
import { nombreUnico } from '../../fixtures/data';

/**
 * FASE-08 v3 · Gestión · Equipo (HU-ADM-005): alta y asignación a sucursales se
 * reflejan en el enlace público (especialistas reservables); la baja lógica los
 * retira del público. Re-siembra por prueba (ids frescos).
 */
test.describe('Gestión · equipo', () => {
  let api: APIRequestContext;
  let centro: Sucursal;
  let norte: Sucursal;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => {
    reseed();
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    centro = sucursales.find((s) => /centro/i.test(s.nombre)) ?? sucursales[0];
    norte = sucursales.find((s) => /norte/i.test(s.nombre))!;
  });

  test('lista el equipo del negocio', async ({ browser }) => {
    const equipo = await equipoDe(api, USERS.adminBarberia);
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const g = new GestionPage(s.adminBarberia.page);
      await g.abrir();
      await g.subtab('Equipo');
      for (const e of equipo.filter((x) => x.activo)) await expect(g.filaEsp(e.id)).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });

  test('alta de especialista → reservable en su sede (enlace público)', async ({ browser }) => {
    const nombre = nombreUnico('Esp Nuevo');
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const g = new GestionPage(s.adminBarberia.page);
      await g.abrir();
      await g.subtab('Equipo');
      await g.crearEspecialista(nombre, [], 'Barbero');

      const creado = (await equipoDe(api, USERS.adminBarberia)).find((e) => e.nombre === nombre)!;
      expect(creado, 'el especialista existe').toBeTruthy();
      await expect(g.filaEsp(creado.id)).toBeVisible({ timeout: 15_000 });
      // Reservable en el enlace público de Centro (sede pre-seleccionada).
      const publicos = await especialistasPublicos(api, centro.id);
      expect(publicos.some((p) => p.nombre === nombre)).toBeTruthy();
    } finally {
      await cerrarRoles(s);
    }
  });

  test('asignación a dos sedes → reservable en ambas', async ({ browser }) => {
    const nombre = nombreUnico('Esp BiSede');
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const g = new GestionPage(s.adminBarberia.page);
      await g.abrir();
      await g.subtab('Equipo');
      await g.crearEspecialista(nombre, ['Sede Norte']); // Centro pre-seleccionada + Norte

      const enCentro = await especialistasPublicos(api, centro.id);
      const enNorte = await especialistasPublicos(api, norte.id);
      expect(enCentro.some((p) => p.nombre === nombre), 'reservable en Centro').toBeTruthy();
      expect(enNorte.some((p) => p.nombre === nombre), 'reservable en Norte').toBeTruthy();
    } finally {
      await cerrarRoles(s);
    }
  });

  test('baja lógica retira al especialista del enlace público', async ({ browser }) => {
    const diana = (await equipoDe(api, USERS.adminBarberia)).find((e) => /diana/i.test(e.nombre))!;
    expect((await especialistasPublicos(api, centro.id)).some((p) => /diana/i.test(p.nombre))).toBeTruthy();

    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const g = new GestionPage(s.adminBarberia.page);
      await g.abrir();
      await g.subtab('Equipo');
      await g.darDeBajaEsp(diana.id);
      await expect(g.filaEsp(diana.id)).toHaveCount(0);
      // Ya no aparece en el enlace público.
      expect((await especialistasPublicos(api, centro.id)).some((p) => /diana/i.test(p.nombre))).toBeFalsy();
    } finally {
      await cerrarRoles(s);
    }
  });
});
