import { test, expect } from '@playwright/test';
import { abrirRoles, cerrarRoles } from '../../fixtures/roles';
import { sucursalesDe, franjaLibre, serviciosPublicos } from '../../fixtures/api';
import { USERS } from '../../fixtures/roles';

/**
 * Humo del andamiaje (FASE-00 v3): verifica que los fixtures y el oráculo
 * funcionan antes de construir el resto de la suite.
 */
test.describe('Harness E2E', () => {
  test('multi-rol: dos sesiones independientes y logueadas', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia', 'especialista']);
    await expect(s.adminBarberia.page).toHaveURL(/\/admin/);
    await expect(s.especialista.page).toHaveURL(/\/especialista/);
    // Sesiones aisladas: cada contexto tiene su propio token.
    const tokenAdmin = await s.adminBarberia.page.evaluate(() => localStorage.getItem('orkalis_access'));
    const tokenEsp = await s.especialista.page.evaluate(() => localStorage.getItem('orkalis_access'));
    expect(tokenAdmin).toBeTruthy();
    expect(tokenEsp).toBeTruthy();
    expect(tokenAdmin).not.toBe(tokenEsp);
    await cerrarRoles(s);
  });

  test('oráculo: sucursales del seed y franja libre', async ({ request }) => {
    const sucursales = await sucursalesDe(request, USERS.adminBarberia);
    expect(sucursales.length).toBeGreaterThanOrEqual(2);
    expect(sucursales.some((x) => /centro/i.test(x.nombre))).toBeTruthy();
    expect(sucursales.some((x) => /norte/i.test(x.nombre))).toBeTruthy();

    const servicios = await serviciosPublicos(request, sucursales[0].id);
    const { fecha, franja } = await franjaLibre(request, sucursales[0].id, servicios[0].id);
    expect(fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(franja.especialistaId).toBeTruthy();
  });
});
