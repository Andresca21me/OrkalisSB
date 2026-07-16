import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles } from '../../fixtures/roles';
import { reseed } from '../../fixtures/seed';
import { ConfigPage } from '../../pages/config.page';

/**
 * FASE-10 v3 · Config · Suscripción (vista admin, HU-PLT-001 desde el negocio):
 * el resumen muestra plan, cargo mensual y cupos de mensajería; el error se
 * maneja (regresión del fix v2-FASE-14).
 */
test.describe('Config · suscripción', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => { reseed(); });

  test('muestra plan, cargo mensual y cupos de mensajería', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const cfg = new ConfigPage(page);
      await cfg.abrir();
      await cfg.seccion('Suscripción');
      await expect(page.getByRole('heading', { name: 'Suscripción' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Plan actual', { exact: true })).toBeVisible();
      await expect(page.getByText('Cargo mensual', { exact: true })).toBeVisible();
      await expect(page.getByText('Cupos de mensajería / mes')).toBeVisible();
      await expect(page.getByText(/NaN/)).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('un 5xx en la suscripción muestra ErrorState', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const cfg = new ConfigPage(page);
      await page.route('**/api/suscripcion**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
      await cfg.abrir();
      await cfg.seccion('Suscripción');
      await expect(page.getByText('No pudimos cargar la información')).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
