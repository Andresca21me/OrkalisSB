import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { USERS } from '../../fixtures/roles';

/**
 * Aislamiento multi-tenant desde el front (FASE-11 v3, ADR-001 / RLS). Migrado
 * de la v2. La cobertura transversal completa (agenda, equipo, finanzas,
 * consolidado, negativo por id) se añade en la FASE-11.
 *   Barbería → Juan Pérez · Salón → Laura Castro.
 */
test.describe('Aislamiento multi-tenant', () => {
  test('barbería ve sus clientes y NO los del salón', async ({ page }) => {
    await new LoginPage(page).entrar(USERS.adminBarberia);
    await page.getByRole('navigation').getByRole('button', { name: 'Clientes' }).click();
    await expect(page.getByText('Juan Pérez')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Laura Castro')).toHaveCount(0);
  });

  test('salón ve sus clientes y NO los de la barbería', async ({ page }) => {
    await new LoginPage(page).entrar(USERS.adminSalon);
    await page.getByRole('navigation').getByRole('button', { name: 'Clientes' }).click();
    await expect(page.getByText('Laura Castro')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Juan Pérez')).toHaveCount(0);
  });
});
