import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { analisisApi } from '../../fixtures/api';
import { reseed } from '../../fixtures/seed';
import { FinanzasPage } from '../../pages/finanzas.page';
import { nombreUnico, hoyISO } from '../../fixtures/data';

/**
 * FASE-09 v3 · Finanzas · Gastos (HU-ADM-008): alta de gasto fijo/variable,
 * eliminación (borrado lógico) y reflejo en la ganancia neta del período
 * (flujo cruzado gasto → análisis). Re-siembra por prueba.
 */
test.describe('Finanzas · gastos', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => { reseed(); });

  const rangoMes = () => {
    const ymd = hoyISO();
    return { desde: `${ymd.slice(0, 8)}01T00:00:00.000Z`, hasta: new Date(Date.now() + 86_400_000).toISOString() };
  };

  test('registra un gasto fijo y reduce la ganancia neta del período', async ({ browser }) => {
    const categoria = nombreUnico('Arriendo');
    const { desde, hasta } = rangoMes();
    const antes = await analisisApi(api, USERS.adminBarberia, desde, hasta);

    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const fin = new FinanzasPage(page);
      await fin.abrir();
      await expect(page.getByRole('heading', { name: 'Resumen financiero' })).toBeVisible({ timeout: 15_000 });
      await fin.agregarGasto('fijo', 90000, categoria);

      // Aparece en el desglose del período y en los fijos programados.
      await expect(page.getByText(categoria).first()).toBeVisible({ timeout: 15_000 });
      const diaBogota = Number(new Date(Date.now() - 5 * 3600_000).toISOString().slice(8, 10));
      await expect(page.getByText(`Cada mes, el día ${diaBogota}`).first()).toBeVisible();
      // Cruzado: el análisis refleja más gasto fijo y menos ganancia neta.
      const despues = await analisisApi(api, USERS.adminBarberia, desde, hasta);
      expect(despues.gastosFijos).toBeGreaterThanOrEqual(antes.gastosFijos + 90000);
      expect(despues.gananciaNeta).toBeLessThan(antes.gananciaNeta);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('registra un gasto variable', async ({ browser }) => {
    const categoria = nombreUnico('Insumos');
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const fin = new FinanzasPage(page);
      await fin.abrir();
      await expect(page.getByRole('heading', { name: 'Resumen financiero' })).toBeVisible({ timeout: 15_000 });
      await fin.agregarGasto('variable', 30000, categoria);
      await expect(page.getByText(categoria).first()).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });

  test('eliminar un gasto lo retira del período', async ({ browser }) => {
    const categoria = nombreUnico('GastoBorrar');
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const fin = new FinanzasPage(page);
      await fin.abrir();
      await expect(page.getByRole('heading', { name: 'Resumen financiero' })).toBeVisible({ timeout: 15_000 });
      await fin.agregarGasto('fijo', 40000, categoria);
      await expect(page.getByText(categoria).first()).toBeVisible({ timeout: 15_000 });

      // Papelera del fijo programado (accesible por su categoría).
      await page.getByRole('button', { name: `Eliminar ${categoria}` }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('button', { name: 'Eliminar', exact: true }).click();
      await expect(dlg).toBeHidden({ timeout: 15_000 });
      // Recién creado y borrado el mismo día: desaparece también del desglose.
      await expect(page.getByText(categoria)).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });
});
