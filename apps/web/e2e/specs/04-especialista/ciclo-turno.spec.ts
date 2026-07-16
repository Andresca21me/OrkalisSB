import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, especialistasPublicos, sembrarReserva, type ReservaSembrada, type Sucursal } from '../../fixtures/api';
import { AdminAgendaPage, SpecAgendaPage } from '../../pages/agenda.page';
import { reseed } from '../../fixtures/seed';

/**
 * Ciclo del turno del especialista (FASE-04 v3, HU-ESP-003/004/005): iniciar →
 * cobrar → completar, bloqueo sin pago, y no asistió. Cada acción se refleja en
 * la vista del admin (flujo cruzado ESP →).
 *
 * Se re-siembra ANTES de cada prueba: estas pruebas mutan el turno (lo
 * completan/cancelan) y, como `disponibilidad` libera la franja de una cita
 * completada, sin estado limpio dos pruebas reservarían la misma hora →
 * turnos solapados en la agenda. El reseed por test garantiza aislamiento e
 * ids frescos (el seed regenera UUIDs).
 */
test.describe('Especialista · ciclo del turno', () => {
  let api: APIRequestContext;
  let centro: Sucursal;
  let servicioId: string;
  let carlosId: string;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' });
  });
  test.afterAll(async () => { await api.dispose(); });

  test.beforeEach(async () => {
    reseed();
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    centro = sucursales.find((s) => /centro/i.test(s.nombre)) ?? sucursales[0];
    servicioId = (await serviciosPublicos(api, centro.id))[0].id;
    carlosId = (await especialistasPublicos(api, centro.id)).find((e) => /carlos/i.test(e.nombre))!.id;
  });

  const seedTurno = (): Promise<ReservaSembrada> =>
    sembrarReserva(api, centro.id, servicioId, { especialista: carlosId, maxDias: 0 });

  test('iniciar → completar con cobro → completada (reflejada en admin)', async ({ browser }) => {
    const reserva = await seedTurno();
    const s = await abrirRoles(browser, ['especialista', 'adminBarberia']);
    try {
      const spec = new SpecAgendaPage(s.especialista.page);
      await spec.abrirAgenda();
      await spec.abrirDetalle(reserva.citaId);
      await spec.iniciar();
      await spec.completar();
      await spec.cobrar('Efectivo');

      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.abrir();
      await expect(admin.fila(reserva.citaId)).toContainText('Completada', { timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });

  test('no se puede completar sin método de pago', async ({ browser }) => {
    const reserva = await seedTurno();
    const s = await abrirRoles(browser, ['especialista']);
    try {
      const spec = new SpecAgendaPage(s.especialista.page);
      await spec.abrirAgenda();
      await spec.abrirDetalle(reserva.citaId);
      await spec.iniciar();
      await spec.completar();
      await spec.confirmarCobroSinPago();
      await expect(s.especialista.page.getByText('Selecciona un método de pago para completar.')).toBeVisible({ timeout: 10_000 });
    } finally {
      await cerrarRoles(s);
    }
  });

  test('marcar "No asistió" se refleja en admin', async ({ browser }) => {
    const reserva = await seedTurno();
    const s = await abrirRoles(browser, ['especialista', 'adminBarberia']);
    try {
      const spec = new SpecAgendaPage(s.especialista.page);
      await spec.abrirAgenda();
      await spec.abrirDetalle(reserva.citaId);
      await spec.marcarNoAsistio();

      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.abrir();
      await expect(admin.fila(reserva.citaId)).toContainText('No asistió', { timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
