import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles } from '../../fixtures/roles';
import { reseed } from '../../fixtures/seed';
import { ConfigPage } from '../../pages/config.page';
import { emailUnico, nombreUnico } from '../../fixtures/data';

/**
 * FASE-10 v3 · Config · Usuarios internos (RBAC): crear un usuario con login y
 * que pueda iniciar sesión; desactivarlo le impide entrar. Re-siembra por prueba.
 */
test.describe('Config · usuarios internos', () => {
  let api: APIRequestContext;
  const PASS = 'Recepcion2026!';

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => { reseed(); });

  const login = (email: string, password: string) =>
    api.post('/api/auth/login', { data: { email, password } });

  test('crear un recepcionista le permite iniciar sesión; desactivarlo lo impide', async ({ browser }) => {
    const email = emailUnico('recep');
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const cfg = new ConfigPage(s.adminBarberia.page);
      await cfg.abrir();
      await cfg.seccion('Usuarios');
      await cfg.crearUsuario({ nombre: nombreUnico('Recep'), email, password: PASS, rol: 'Recepcionista' });
      await expect(cfg.filaUsuario(email)).toBeVisible({ timeout: 15_000 });

      // El nuevo usuario puede iniciar sesión.
      const ok = await login(email, PASS);
      expect(ok.ok(), 'login del nuevo usuario').toBeTruthy();

      // Desactivarlo → ya no puede iniciar sesión.
      await cfg.desactivarUsuario(email);
      await expect(cfg.filaUsuario(email)).toContainText('Inactivo', { timeout: 15_000 });
      const fail = await login(email, PASS);
      expect(fail.ok(), 'login bloqueado tras desactivar').toBeFalsy();
    } finally {
      await cerrarRoles(s);
    }
  });
});
