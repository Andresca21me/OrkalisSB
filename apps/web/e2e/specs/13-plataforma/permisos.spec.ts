import { test, expect } from '@playwright/test';
import { loginUI, USERS } from '../../fixtures/roles';

/**
 * FASE-13 v3 · Operador · Permisos (refuerzo RBAC): solo el operador accede a
 * `/plataforma`; un admin de tenant es redirigido a su panel y no ve la consola.
 */
test.describe('Plataforma · permisos', () => {
  test('un admin de tenant no accede a la consola de plataforma', async ({ page }) => {
    await loginUI(page, USERS.adminBarberia);
    await page.goto('/plataforma');
    // Protegido redirige al panel del rol; no se ve la consola del operador.
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Negocios' })).toHaveCount(0);
  });
});
