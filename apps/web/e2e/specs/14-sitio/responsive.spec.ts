import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { loginUI, USERS } from '../../fixtures/roles';
import { sucursalesDe } from '../../fixtures/api';
import { AdminAgendaPage } from '../../pages/agenda.page';
import { reseed } from '../../fixtures/seed';

/**
 * FASE-14 v3 · No-regresión responsive (RNF-003): sin scroll horizontal
 * accidental en anchos clave; el nav de marketing colapsa a hamburguesa en móvil.
 */
const ANCHOS = [360, 768, 1024, 1280, 1440];

async function sinScrollHorizontal(page: import('@playwright/test').Page) {
  // Tolerancia de 2px por bordes/subpíxeles.
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2);
}

test.describe('Responsive · sin scroll horizontal', () => {
  let api: APIRequestContext;
  let centroId: string;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' });
    reseed();
    centroId = (await sucursalesDe(api, USERS.adminBarberia)).find((s) => /centro/i.test(s.nombre))!.id;
  });
  test.afterAll(async () => { await api.dispose(); });

  test('login y reserva pública no desbordan en anchos clave', async ({ page }) => {
    for (const w of ANCHOS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/login');
      await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 });
      expect(await sinScrollHorizontal(page), `login @${w}px sin scroll horizontal`).toBeTruthy();
    }
    // Reserva pública (móvil) a 360px.
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto(`/reservar/${centroId}`);
    await page.waitForLoadState('networkidle');
    expect(await sinScrollHorizontal(page), 'reserva @360px sin scroll horizontal').toBeTruthy();
  });

  test('la agenda admin no desborda en escritorio', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginUI(page, USERS.adminBarberia);
    const admin = new AdminAgendaPage(page);
    await admin.abrir();
    expect(await sinScrollHorizontal(page), 'agenda admin @1280px sin scroll horizontal').toBeTruthy();
  });

  test('el panel admin es responsive: ninguna sección desborda en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginUI(page, USERS.adminBarberia); // barbería (cortesía) tiene acceso
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    expect(await sinScrollHorizontal(page), 'panel @390px sin scroll horizontal').toBeTruthy();

    // Recorre las secciones del nav por el drawer móvil (hamburguesa).
    for (const seccion of ['Agenda', 'Clientes', 'Gestión', 'Finanzas']) {
      await page.getByRole('button', { name: 'Menú' }).click();
      await page.locator('.ork-tn-drawer').getByRole('button', { name: seccion, exact: true }).click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      expect(await sinScrollHorizontal(page), `${seccion} @390px sin scroll horizontal`).toBeTruthy();
    }
  });

  test('los paneles de recepción, especialista y plataforma son responsive en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const rol of ['recepcion', 'especialista', 'operador'] as const) {
      // Cierra la sesión anterior antes de entrar con otro rol.
      await page.goto('/login');
      await page.evaluate(() => localStorage.clear());
      await loginUI(page, USERS[rol]);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      expect(await sinScrollHorizontal(page), `panel ${rol} @390px sin scroll horizontal`).toBeTruthy();
    }
  });

  test('el nav de marketing colapsa a hamburguesa en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Menú' })).toBeVisible({ timeout: 15_000 });
  });

  test('la landing (hero, showcase, banda lifestyle, marquee) no desborda en ningún ancho', async ({ page }) => {
    for (const w of ANCHOS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      // Baja hasta el final para forzar el render de todas las secciones reveladas.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      expect(await sinScrollHorizontal(page), `landing @${w}px sin scroll horizontal`).toBeTruthy();
    }
  });
});
