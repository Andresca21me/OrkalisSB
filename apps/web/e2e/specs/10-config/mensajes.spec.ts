import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { reseed } from '../../fixtures/seed';
import { ConfigPage } from '../../pages/config.page';
import { sembrarReserva, serviciosPublicos, sucursalesDe } from '../../fixtures/api';

/**
 * Plan-WhatsApp · Registro de mensajes: cada fila muestra el CANAL por el que
 * salió y, si hubo degradación de canal (WhatsApp→SMS), el motivo queda a la
 * vista del admin. En dev no hay sender de WhatsApp, así que el router degrada
 * al encolar — exactamente la misma ruta auditada que en producción.
 */
test.describe('Config · Registro de mensajes', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => { reseed(); });

  test('la confirmación de una reserva aparece con su canal y la degradación explicada', async ({ browser }) => {
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    const centro = sucursales.find((s) => /centro/i.test(s.nombre)) ?? sucursales[0];
    const servicio = (await serviciosPublicos(api, centro.id))[0];
    const reserva = await sembrarReserva(api, centro.id, servicio.id);

    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const cfg = new ConfigPage(page);
      await cfg.abrir();
      await cfg.seccion('Registro de mensajes');

      // La tabla tiene columna de canal.
      await expect(page.getByRole('columnheader', { name: 'Canal' })).toBeVisible({ timeout: 15_000 });

      // La confirmación de la reserva sembrada salió por SMS (sin sender de
      // WhatsApp en dev) y la degradación queda anotada en la propia fila.
      const fila = page.getByRole('row').filter({ hasText: reserva.telefono }).filter({ hasText: 'confirmacion' });
      await expect(fila).toBeVisible({ timeout: 15_000 });
      await expect(fila).toContainText('SMS');
      await expect(fila.getByText('WhatsApp → SMS')).toBeVisible();
    } finally {
      await cerrarRoles(s);
    }
  });
});
