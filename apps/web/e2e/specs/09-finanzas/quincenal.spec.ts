import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { negocioIdDe, setModuloApi } from '../../fixtures/api';
import { reseed } from '../../fixtures/seed';
import { FinanzasPage } from '../../pages/finanzas.page';

/**
 * FASE-09 v3 · Finanzas · Control quincenal y cierre (HU-ADM-011). El módulo de
 * cierre viene apagado por defecto (barbería): se verifica su ausencia y, al
 * encenderlo, ver la quincena y archivar el cierre. Es DESTRUCTIVO → reseed por
 * prueba.
 */
test.describe('Finanzas · control quincenal', () => {
  let api: APIRequestContext;
  let negocioId: string;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => {
    reseed();
    negocioId = await negocioIdDe(api, USERS.adminBarberia);
  });

  test('módulo de cierre apagado: la pestaña Control quincenal no aparece', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const fin = new FinanzasPage(s.adminBarberia.page);
      await fin.abrir();
      await expect(s.adminBarberia.page.getByText('Análisis financiero')).toBeVisible({ timeout: 15_000 });
      await expect(s.adminBarberia.page.getByRole('button', { name: 'Control quincenal', exact: true })).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('con cierre activo: ve la quincena y cierra el mes (archiva)', async ({ browser }) => {
    await setModuloApi(api, USERS.adminBarberia, negocioId, 'modulo.cierre_periodo', true);
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const fin = new FinanzasPage(page);
      await fin.abrir();
      await fin.subtab('Control quincenal');
      await expect(page.getByRole('heading', { name: 'Control quincenal' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Ingresos del período')).toBeVisible();
      await expect(page.getByText('Sin cierres')).toBeVisible(); // aún no hay cierres

      await fin.cerrarMes();
      // El cierre queda archivado en "Períodos cerrados".
      await expect(page.getByText('Sin cierres')).toHaveCount(0, { timeout: 15_000 });
      await expect(page.getByRole('cell', { name: 'mensual' })).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
