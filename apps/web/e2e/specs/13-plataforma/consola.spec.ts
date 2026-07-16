import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { suscripcionesPlataformaApi, type TenantPlataforma } from '../../fixtures/api';
import { reseed } from '../../fixtures/seed';

/**
 * FASE-13 v3 · Operador de plataforma · Consola (HU-PLT-001): lista de tenants
 * con KPIs, búsqueda/filtro, detalle (cupos + historial de cobros) y generar cobro.
 */
test.describe('Plataforma · consola de tenants', () => {
  let api: APIRequestContext;
  let barberia: TenantPlataforma;
  let salon: TenantPlataforma;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => {
    reseed();
    const tenants = await suscripcionesPlataformaApi(api, USERS.operador);
    barberia = tenants.find((t) => /barber/i.test(t.nombre))!;
    salon = tenants.find((t) => /sal[óo]n/i.test(t.nombre))!;
  });

  test('lista los tenants con KPIs coherentes', async ({ browser }) => {
    const s = await abrirRoles(browser, ['operador']);
    try {
      const page = s.operador.page;
      await expect(page.getByRole('heading', { name: 'Negocios' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Ingreso recurrente (MRR)')).toBeVisible();
      await expect(page.getByText('Cuentas activas', { exact: true })).toBeVisible();
      await expect(page.getByTestId(`tenant-row-${barberia.negocioId}`)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId(`tenant-row-${salon.negocioId}`)).toBeVisible();
      await expect(page.getByText(/NaN/)).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('buscar y filtrar reduce la lista', async ({ browser }) => {
    const s = await abrirRoles(browser, ['operador']);
    try {
      const page = s.operador.page;
      await expect(page.getByTestId(`tenant-row-${barberia.negocioId}`)).toBeVisible({ timeout: 15_000 });
      await page.getByPlaceholder(/Buscar/).fill('Barber');
      await expect(page.getByTestId(`tenant-row-${barberia.negocioId}`)).toBeVisible();
      await expect(page.getByTestId(`tenant-row-${salon.negocioId}`)).toHaveCount(0);

      // Filtro "Suspendidas": no hay ninguna → sin coincidencias.
      await page.getByPlaceholder(/Buscar/).fill('');
      await page.getByRole('button', { name: 'Suspendidas', exact: true }).click();
      await expect(page.getByText('Sin coincidencias')).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });

  test('el detalle muestra cupos e historial de cobros', async ({ browser }) => {
    const s = await abrirRoles(browser, ['operador']);
    try {
      const page = s.operador.page;
      await page.getByTestId(`tenant-row-${barberia.negocioId}`).click();
      const dlg = page.getByRole('dialog');
      await expect(dlg.getByRole('heading', { name: 'Cupos de mensajería' })).toBeVisible({ timeout: 15_000 });
      await expect(dlg.getByRole('heading', { name: 'Historial de cobros' })).toBeVisible();
    } finally {
      await cerrarRoles(s);
    }
  });

  test('generar cobro de un tenant', async ({ browser }) => {
    const s = await abrirRoles(browser, ['operador']);
    try {
      const page = s.operador.page;
      const fila = page.getByTestId(`tenant-row-${barberia.negocioId}`);
      await expect(fila).toBeVisible({ timeout: 15_000 });
      await fila.getByRole('button', { name: 'Acciones' }).click();
      await page.getByRole('menuitem', { name: 'Generar cobro' }).click();
      await expect(page.getByText(/generado/)).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
