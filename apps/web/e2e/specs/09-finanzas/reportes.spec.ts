import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles } from '../../fixtures/roles';
import { reseed } from '../../fixtures/seed';
import { FinanzasPage } from '../../pages/finanzas.page';

/**
 * Plan-Finanzas F4: la antigua pestaña Reportes se fusionó en el Resumen — los
 * gráficos (recharts, bundle diferido) cargan allí con los datos del seed.
 */
test.describe('Finanzas · gráficos del resumen', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => { reseed(); });

  test('el Resumen carga los gráficos (lazy) con datos del seed', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const fin = new FinanzasPage(page);
      await fin.abrir();
      await expect(page.getByRole('heading', { name: 'Resumen financiero' })).toBeVisible({ timeout: 15_000 });
      // El seed carga el mes: se amplía el período para ver la tendencia completa.
      await fin.elegirPeriodo('Mes');
      await expect(page.getByText('Tendencia de ingresos del período')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('svg.recharts-surface').first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Ingresos por servicio')).toBeVisible();
    } finally {
      await cerrarRoles(s);
    }
  });
});
