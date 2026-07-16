import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { USERS } from '../../fixtures/roles';

/**
 * Login + enrutado por rol (FASE-01 v3, ADR-003 RBAC). Migrado y adaptado de la
 * v2 a los Page Objects. La cobertura profunda (refresh, guardas, suspendida)
 * se añade en la FASE-01.
 */
test.describe('Auth y enrutado por rol', () => {
  test('admin → panel de administración', async ({ page }) => {
    await new LoginPage(page).entrar(USERS.adminBarberia);
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Agenda' })).toBeVisible();
  });

  test('operador de plataforma → consola de negocios', async ({ page }) => {
    await new LoginPage(page).entrar(USERS.operador);
    await expect(page).toHaveURL(/\/plataforma/);
    await expect(page.getByRole('heading', { name: 'Negocios' })).toBeVisible();
  });

  test('recepción → panel de recepción', async ({ page }) => {
    await new LoginPage(page).entrar(USERS.recepcion);
    await expect(page).toHaveURL(/\/recepcion/);
  });

  test('especialista → app del especialista', async ({ page }) => {
    await new LoginPage(page).entrar(USERS.especialista);
    await expect(page).toHaveURL(/\/especialista/);
  });

  test('credenciales inválidas → mensaje de error, sigue en login', async ({ page }) => {
    const login = new LoginPage(page);
    await login.entrarConError(USERS.adminBarberia, 'clave-incorrecta');
    await expect(login.errorVisible).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
