import { test, expect } from '@playwright/test';
import { abrirRoles, cerrarRoles } from '../../fixtures/roles';
import { reseed } from '../../fixtures/seed';

/**
 * FASE-06 v3 · Admin · Panel/dashboard (HU-ADM-012, soporte): KPIs del día,
 * resumen del mes y citas de hoy con datos del seed; valores coherentes (sin
 * NaN) y estado de error de la lista de citas. Re-siembra por prueba.
 */
test.describe('Admin · panel', () => {
  test.beforeEach(async () => { reseed(); });

  test('muestra KPIs, resumen del mes y citas de hoy (coherentes)', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      // KPIs del día.
      await expect(page.getByText('Citas hoy')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Ingresos estimados de hoy')).toBeVisible();
      await expect(page.getByText('Especialistas activos')).toBeVisible();
      await expect(page.getByText('Próxima cita')).toBeVisible();
      // Resumen del mes y lista de citas de hoy.
      await expect(page.getByText(/Resumen del mes/)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Citas de hoy' })).toBeVisible();
      // El seed tiene citas hoy → al menos una fila.
      await expect(page.locator('[data-testid^="appt-row-"]').first()).toBeVisible({ timeout: 15_000 });
      // Ningún valor roto: el token "NaN" (mayúsculas exactas) no debe aparecer.
      // (Regex sensible a mayúsculas: evita falsos positivos con "fiNANzas"/"gaNANcias".)
      await expect(page.getByText(/NaN/)).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('un 5xx en citas del día muestra ErrorState con reintento', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      await page.route('**/api/citas?**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
      await page.reload();
      await expect(page.getByText('No pudimos cargar la información')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    } finally {
      await cerrarRoles(s);
    }
  });
});
