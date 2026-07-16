import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { USERS, loginAPI } from '../../fixtures/roles';
import { reseed } from '../../fixtures/seed';

/**
 * Cuenta suspendida en el login (HU-PLT-002 + Plan-Pagos FASE-11). Un tenant
 * suspendido NO entra al panel: obtiene una sesión limitada y el router lo lleva
 * a /recuperar para que pueda pagar y reactivarse.
 *
 * Suspende la Barbería antes y la reactiva después (fix-forward de estado del
 * seed): no debe quedar suspendida para otras fases.
 */
async function negocioIdBarberia(api: APIRequestContext): Promise<string> {
  const token = await loginAPI(api, USERS.operador);
  const res = await api.get('/api/plataforma/suscripciones', { headers: { Authorization: `Bearer ${token}` } });
  const lista = (await res.json()) as { negocioId: string; nombre: string }[];
  const barberia = lista.find((n) => /barber/i.test(n.nombre));
  expect(barberia, 'tenant Barbería en la lista del operador').toBeTruthy();
  return barberia!.negocioId;
}

async function cambiarEstado(api: APIRequestContext, negocioId: string, accion: 'suspender' | 'reactivar') {
  const token = await loginAPI(api, USERS.operador);
  const res = await api.post(`/api/plataforma/negocios/${negocioId}/${accion}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect([200, 204]).toContain(res.status());
}

test.describe.serial('Cuenta suspendida (login bloqueado)', () => {
  let api: APIRequestContext;
  let negocioId: string;

  test.beforeAll(async () => {
    reseed(); // estado base limpio (otras fases pudieron vencer la prueba del salón)
    api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' });
    negocioId = await negocioIdBarberia(api);
    await cambiarEstado(api, negocioId, 'suspender');
  });

  test.afterAll(async () => {
    await cambiarEstado(api, negocioId, 'reactivar'); // restaurar el seed
    await api.dispose();
  });

  test('el admin del tenant suspendido NO entra al panel y va a /recuperar', async ({ page }) => {
    const login = new LoginPage(page);
    await login.entrarConError(USERS.adminBarberia); // usa la contraseña correcta
    // Sesión limitada (FASE-11): aterriza en la pantalla de recuperación de acceso.
    await expect(page).toHaveURL(/\/recuperar/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Reactiva tu cuenta' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pagar ahora' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test('la suspensión de la barbería NO afecta al salón', async ({ page }) => {
    await new LoginPage(page).entrar(USERS.adminSalon);
    await expect(page).toHaveURL(/\/admin/);
  });
});
