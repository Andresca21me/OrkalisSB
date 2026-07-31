import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { reseed } from '../../fixtures/seed';
import { FinanzasPage } from '../../pages/finanzas.page';

/**
 * FASE-09 v3 · Finanzas · Análisis (HU-ADM-010 soporte): indicadores coherentes
 * (COP es-CO, sin NaN), período/sucursal sin datos no rompe, y export CSV.
 */
test.describe('Finanzas · análisis', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => { reseed(); });

  test('muestra ingresos, gastos, ganancia neta y margen coherentes', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const fin = new FinanzasPage(page);
      await fin.abrir(); // arranca en Análisis (consolidado, con datos del seed)
      await expect(page.getByRole('heading', { name: 'Resumen financiero' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Total gastos')).toBeVisible();
      await expect(page.getByText('Ingresos del salón').first()).toBeVisible();
      await expect(page.getByText('Ganancia neta').first()).toBeVisible();
      await expect(page.getByText(/Margen de utilidad/)).toBeVisible();
      await expect(page.getByText(/NaN/)).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('una sede sin movimientos muestra el estado vacío (sin romper)', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const fin = new FinanzasPage(page);
      await fin.abrir();
      await fin.elegirVista('Sede Norte'); // Norte no tiene atenciones ni gastos en el seed
      await expect(page.getByText('Sin movimientos en el período')).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });

  test('exporta el análisis a CSV', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const fin = new FinanzasPage(s.adminBarberia.page);
      await fin.abrir();
      await expect(s.adminBarberia.page.getByRole('heading', { name: 'Resumen financiero' })).toBeVisible({ timeout: 15_000 });
      const dl = await fin.exportarCsv('CSV');
      expect(dl.suggestedFilename()).toMatch(/analisis-.*\.csv/);
    } finally {
      await cerrarRoles(s);
    }
  });
});
