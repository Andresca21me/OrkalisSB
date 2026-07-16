import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { clientesDe, type ClienteCRM } from '../../fixtures/api';
import { ClientesPage } from '../../pages/clientes.page';
import { reseed } from '../../fixtures/seed';

/**
 * FASE-07 v3 · CRM · Listado, búsqueda y aislamiento (HU-ADM-005 análogo,
 * ADR-001). El admin barbería ve su directorio y filtra; no ve clientes del salón.
 */
test.describe('CRM · listado y búsqueda', () => {
  let api: APIRequestContext;
  let clientes: ClienteCRM[];

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => {
    reseed();
    clientes = await clientesDe(api, USERS.adminBarberia);
  });

  test('lista los clientes del tenant con sus métricas', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const cli = new ClientesPage(s.adminBarberia.page);
      await cli.abrir();
      await expect(s.adminBarberia.page.getByText('Total de clientes')).toBeVisible();
      for (const c of clientes) await expect(cli.tarjeta(c.id)).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });

  test('la búsqueda filtra y sin coincidencias muestra vacío', async ({ browser }) => {
    const juan = clientes.find((c) => /juan/i.test(c.nombre))!;
    const maria = clientes.find((c) => /mar[íi]a/i.test(c.nombre))!;
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const cli = new ClientesPage(page);
      await cli.abrir();

      await cli.buscar('Juan');
      await expect(cli.tarjeta(juan.id)).toBeVisible({ timeout: 15_000 });
      await expect(cli.tarjeta(maria.id)).toHaveCount(0);

      await cli.buscar('zzz-no-existe-cliente');
      await expect(page.getByText('Sin resultados')).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });

  test('no muestra clientes de otro tenant (aislamiento)', async ({ browser }) => {
    const juan = clientes.find((c) => /juan/i.test(c.nombre))!;
    const salon = await clientesDe(api, USERS.adminSalon);
    const laura = salon.find((c) => /laura/i.test(c.nombre))!;
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const cli = new ClientesPage(page);
      await cli.abrir();
      await expect(cli.tarjeta(juan.id)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(laura.nombre)).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });
});
