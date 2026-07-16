import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { suscripcionesPlataformaApi, cambiarEstadoTenantApi } from '../../fixtures/api';
import { LoginPage } from '../../pages/login.page';
import { reseed } from '../../fixtures/seed';

/**
 * FASE-13 v3 · Operador · Suspender/reactivar (HU-PLT-002, flujo cruzado): el
 * operador suspende la barbería desde la consola → su login queda bloqueado (el
 * salón no se ve afectado); al reactivarla, el acceso se restaura. Deja el
 * entorno limpio (red de seguridad en afterAll).
 */
test.describe('Plataforma · suspender y reactivar', () => {
  let api: APIRequestContext;
  let barberiaId: string;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' });
    reseed();
    barberiaId = (await suscripcionesPlataformaApi(api, USERS.operador)).find((t) => /barber/i.test(t.nombre))!.negocioId;
  });
  test.afterAll(async () => {
    // Red de seguridad: asegura que la barbería quede reactivada.
    await cambiarEstadoTenantApi(api, USERS.operador, barberiaId, 'reactivar').catch(() => {});
    await api.dispose();
  });

  test('suspender bloquea el login del tenant; reactivar lo restaura (aislado del salón)', async ({ browser }) => {
    const s = await abrirRoles(browser, ['operador']);
    try {
      const page = s.operador.page;
      const fila = page.getByTestId(`tenant-row-${barberiaId}`);
      await expect(fila).toBeVisible({ timeout: 15_000 });

      // Suspender desde la consola (con confirmación).
      await fila.getByRole('button', { name: 'Acciones' }).click();
      await page.getByRole('menuitem', { name: 'Suspender' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Sí, suspender' }).click();
      await expect(fila).toContainText('Suspendida', { timeout: 15_000 });

      // Cruzado: el admin de la barbería NO entra al panel; va a /recuperar (FASE-11).
      const ctxBarb = await browser.newContext();
      const pageBarb = await ctxBarb.newPage();
      await new LoginPage(pageBarb).entrarConError(USERS.adminBarberia);
      await expect(pageBarb).toHaveURL(/\/recuperar/, { timeout: 15_000 });
      await expect(pageBarb.getByRole('heading', { name: 'Reactiva tu cuenta' })).toBeVisible();
      await ctxBarb.close();

      // Aislamiento: el admin del salón sí entra.
      const ctxSal = await browser.newContext();
      const pageSal = await ctxSal.newPage();
      await new LoginPage(pageSal).entrar(USERS.adminSalon);
      await expect(pageSal).toHaveURL(/\/admin/, { timeout: 15_000 });
      await ctxSal.close();

      // Reactivar desde la consola.
      await fila.getByRole('button', { name: 'Acciones' }).click();
      await page.getByRole('menuitem', { name: 'Reactivar' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Sí, reactivar' }).click();
      await expect(fila).toContainText('Activa', { timeout: 15_000 });

      // El admin de la barbería ahora sí entra (datos intactos).
      const ctxBarb2 = await browser.newContext();
      const pageBarb2 = await ctxBarb2.newPage();
      await new LoginPage(pageBarb2).entrar(USERS.adminBarberia);
      await expect(pageBarb2).toHaveURL(/\/admin/, { timeout: 15_000 });
      await ctxBarb2.close();
    } finally {
      await cerrarRoles(s);
    }
  });
});
