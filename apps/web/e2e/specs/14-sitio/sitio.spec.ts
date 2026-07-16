import { test, expect } from '@playwright/test';

/**
 * FASE-14 v3 · Sitio de marketing (RNF-005): navegación, precios, calculadora
 * (lógica de cliente), comparativa y funnel como maqueta (sin transacción).
 * El sitio es estático/cliente — no requiere seed ni login.
 */
test.describe('Sitio · marketing', () => {
  test('navegación entre secciones', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation');
    await nav.getByRole('button', { name: 'Precios', exact: true }).click();
    await expect(page).toHaveURL(/\/precios/);
    await expect(page.getByText('Un precio claro, por especialista')).toBeVisible({ timeout: 15_000 });
    await nav.getByRole('button', { name: 'Comparar', exact: true }).click();
    await expect(page).toHaveURL(/\/comparativa/);
    await expect(page.getByText('Compara los planes en detalle')).toBeVisible({ timeout: 15_000 });
  });

  test('precios muestra los planes y sus tarifas', async ({ page }) => {
    await page.goto('/precios');
    await expect(page.getByText('Un precio claro, por especialista')).toBeVisible({ timeout: 15_000 });
    for (const plan of ['Básico', 'Pro', 'Premium']) {
      await expect(page.getByText(plan, { exact: true }).first()).toBeVisible();
    }
    // Las tarjetas de plan muestran un precio en COP (el monto varía con el nº de especialistas).
    await expect(page.getByText(/\$\s?\d/).first()).toBeVisible();
  });

  test('la calculadora recalcula con la fórmula base + adicionales', async ({ page }) => {
    await page.goto('/calculadora');
    // Default del funnel: Pro + 4 especialistas → 130.000 + (4−2)·18.000 = 166.000.
    await expect(page.getByTestId('calc-total')).toContainText('166.000', { timeout: 15_000 });

    // Cambiar a Básico: 80.000 + (4−2)·15.000 = 110.000.
    await page.getByTestId('calc-plan-basico').click();
    await expect(page.getByTestId('calc-total')).toContainText('110.000');

    // Sumar un especialista (5): 80.000 + (5−2)·15.000 = 125.000.
    await page.getByTestId('calc-especialistas-mas').click();
    await expect(page.getByTestId('calc-especialistas-valor')).toHaveText('5');
    await expect(page.getByTestId('calc-total')).toContainText('125.000');
  });

  test('la comparativa renderiza la matriz de funciones sin errores', async ({ page }) => {
    await page.goto('/comparativa');
    await expect(page.getByText('Compara los planes en detalle')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Agenda en vivo por especialista').first()).toBeVisible();
  });

  test('el funnel de alta es una maqueta visual (no procesa cobro)', async ({ page }) => {
    await page.goto('/alta');
    // Carga la pantalla de alta sin romper; es maqueta (sin transacción real).
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await page.goto('/checkout');
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/NaN/)).toHaveCount(0);
  });
});
