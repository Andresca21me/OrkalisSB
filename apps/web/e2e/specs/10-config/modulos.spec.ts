import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles } from '../../fixtures/roles';
import { reseed } from '../../fixtures/seed';
import { ConfigPage } from '../../pages/config.page';
import { GestionPage } from '../../pages/gestion.page';

/**
 * FASE-10 v3 · Config · Módulos (HU-ADM-003): activar/desactivar un módulo desde
 * Configuración cambia la UI en TODA la app (Gestión, liquidación). Destructiva
 * (cambia config) → reseed por prueba.
 */
test.describe('Config · módulos', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => { reseed(); });

  test('activar/desactivar inventario aparece/oculta la pestaña en Gestión', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const cfg = new ConfigPage(page);
      const g = new GestionPage(page);

      // Por defecto OFF en barbería: activarlo.
      await cfg.abrir();
      await cfg.seccion('Módulos');
      expect(await cfg.moduloActivo('modulo.inventario')).toBe(false);
      await cfg.toggleModulo('modulo.inventario');
      await expect(cfg.moduloSwitch('modulo.inventario')).toHaveAttribute('aria-checked', 'true');

      // Ahora Gestión muestra la pestaña Inventario.
      await g.abrir();
      await expect(page.getByRole('button', { name: 'Inventario', exact: true })).toBeVisible({ timeout: 15_000 });

      // Desactivarlo de nuevo → la pestaña desaparece.
      await cfg.abrir();
      await cfg.seccion('Módulos');
      await cfg.toggleModulo('modulo.inventario');
      await expect(cfg.moduloSwitch('modulo.inventario')).toHaveAttribute('aria-checked', 'false');
      await g.abrir();
      await expect(page.getByRole('button', { name: 'Inventario', exact: true })).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('desactivar partición oculta la liquidación en Equipo', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const cfg = new ConfigPage(page);
      const g = new GestionPage(page);

      await cfg.abrir();
      await cfg.seccion('Módulos');
      expect(await cfg.moduloActivo('modulo.particion_por_especialista')).toBe(true);
      await cfg.toggleModulo('modulo.particion_por_especialista');
      await expect(cfg.moduloSwitch('modulo.particion_por_especialista')).toHaveAttribute('aria-checked', 'false');

      await g.abrir();
      await g.subtab('Equipo');
      await expect(page.getByRole('button', { name: 'Liquidación', exact: true })).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });
});
