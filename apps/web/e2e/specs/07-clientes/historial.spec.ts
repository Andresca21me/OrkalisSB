import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { clientesDe, sucursalesDe, serviciosPublicos, especialistasPublicos, crearCitaInterna, accionCitaApi, completarCitaApi } from '../../fixtures/api';
import { ClientesPage } from '../../pages/clientes.page';
import { reseed } from '../../fixtures/seed';
import { nombreUnico, telefonoUnico, hoyISO } from '../../fixtures/data';

/**
 * FASE-07 v3 · CRM · Historial y métricas (flujo cruzado atención→CRM): el
 * historial refleja las atenciones (seed y nuevas) y los agregados; un cliente
 * sin servicios muestra su vacío.
 */
test.describe('CRM · historial', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => { reseed(); });

  test('el historial refleja las atenciones del seed con sus datos', async ({ browser }) => {
    const juan = (await clientesDe(api, USERS.adminBarberia)).find((c) => /juan/i.test(c.nombre))!;
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const cli = new ClientesPage(s.adminBarberia.page);
      await cli.abrir();
      const dlg = await cli.abrirHistorial(juan.id);
      // Tantas filas como servicios del cliente, y los agregados en el subtítulo.
      await expect(dlg.locator('[data-testid^="historial-visita-"]')).toHaveCount(juan.numServicios);
      await expect(dlg).toContainText(`${juan.numServicios} servicios`);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('una atención nueva se refleja en el historial y las métricas', async ({ browser }) => {
    // Cliente nuevo (sin historial).
    const nombre = nombreUnico('CRM Cruzado');
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const cli = new ClientesPage(s.adminBarberia.page);
      await cli.abrir();
      await cli.crearCliente(nombre, telefonoUnico());
      const id = (await clientesDe(api, USERS.adminBarberia, nombre))[0].id;

      // Crea y completa un turno para ese cliente (vía API) → genera la atención.
      const sucursales = await sucursalesDe(api, USERS.adminBarberia);
      const centro = sucursales.find((x) => /centro/i.test(x.nombre))!;
      const servicioId = (await serviciosPublicos(api, centro.id))[0].id;
      const carlosId = (await especialistasPublicos(api, centro.id)).find((e) => /carlos/i.test(e.nombre))!.id;
      const inicio = new Date(`${hoyISO()}T16:00:00-05:00`).toISOString();
      const cita = await crearCitaInterna(api, USERS.adminBarberia, { sucursalId: centro.id, especialistaId: carlosId, clienteId: id, servicioIds: [servicioId], inicio });
      // El cierre solo es válido desde 'en_progreso': inicia y luego completa.
      await accionCitaApi(api, USERS.adminBarberia, cita.id, 'iniciar');
      await completarCitaApi(api, USERS.adminBarberia, cita.id);

      // Recarga el CRM y verifica el reflejo en historial y en la métrica de la tarjeta.
      await cli.refrescar();
      await expect(cli.tarjeta(id)).toContainText('Servicios');
      const dlg = await cli.abrirHistorial(id);
      await expect(dlg.locator('[data-testid^="historial-visita-"]')).toHaveCount(1);
      await expect(dlg).toContainText('1 servicios');
    } finally {
      await cerrarRoles(s);
    }
  });

  test('un cliente sin servicios muestra el historial vacío', async ({ browser }) => {
    // Felipe Torres (seed) tiene 0 servicios.
    const felipe = (await clientesDe(api, USERS.adminBarberia)).find((c) => /felipe/i.test(c.nombre))!;
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const cli = new ClientesPage(s.adminBarberia.page);
      await cli.abrir();
      const dlg = await cli.abrirHistorial(felipe.id);
      await expect(dlg.getByText('Sin servicios registrados')).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
