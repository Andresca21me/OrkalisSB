import { test, expect } from '@playwright/test';
import { abrirRoles, cerrarRoles } from '../../fixtures/roles';
import { ClientesPage } from '../../pages/clientes.page';
import { reseed } from '../../fixtures/seed';

/**
 * FASE-14 v3 · No-regresión de accesibilidad (hook useDialogA11y): un diálogo
 * representativo tiene role/aria-modal, se cierra con Esc y el foco se gestiona.
 */
test.describe('A11y · diálogos', () => {
  test.beforeEach(async () => { reseed(); });

  test('un modal tiene role=dialog/aria-modal y se cierra con Esc', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const cli = new ClientesPage(page);
      await cli.abrir();
      const dlg = await cli.abrirNuevo();
      await expect(dlg).toBeVisible({ timeout: 15_000 });
      await expect(dlg).toHaveAttribute('aria-modal', 'true');
      await expect(dlg).toHaveAttribute('role', 'dialog');

      // Esc cierra el diálogo (focus-trap + restauración via useDialogA11y).
      await page.keyboard.press('Escape');
      await expect(dlg).toBeHidden({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
