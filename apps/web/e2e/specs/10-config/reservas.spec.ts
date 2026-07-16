import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe } from '../../fixtures/api';
import { reseed } from '../../fixtures/seed';

/**
 * Configuración · Reservas: por cada sucursal, el admin ve el enlace público de
 * reserva (`/reservar/:sucursalId`) y su código QR, con acción de descarga del
 * QR para imprimir. (Funcionalidad agregada antes de FASE-07.)
 */
test.describe('Config · enlaces y QR de reserva', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => { reseed(); });

  async function irAReservas(page: import('@playwright/test').Page) {
    // Configuración vive en el menú de perfil del admin.
    await page.getByRole('button', { name: /Admin Barbería/ }).click();
    await page.getByRole('menuitem', { name: 'Configuración' }).click();
    await page.getByRole('button', { name: 'Reservas', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Enlaces y QR de reserva' })).toBeVisible({ timeout: 15_000 });
  }

  test('muestra enlace y QR por sucursal y permite descargar el QR', async ({ browser }) => {
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      await irAReservas(page);

      // Una tarjeta por sucursal, con el enlace público correcto.
      for (const suc of sucursales) {
        const card = page.getByTestId(`reserva-suc-${suc.id}`);
        await expect(card).toBeVisible();
        await expect(card.getByTestId('reserva-enlace')).toContainText(`/reservar/${suc.id}`);
        await expect(card.getByRole('img', { name: /Código QR/ })).toBeVisible();
      }

      // Descargar el QR de la primera sucursal dispara una descarga .png.
      const primera = page.getByTestId(`reserva-suc-${sucursales[0].id}`);
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        primera.getByRole('button', { name: 'Descargar QR' }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/reserva-.*-qr\.png/);
    } finally {
      await cerrarRoles(s);
    }
  });
});
