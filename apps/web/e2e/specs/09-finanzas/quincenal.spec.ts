import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { negocioIdDe, setModuloApi } from '../../fixtures/api';
import { reseed } from '../../fixtures/seed';
import { FinanzasPage } from '../../pages/finanzas.page';

/**
 * Plan-Finanzas F6 · Cierre de período (HU-ADM-011). El módulo viene apagado
 * por defecto (barbería): se verifica su ausencia y, al encenderlo, cerrar el
 * mes archiva el snapshot completo y el anti-solape bloquea repetirlo.
 * DESTRUCTIVO → reseed por prueba.
 */
test.describe('Finanzas · cierre de período', () => {
  let api: APIRequestContext;
  let negocioId: string;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => {
    reseed();
    negocioId = await negocioIdDe(api, USERS.adminBarberia);
  });

  test('módulo de cierre apagado: la pestaña Cierre de período no aparece', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const fin = new FinanzasPage(s.adminBarberia.page);
      await fin.abrir();
      await expect(s.adminBarberia.page.getByRole('heading', { name: 'Resumen financiero' })).toBeVisible({ timeout: 15_000 });
      await expect(s.adminBarberia.page.getByRole('button', { name: 'Cierre de período', exact: true })).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('con cierre activo: cierra el mes (archiva) y el período queda protegido contra el doble cierre', async ({ browser }) => {
    await setModuloApi(api, USERS.adminBarberia, negocioId, 'modulo.cierre_periodo', true);
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const fin = new FinanzasPage(page);
      await fin.abrir();
      await fin.subtab('Cierre de período');
      await expect(page.getByRole('heading', { name: 'Cierre de período' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Ingresos del período')).toBeVisible();
      await expect(page.getByText('Aún no has cerrado ningún período')).toBeVisible();

      await fin.cerrarMes();
      // El cierre queda archivado con su tipo correcto…
      await expect(page.getByText('Aún no has cerrado ningún período')).toHaveCount(0, { timeout: 15_000 });
      await expect(page.getByText('Mensual', { exact: true })).toBeVisible({ timeout: 15_000 });
      // …y el período pasa a estar protegido: no se puede cerrar dos veces.
      await expect(page.getByText('Este período ya tiene cierre')).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
