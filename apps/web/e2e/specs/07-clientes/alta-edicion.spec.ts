import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { clientesDe } from '../../fixtures/api';
import { ClientesPage } from '../../pages/clientes.page';
import { reseed } from '../../fixtures/seed';
import { nombreUnico, telefonoUnico } from '../../fixtures/data';

/**
 * FASE-07 v3 · CRM · Alta, validación y edición (RF-034). Datos únicos para no
 * colisionar con el seed ni entre corridas.
 */
test.describe('CRM · alta y edición', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => { reseed(); });

  test('crea un cliente y aparece en el directorio', async ({ browser }) => {
    const nombre = nombreUnico('Cliente CRM');
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const cli = new ClientesPage(s.adminBarberia.page);
      await cli.abrir();
      await cli.crearCliente(nombre, telefonoUnico());

      const creado = (await clientesDe(api, USERS.adminBarberia, nombre))[0];
      expect(creado, 'el cliente existe en el directorio').toBeTruthy();
      await expect(cli.tarjeta(creado.id)).toBeVisible({ timeout: 15_000 });
      await expect(cli.tarjeta(creado.id)).toContainText(nombre);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('el formulario impide un nombre demasiado corto', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const cli = new ClientesPage(s.adminBarberia.page);
      await cli.abrir();
      const dlg = await cli.abrirNuevo();
      await dlg.getByLabel('Nombre completo').fill('A');
      await expect(dlg.getByRole('button', { name: 'Crear cliente' })).toBeDisabled();
    } finally {
      await cerrarRoles(s);
    }
  });

  test('edita un cliente y el cambio persiste', async ({ browser }) => {
    const inicial = nombreUnico('Cliente CRM');
    const editado = nombreUnico('Cliente Editado');
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const cli = new ClientesPage(s.adminBarberia.page);
      await cli.abrir();
      await cli.crearCliente(inicial, telefonoUnico());
      const id = (await clientesDe(api, USERS.adminBarberia, inicial))[0].id;

      await cli.editarCliente(id, editado);
      await expect(cli.tarjeta(id)).toContainText(editado, { timeout: 15_000 });
      // Persistencia real (no solo el estado en memoria): recarga y revalida.
      await cli.refrescar();
      await expect(cli.tarjeta(id)).toContainText(editado, { timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
