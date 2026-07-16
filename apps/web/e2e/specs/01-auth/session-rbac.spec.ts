import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { USERS } from '../../fixtures/roles';

/**
 * Sesión, refresh, logout y guardas de ruta por rol (FASE-01 v3, ADR-003).
 */
test.describe('Sesión y RBAC', () => {
  test('la sesión persiste al recargar', async ({ page }) => {
    await new LoginPage(page).entrar(USERS.adminBarberia);
    await expect(page).toHaveURL(/\/admin/);
    await page.reload();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Agenda' })).toBeVisible();
  });

  test('refresh transparente: access caducado no expulsa (se renueva con el refresh)', async ({ page }) => {
    await new LoginPage(page).entrar(USERS.adminBarberia);
    // Corromper SOLO el access token; el refresh sigue válido.
    const accessPrevio = await page.evaluate(() => {
      const malo = 'invalid.access.token';
      localStorage.setItem('orkalis_access', malo);
      return malo;
    });
    await page.reload(); // bootstrap llama /auth/me → 401 → refresh → reintento OK
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Agenda' })).toBeVisible();
    const accessNuevo = await page.evaluate(() => localStorage.getItem('orkalis_access'));
    expect(accessNuevo).toBeTruthy();
    expect(accessNuevo).not.toBe(accessPrevio);
  });

  test('logout limpia la sesión y vuelve a /login', async ({ page }) => {
    await new LoginPage(page).entrar(USERS.adminBarberia);
    await page.getByRole('button', { name: /Admin Barber/i }).click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    const tokens = await page.evaluate(() => [localStorage.getItem('orkalis_access'), localStorage.getItem('orkalis_refresh')]);
    expect(tokens).toEqual([null, null]);
  });

  test('guarda de ruta: un especialista no entra a /admin', async ({ page }) => {
    await new LoginPage(page).entrar(USERS.especialista);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/especialista/); // redirigido a su panel
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test('guarda de ruta: un admin no entra a /plataforma', async ({ page }) => {
    await new LoginPage(page).entrar(USERS.adminBarberia);
    await page.goto('/plataforma');
    await expect(page).toHaveURL(/\/admin/);
  });

  test('sin sesión: una ruta protegida redirige a /login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sin sesión: la raíz muestra el sitio público, no un panel', async ({ page }) => {
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/(admin|especialista|recepcion|plataforma)/);
    await expect(page.getByText(/Orkalis/i).first()).toBeVisible();
  });

  test('con sesión: ir a /login redirige al panel del rol', async ({ page }) => {
    await new LoginPage(page).entrar(USERS.adminBarberia);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/admin/);
  });

  test('campos vacíos: enviar no navega y permanece en login', async ({ page }) => {
    const login = new LoginPage(page);
    await login.ir();
    await login.enviar();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('mostrar/ocultar contraseña', async ({ page }) => {
    const login = new LoginPage(page);
    await login.ir();
    const pass = page.locator('input[type="password"]');
    await pass.fill('secreto123');
    await page.getByRole('button', { name: 'Mostrar' }).click();
    await expect(page.locator('input[type="text"]').last()).toHaveValue('secreto123');
    await page.getByRole('button', { name: 'Ocultar' }).click();
    await expect(page.locator('input[type="password"]')).toHaveValue('secreto123');
  });
});
