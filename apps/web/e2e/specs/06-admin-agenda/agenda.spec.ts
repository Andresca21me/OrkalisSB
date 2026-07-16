import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, especialistasPublicos, crearCitaInterna, type Sucursal } from '../../fixtures/api';
import { AdminAgendaPage } from '../../pages/agenda.page';
import { reseed } from '../../fixtures/seed';
import { fechaMasDias, hoyISO } from '../../fixtures/data';

/**
 * FASE-06 v3 · Admin · Agenda: filtro por sucursal vs consolidado y navegación
 * del mini-calendario. Se siembra un turno en Sede Norte (vía API interna) para
 * distinguir el alcance: consolidado lo incluye, Centro no, Norte sí.
 */
test.describe('Admin · agenda (filtro y calendario)', () => {
  let api: APIRequestContext;
  let centro: Sucursal;
  let norte: Sucursal;
  let carlosId: string;
  let servicioId: string;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' });
  });
  test.afterAll(async () => { await api.dispose(); });

  test.beforeEach(async () => {
    reseed();
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    centro = sucursales.find((s) => /centro/i.test(s.nombre)) ?? sucursales[0];
    norte = sucursales.find((s) => /norte/i.test(s.nombre))!;
    servicioId = (await serviciosPublicos(api, centro.id))[0].id;
    carlosId = (await especialistasPublicos(api, centro.id)).find((e) => /carlos/i.test(e.nombre))!.id;
  });

  test('consolidado vs Centro vs Norte filtra la agenda', async ({ browser }) => {
    // Turno en Norte con Carlos (asignado a Norte), hoy.
    const inicio = new Date(`${hoyISO()}T16:00:00-05:00`).toISOString();
    const enNorte = await crearCitaInterna(api, USERS.adminBarberia, { sucursalId: norte.id, especialistaId: carlosId, servicioIds: [servicioId], inicio });

    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.abrir(); // arranca en consolidado

      // Consolidado: el turno de Norte se ve.
      await expect(admin.fila(enNorte.id)).toBeVisible({ timeout: 15_000 });
      // Sede Centro: NO se ve.
      await admin.elegirVista('Sede Centro');
      await expect(admin.fila(enNorte.id)).toHaveCount(0);
      // Sede Norte: vuelve a verse.
      await admin.elegirVista('Sede Norte');
      await expect(admin.fila(enNorte.id)).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });

  test('el mini-calendario cambia el día (futuro sin citas → vacío)', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.abrir();
      await admin.elegirDia(fechaMasDias(45));
      await expect(s.adminBarberia.page.getByText('No hay citas para este día')).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
