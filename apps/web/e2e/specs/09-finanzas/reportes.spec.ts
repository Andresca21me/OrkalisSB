import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles } from '../../fixtures/roles';
import { reseed } from '../../fixtures/seed';
import { FinanzasPage } from '../../pages/finanzas.page';

/**
 * FASE-09 v3 · Finanzas · Reportes y gráficos (HU-ADM-010): la pestaña Reportes
 * carga los gráficos (recharts, bundle diferido) sin errores y muestra el desglose.
 */
test.describe('Finanzas · reportes', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => { reseed(); });

  test('la pestaña Reportes carga los gráficos (lazy) con datos del seed', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const fin = new FinanzasPage(page);
      await fin.abrir();
      await fin.subtab('Reportes');
      await expect(page.getByRole('heading', { name: 'Reportes y gráficos' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Tendencia de ingresos')).toBeVisible({ timeout: 15_000 });
      // El gráfico (recharts) renderiza un <svg> tras la carga diferida.
      await expect(page.locator('svg.recharts-surface').first()).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
