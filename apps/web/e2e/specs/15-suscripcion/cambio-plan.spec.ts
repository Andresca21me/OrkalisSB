import { test, expect } from '@playwright/test';
import { abrirRoles, cerrarRoles } from '../../fixtures/roles';
import { reseed } from '../../fixtures/seed';
import { ConfigPage } from '../../pages/config.page';

/**
 * Plan-Pagos B7 · Cambio de plan de punta a punta desde la UI (Config →
 * Suscripción). Se usa la BARBERÍA (cortesía, Premium, 2 sucursales): en cortesía
 * los cambios aplican SIN cobro, así que se ejercita el flujo completo
 * (comparación → preview → confirmar) sin depender del brick de Mercado Pago.
 */
test.describe('Suscripción · cambio de plan (UI)', () => {
  test.beforeEach(() => reseed());

  test('la comparación muestra los planes y marca el actual', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      await new ConfigPage(page).abrir();
      await new ConfigPage(page).seccion('Suscripción');
      await expect(page.getByRole('heading', { name: 'Planes' })).toBeVisible({ timeout: 15_000 });
      // El plan actual (Premium) no se puede "elegir" (botón En uso); otros sí.
      await expect(page.getByRole('button', { name: 'En uso' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cambiar a Empresarial' })).toBeVisible();
    } finally {
      await cerrarRoles(s);
    }
  });

  test('subir a Empresarial en cortesía: preview → confirmar → queda aplicado (sin cobro)', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      await new ConfigPage(page).abrir();
      await new ConfigPage(page).seccion('Suscripción');

      await page.getByRole('button', { name: 'Cambiar a Empresarial' }).click();
      const dlg = page.getByRole('dialog');
      await expect(dlg.getByRole('heading', { name: 'Subir de plan' })).toBeVisible({ timeout: 15_000 });
      // Mensaje de cortesía (no el de "lateral"): aplica sin cobro.
      await expect(dlg).toContainText('cortesía');
      await dlg.getByRole('button', { name: 'Confirmar cambio' }).click();
      await expect(dlg).toBeHidden({ timeout: 15_000 });

      // El cambio quedó aplicado: Empresarial pasa a ser el plan en uso.
      await expect(page.getByRole('button', { name: 'Cambiar a Empresarial' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Cambiar a Premium' })).toBeVisible();
    } finally {
      await cerrarRoles(s);
    }
  });

  test('bajar a Pro con 2 sucursales se rechaza con mensaje claro (no aplica)', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      await new ConfigPage(page).abrir();
      await new ConfigPage(page).seccion('Suscripción');

      await page.getByRole('button', { name: 'Cambiar a Pro' }).click();
      const dlg = page.getByRole('dialog');
      // El preview falla (Pro admite 1 sucursal; la barbería tiene 2) → aviso de error.
      await expect(dlg.getByRole('alert')).toContainText(/sucursal/i, { timeout: 15_000 });
      // Cierra (botón del footer, no la X) y confirma que NO se aplicó.
      await dlg.locator('button', { hasText: 'Cerrar' }).click();
      await expect(dlg).toBeHidden({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: 'Cambiar a Pro' })).toBeVisible();
    } finally {
      await cerrarRoles(s);
    }
  });
});
