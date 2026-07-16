import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, especialistasPublicos, sembrarReserva, type ReservaSembrada, type Sucursal } from '../../fixtures/api';
import { AdminAgendaPage, RecepcionPage, SpecAgendaPage } from '../../pages/agenda.page';
import { reseed } from '../../fixtures/seed';

/**
 * FLUJO INSIGNIA (FASE-03 v3): una reserva del cliente se refleja en TODAS las
 * vistas del mismo tenant/sede (especialista, admin, recepción), respeta el
 * aislamiento por tenant, y sus transiciones de estado se propagan.
 *
 * Se re-siembra ANTES de cada prueba (ids frescos, estado limpio): así cada
 * prueba opera sobre UNA sola cita custom y la agenda no queda densa con
 * turnos de pruebas previas. La reserva es con Carlos en Centro, HOY (para ser
 * observable en la vista de día).
 */
test.describe('Flujo cruzado de la reserva', () => {
  let api: APIRequestContext;
  let centro: Sucursal;
  let reserva: ReservaSembrada;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' });
  });
  test.afterAll(async () => { await api.dispose(); });

  test.beforeEach(async () => {
    reseed();
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    centro = sucursales.find((s) => /centro/i.test(s.nombre)) ?? sucursales[0];
    const servicioId = (await serviciosPublicos(api, centro.id))[0].id;
    const carlos = (await especialistasPublicos(api, centro.id)).find((e) => /carlos/i.test(e.nombre))!;
    reserva = await sembrarReserva(api, centro.id, servicioId, { especialista: carlos.id, maxDias: 0 });
  });

  test('aparece en especialista, admin y recepción', async ({ browser }) => {
    const s = await abrirRoles(browser, ['especialista', 'adminBarberia', 'recepcion']);
    try {
      const spec = new SpecAgendaPage(s.especialista.page);
      await spec.abrirAgenda();
      await expect(spec.turno(reserva.citaId)).toBeVisible({ timeout: 15_000 });

      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.abrir();
      await expect(admin.fila(reserva.citaId)).toBeVisible({ timeout: 15_000 });
      await expect(admin.fila(reserva.citaId)).toContainText(reserva.nombre);

      const recepcion = new RecepcionPage(s.recepcion.page);
      await recepcion.elegirSucursal(centro.nombre);
      await expect(recepcion.fila(reserva.citaId)).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });

  test('NO se filtra al salón (aislamiento)', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminSalon']);
    try {
      const admin = new AdminAgendaPage(s.adminSalon.page);
      await admin.abrir();
      await expect(admin.fila(reserva.citaId)).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('transición En progreso (especialista inicia) se propaga a admin y recepción', async ({ browser }) => {
    const s = await abrirRoles(browser, ['especialista', 'adminBarberia', 'recepcion']);
    try {
      const spec = new SpecAgendaPage(s.especialista.page);
      await spec.abrirAgenda();
      await spec.iniciarTurno(reserva.citaId); // confirma la transición a en_progreso

      // Observadores: recargar la vista antes de afirmar el cambio (no hay push en vivo).
      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.refrescar();
      await expect(admin.fila(reserva.citaId)).toContainText('En progreso', { timeout: 15_000 });

      const recepcion = new RecepcionPage(s.recepcion.page);
      await recepcion.refrescar();
      await recepcion.elegirSucursal(centro.nombre);
      await expect(recepcion.fila(reserva.citaId)).toContainText('En progreso', { timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
