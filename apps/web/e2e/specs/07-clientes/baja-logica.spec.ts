import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { clientesDe, historialClienteApi } from '../../fixtures/api';
import { ClientesPage } from '../../pages/clientes.page';
import { reseed } from '../../fixtures/seed';

/**
 * FASE-07 v3 · CRM · Baja lógica (RF-036): inactivar saca al cliente del
 * directorio pero CONSERVA su historial (verificado por el oráculo, ya que el
 * directorio activo no muestra inactivos).
 */
test.describe('CRM · baja lógica', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => { reseed(); });

  test('inactivar saca del directorio y conserva el historial', async ({ browser }) => {
    // Juan Pérez (seed) tiene historial: ideal para probar que la baja lo conserva.
    const juan = (await clientesDe(api, USERS.adminBarberia)).find((c) => /juan/i.test(c.nombre))!;
    expect(juan.numServicios, 'el cliente tiene historial previo').toBeGreaterThan(0);

    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const cli = new ClientesPage(s.adminBarberia.page);
      await cli.abrir();
      await expect(cli.tarjeta(juan.id)).toBeVisible({ timeout: 15_000 });

      await cli.inactivar(juan.id);
      // Sale del directorio activo.
      await expect(cli.tarjeta(juan.id)).toHaveCount(0);
      // El historial se conserva (borrado lógico): mismas atenciones, inactivo.
      const hist = await historialClienteApi(api, USERS.adminBarberia, juan.id);
      expect(hist.numServicios).toBe(juan.numServicios);
      expect(hist.cliente.activo).toBe(false);
    } finally {
      await cerrarRoles(s);
    }
  });

  // Reactivar: no existe endpoint ni UI (GET /clientes solo lista activos, no hay
  // POST/PATCH de reactivación). Registrado como H-006 (escalado). Ver _MATRIZ §3.
  test.fixme('reactivar devuelve el cliente al directorio', async () => {
    // Pendiente: requiere endpoint/acción de reactivación.
  });
});
