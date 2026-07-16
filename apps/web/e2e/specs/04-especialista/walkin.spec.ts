import { test, expect } from '@playwright/test';
import { loginUI, USERS } from '../../fixtures/roles';
import { SpecAgendaPage } from '../../pages/agenda.page';
import { reseed } from '../../fixtures/seed';

/**
 * Walk-in y atención retroactiva del especialista (FASE-04 v3, HU-ESP-006/007).
 */
test.describe('Especialista · walk-in y retroactiva', () => {
  test.beforeAll(() => reseed());

  test('walk-in en vivo inicia una atención (en progreso)', async ({ page }) => {
    await loginUI(page, USERS.especialista);
    const spec = new SpecAgendaPage(page);
    await spec.walkinVivo('Corte');
    await expect(page.getByText('Atención iniciada')).toBeVisible({ timeout: 10_000 });
  });

  test('atención retroactiva válida queda registrada (completada)', async ({ page }) => {
    await loginUI(page, USERS.especialista);
    const spec = new SpecAgendaPage(page);
    await spec.walkinRetro('Corte', '09:00', '09:40', 'Efectivo');
    await expect(page.getByText('Atención registrada')).toBeVisible({ timeout: 10_000 });
  });

  test('atención retroactiva con horas inválidas muestra error', async ({ page }) => {
    await loginUI(page, USERS.especialista);
    const spec = new SpecAgendaPage(page);
    await spec.irAWalkin();
    await page.getByText('Atención pasada').click();
    await spec.elegirServicioWalkin('Corte');
    await page.getByPlaceholder('14:00').fill('10:00');
    await page.getByPlaceholder('14:40').fill('09:00'); // fin antes del inicio
    await expect(page.getByText('La hora de fin debe ser posterior al inicio.')).toBeVisible({ timeout: 10_000 });
  });
});
