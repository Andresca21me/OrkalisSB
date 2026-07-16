import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, especialistasPublicos, sembrarReserva, citasDelDia, type Sucursal } from '../../fixtures/api';
import { reseed } from '../../fixtures/seed';
import { ConfigPage } from '../../pages/config.page';

/**
 * FASE-10 v3 · Config · Agenda (HU-ADM-003, cruzado con reserva): activar
 * "Aprobación manual" hace que una reserva pública entre como Solicitada en vez
 * de Confirmada. Destructiva → reseed por prueba.
 */
test.describe('Config · reglas de agenda', () => {
  let api: APIRequestContext;
  let centro: Sucursal;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => {
    reseed();
    centro = (await sucursalesDe(api, USERS.adminBarberia)).find((s) => /centro/i.test(s.nombre))!;
  });

  test('con aprobación manual, una reserva pública entra como Solicitada', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const cfg = new ConfigPage(s.adminBarberia.page);
      await cfg.abrir();
      await cfg.seccion('Módulos');
      // Activar la aprobación manual de reservas.
      if (!(await cfg.moduloActivo('agendamiento.aprobacion_manual'))) {
        await cfg.toggleModulo('agendamiento.aprobacion_manual');
      }
      await expect(cfg.moduloSwitch('agendamiento.aprobacion_manual')).toHaveAttribute('aria-checked', 'true');

      // Reserva pública (API) → debe quedar en estado solicitada. Se toma la
      // primera franja libre disponible (puede no ser hoy si se corre de noche)
      // y se consulta ESE día; el estado no depende del día.
      const servicioId = (await serviciosPublicos(api, centro.id))[0].id;
      const carlos = (await especialistasPublicos(api, centro.id)).find((e) => /carlos/i.test(e.nombre))!;
      const reserva = await sembrarReserva(api, centro.id, servicioId, { especialista: carlos.id });

      const cita = (await citasDelDia(api, USERS.adminBarberia, centro.id, reserva.fecha)).find((c) => c.id === reserva.citaId)!;
      expect(cita.estado).toBe('solicitada');
    } finally {
      await cerrarRoles(s);
    }
  });
});
