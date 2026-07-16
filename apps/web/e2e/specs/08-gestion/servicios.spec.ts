import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, type Sucursal } from '../../fixtures/api';
import { GestionPage } from '../../pages/gestion.page';
import { reseed } from '../../fixtures/seed';
import { nombreUnico } from '../../fixtures/data';

/**
 * FASE-08 v3 · Gestión · Servicios y repartición (HU-ADM-006): catálogo CRUD y
 * configuración del reparto (porcentaje y valor fijo) reflejada en la tarjeta.
 */
test.describe('Gestión · servicios', () => {
  let api: APIRequestContext;
  let centro: Sucursal;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => {
    reseed();
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    centro = sucursales.find((s) => /centro/i.test(s.nombre)) ?? sucursales[0];
  });

  const idDe = async (nombre: string) => (await serviciosPublicos(api, centro.id)).find((s) => s.nombre === nombre)?.id;

  test('crea un servicio con reparto por porcentaje', async ({ browser }) => {
    const nombre = nombreUnico('Servicio Pct');
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const g = new GestionPage(s.adminBarberia.page);
      await g.abrir();
      await g.subtab('Servicios');
      await g.crearServicio({ nombre, precio: 40000, tipo: 'porcentaje', valor: 60 });

      const id = await idDe(nombre);
      expect(id, 'el servicio existe en el catálogo').toBeTruthy();
      await expect(g.filaServicio(id!)).toBeVisible({ timeout: 15_000 });
      await expect(g.filaServicio(id!)).toContainText('60%');
    } finally {
      await cerrarRoles(s);
    }
  });

  test('crea un servicio con reparto por valor fijo', async ({ browser }) => {
    const nombre = nombreUnico('Servicio Fijo');
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const g = new GestionPage(s.adminBarberia.page);
      await g.abrir();
      await g.subtab('Servicios');
      await g.crearServicio({ nombre, precio: 30000, tipo: 'valor_fijo', valor: 15000 });

      const id = await idDe(nombre);
      expect(id, 'el servicio existe en el catálogo').toBeTruthy();
      await expect(g.filaServicio(id!)).toContainText('Fijo', { timeout: 15_000 });
      await expect(g.filaServicio(id!)).toContainText(/15\.000/);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('dar de baja un servicio lo marca inactivo (conserva el registro)', async ({ browser }) => {
    const nombre = nombreUnico('Servicio Baja');
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const g = new GestionPage(page);
      await g.abrir();
      await g.subtab('Servicios');
      await g.crearServicio({ nombre, precio: 20000, tipo: 'porcentaje', valor: 50 });
      const id = (await idDe(nombre))!;

      // Botón de papelera de la tarjeta → confirmación "Dar de baja".
      await g.filaServicio(id).getByRole('button').last().click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('button', { name: 'Dar de baja' }).click();
      await expect(dlg).toBeHidden({ timeout: 15_000 });

      // El catálogo solo lista servicios activos: tras la baja, la tarjeta sale.
      await expect(g.filaServicio(id)).toHaveCount(0, { timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
