import { test, expect, type Page } from '@playwright/test';
import { loginUI, USERS, PASSWORD } from '../../fixtures/roles';

/**
 * Tutorial guiado del panel (onboarding). Auto-abre en el primer ingreso, avanza
 * con "Siguiente" (cambiando de sección), se puede saltar y el botón de ayuda lo
 * reabre. La barbería del seed está en cortesía (tiene acceso al panel).
 */

/** Login por UI SIN sembrar la marca del tour (para probar el auto-inicio). */
async function loginSinMarca(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/admin/, { timeout: 20_000 });
}

test.describe('Onboarding · tutorial guiado', () => {
  test('auto-abre en el primer ingreso y avanza con Siguiente (cambia de sección)', async ({ page }) => {
    await loginSinMarca(page, USERS.adminBarberia);

    const tour = page.getByRole('dialog', { name: 'Tutorial' });
    await expect(tour).toBeVisible({ timeout: 15_000 });
    await expect(tour.getByRole('heading', { name: /Bienvenido a Orkalis/ })).toBeVisible();

    await tour.getByRole('button', { name: 'Siguiente' }).click();
    await expect(tour.getByRole('heading', { name: 'Tu sede activa' })).toBeVisible();

    await tour.getByRole('button', { name: 'Siguiente' }).click(); // Panel
    await tour.getByRole('button', { name: 'Siguiente' }).click(); // Agenda
    await expect(tour.getByRole('heading', { name: 'Agenda' })).toBeVisible();
    // El paso de Agenda cambió la sección: el título de la pantalla aparece detrás.
    await expect(page.getByRole('heading', { name: 'Agenda' }).first()).toBeVisible();

    // Atrás vuelve al paso anterior.
    await tour.getByRole('button', { name: 'Atrás' }).click();
    await expect(tour.getByRole('heading', { name: 'Panel' })).toBeVisible();
  });

  test('no reaparece tras verlo; el botón de ayuda lo reabre y se puede saltar', async ({ page }) => {
    await loginUI(page, USERS.adminBarberia); // loginUI marca el tour como visto → no auto-abre
    await expect(page.getByRole('dialog', { name: 'Tutorial' })).toHaveCount(0);

    // El botón de ayuda lo reabre.
    await page.locator('[data-tour="ayuda"]').click();
    const tour = page.getByRole('dialog', { name: 'Tutorial' });
    await expect(tour).toBeVisible({ timeout: 15_000 });

    // "Saltar" (botón del pie, no la X "Saltar tutorial") lo cierra.
    await tour.getByRole('button', { name: 'Saltar', exact: true }).click();
    await expect(tour).toBeHidden();
  });
});
