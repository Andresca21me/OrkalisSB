import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { loginUI, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, especialistasPublicos, sembrarReserva, type Sucursal } from '../../fixtures/api';
import { SpecAgendaPage } from '../../pages/agenda.page';
import { reseed } from '../../fixtures/seed';

/**
 * Ganancias del especialista (FASE-04 v3, HU-ESP-009). Tras completar un turno,
 * el resumen de "Hoy" deja de estar vacío y muestra el total.
 */
test.describe('Especialista · ganancias', () => {
  let api: APIRequestContext;
  let centro: Sucursal;
  let servicioId: string;
  let carlosId: string;

  test.beforeAll(async () => {
    reseed();
    api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' });
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    centro = sucursales.find((s) => /centro/i.test(s.nombre)) ?? sucursales[0];
    servicioId = (await serviciosPublicos(api, centro.id))[0].id;
    carlosId = (await especialistasPublicos(api, centro.id)).find((e) => /carlos/i.test(e.nombre))!.id;
  });
  test.afterAll(async () => { await api.dispose(); });

  test('al completar un turno, las ganancias de hoy lo reflejan', async ({ page }) => {
    const reserva = await sembrarReserva(api, centro.id, servicioId, { especialista: carlosId, maxDias: 0 });
    await loginUI(page, USERS.especialista);
    const spec = new SpecAgendaPage(page);

    // Completar el turno por la UI.
    await spec.abrirAgenda();
    await spec.abrirDetalle(reserva.citaId);
    await spec.iniciar();
    await spec.completar();
    await spec.cobrar('Efectivo');

    // Ganancias → Hoy: ya no está vacío.
    await spec.irAGanancias();
    await expect(page.getByText('Hoy')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Aún sin ganancias hoy')).toHaveCount(0);
  });
});
