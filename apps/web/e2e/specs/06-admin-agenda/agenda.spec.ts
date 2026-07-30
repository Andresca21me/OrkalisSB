import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, especialistasPublicos, crearCitaInterna, darDeBajaEspecialista, equipoDe, type Sucursal } from '../../fixtures/api';
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

  test('el filtro por especialista acota la agenda del día', async ({ browser }) => {
    // Seed de hoy: Diana Estilista tiene exactamente 1 cita; Carlos varias.
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const admin = new AdminAgendaPage(page);
      await admin.abrir();
      const filas = page.locator('[data-testid^="appt-row-"]');
      await expect(filas.filter({ hasText: 'Carlos Barbero' }).first()).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: /Diana Estilista/ }).click();
      await expect(filas.filter({ hasText: 'Carlos Barbero' })).toHaveCount(0);
      await expect(filas).toHaveCount(1);
      await expect(filas.first()).toContainText('Diana Estilista');

      await page.getByRole('button', { name: 'Ver todos' }).click();
      await expect(filas.filter({ hasText: 'Carlos Barbero' }).first()).toBeVisible();
    } finally {
      await cerrarRoles(s);
    }
  });

  test('un especialista dado de baja sale del filtro y queda en «Antiguos»', async ({ browser }) => {
    // Baja lógica de Diana (tiene una cita hoy en el seed): no debe seguir
    // ofreciéndose como filtro normal, pero sí bajo el desplegable "Antiguos".
    const dianaId = (await equipoDe(api, USERS.adminBarberia)).find((e) => /diana/i.test(e.nombre))!.id;
    await darDeBajaEspecialista(api, USERS.adminBarberia, dianaId);

    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const admin = new AdminAgendaPage(page);
      await admin.abrir();

      // En la lista principal ya no está; Carlos sí.
      await expect(page.getByRole('button', { name: /Carlos Barbero/ })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: /Diana Estilista/ })).toHaveCount(0);

      // El desplegable discreto la revela y permite filtrar sus citas históricas.
      await page.getByRole('button', { name: /Antiguos \(1\)/ }).click();
      await page.getByRole('button', { name: /Diana Estilista/ }).click();
      const filas = page.locator('[data-testid^="appt-row-"]');
      await expect(filas).toHaveCount(1);
      await expect(filas.first()).toContainText('Diana Estilista');

      // Y en "Nueva cita" ya no se ofrece como especialista.
      const dlg = await admin.abrirNuevaCita();
      await expect(dlg.getByLabel('Especialista').locator('option', { hasText: 'Diana' })).toHaveCount(0);
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
