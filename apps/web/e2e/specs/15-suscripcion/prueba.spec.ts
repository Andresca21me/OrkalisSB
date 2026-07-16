import { test, expect } from '@playwright/test';
import { PASSWORD, USERS, loginUI } from '../../fixtures/roles';
import { reseed } from '../../fixtures/seed';
import { expirarPruebaPorEmail } from '../../fixtures/suscripcion';

/**
 * Plan-Pagos FASE-04/11 · Prueba de 15 días y recuperación de acceso.
 * El seed deja el SALÓN en `prueba` (trial vigente). Probamos:
 *  - con la prueba vigente: entra al panel y ve el banner de días restantes;
 *  - con la prueba vencida (simulada): NO entra al panel; obtiene una sesión
 *    limitada y aterriza en /recuperar con el aviso "Tu prueba terminó" y el CTA
 *    de pago (FASE-11).
 */
test.describe('Suscripción · prueba de 15 días', () => {
  test.beforeEach(() => {
    reseed();
  });

  test('en prueba: entra al panel y ve el banner de días restantes', async ({ page }) => {
    await loginUI(page, USERS.adminSalon);
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });

    const banner = page.getByTestId('trial-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('de prueba');
    await expect(banner.getByRole('button', { name: 'Agregar método de pago' })).toBeVisible();
  });

  test('prueba vencida: no entra al panel y aterriza en /recuperar para pagar', async ({ page }) => {
    // Simula que pasaron los 15 días.
    expirarPruebaPorEmail(USERS.adminSalon);

    await page.goto('/login');
    await page.locator('input[type="email"]').fill(USERS.adminSalon);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Sesión limitada (FASE-11): el router lleva a la pantalla de recuperación,
    // con el aviso de prueba vencida y el botón para pagar. No entra al panel.
    await expect(page).toHaveURL(/\/recuperar/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Tu prueba terminó' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar método y pagar' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/admin/);
  });
});
