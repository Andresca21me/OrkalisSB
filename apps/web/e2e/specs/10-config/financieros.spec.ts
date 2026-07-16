import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles } from '../../fixtures/roles';
import { reseed } from '../../fixtures/seed';
import { ConfigPage } from '../../pages/config.page';

/**
 * FASE-10 v3 · Config · Parámetros financieros y herencia (HU-ADM-004): la
 * repartición profesional/salón siempre suma 100% (autobalance) y una sucursal
 * sin override hereda el valor del negocio. Destructiva → reseed por prueba.
 */
test.describe('Config · financieros', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => { reseed(); });

  test('la repartición profesional/salón se mantiene en 100% (autobalance)', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const cfg = new ConfigPage(s.adminBarberia.page);
      await cfg.abrir();
      await cfg.seccion('Financieros');
      await cfg.fijarReparticionProfesional(70);
      // El salón se ajusta automáticamente a 30 → 70 + 30 = 100 (no admite 70 + 40).
      await expect(cfg.salonValue()).toHaveValue('30');
    } finally {
      await cerrarRoles(s);
    }
  });

  test('una sucursal sin override hereda la repartición del negocio', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const cfg = new ConfigPage(page);
      await cfg.abrir();
      await cfg.seccion('Financieros');

      // Fija 65/35 a nivel de negocio y guarda.
      await cfg.fijarReparticionProfesional(65);
      await cfg.guardarFinancieros();
      await expect(page.getByText('Parámetros financieros guardados')).toBeVisible({ timeout: 15_000 });

      // En el ámbito de sucursal (sin override) se ve el valor heredado: 65.
      await cfg.ambito('sucursal');
      await expect(cfg.profInput()).toHaveValue('65', { timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
