import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos } from '../../fixtures/api';
import { AdminAgendaPage } from '../../pages/agenda.page';
import { reseed } from '../../fixtures/seed';
import { fechaMasDias, hoyISO } from '../../fixtures/data';

/**
 * ORK-110 · Registrar desde "Nueva cita" una cita YA ATENDIDA: con una fecha
 * pasada el modal cambia solo a "Registrar cita atendida" (hora + cobro, sin
 * franjas); hoy se elige con "Ya fue atendida" y la hora es opcional. La cita
 * queda completada con su ticket.
 */
test.describe('Admin · agenda · cita ya atendida (ORK-110)', () => {
  let api: APIRequestContext;
  let servicioNombre: string;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' });
  });
  test.afterAll(async () => { await api.dispose(); });

  test.beforeEach(async () => {
    reseed();
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    const centro = sucursales.find((s) => /centro/i.test(s.nombre)) ?? sucursales[0];
    servicioNombre = (await serviciosPublicos(api, centro.id))[0].nombre;
  });

  test('fecha pasada → se registra completada y aparece ese día', async ({ browser }) => {
    const ayer = fechaMasDias(-1);
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const admin = new AdminAgendaPage(page);
      await admin.abrir();
      const dlg = await admin.abrirNuevaCita();
      if (await dlg.getByLabel('Sucursal').count()) await dlg.getByLabel('Sucursal').selectOption({ index: 0 });
      await dlg.getByLabel('Especialista').selectOption({ label: 'Carlos Barbero' });
      await dlg.getByRole('button', { name: new RegExp(servicioNombre) }).first().click();
      await dlg.getByTestId('nueva-cita-fecha').fill(ayer);

      // Modo registro: sin franjas, con hora y cobro.
      await expect(dlg.getByText('Registrar cita atendida')).toBeVisible();
      await expect(dlg.locator('[data-testid^="franja-"]')).toHaveCount(0);
      const registrar = dlg.getByRole('button', { name: /Registrar y cobrar/ });
      await expect(registrar).toBeDisabled(); // en días anteriores la hora es obligatoria
      await dlg.getByTestId('nueva-cita-hora').fill('06:10');
      await expect(registrar).toBeEnabled();
      await registrar.click();
      await expect(dlg).toBeHidden({ timeout: 15_000 });
      await expect(page.getByText('Cita registrada como completada')).toBeVisible();

      // Ese día la cita figura completada.
      const cal = page.getByTestId('mini-cal');
      if ((await cal.getByTestId(`cal-dia-${ayer}`).count()) === 0) await cal.getByRole('button', { name: 'Mes anterior' }).click();
      await cal.getByTestId(`cal-dia-${ayer}`).click();
      const fila = page.locator('[data-testid^="appt-row-"]').filter({ hasText: '6:10' }).filter({ hasText: 'Carlos Barbero' });
      await expect(fila).toHaveCount(1, { timeout: 15_000 });
      await expect(fila).toContainText('Completada');
    } finally {
      await cerrarRoles(s);
    }
  });

  test('hoy, «Ya fue atendida» sin hora → se registra completada', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const admin = new AdminAgendaPage(page);
      await admin.abrir();
      const dlg = await admin.abrirNuevaCita();
      await dlg.getByLabel('Especialista').selectOption({ label: 'Carlos Barbero' });
      await dlg.getByRole('button', { name: new RegExp(servicioNombre) }).first().click();
      await expect(dlg.getByTestId('nueva-cita-fecha')).toHaveValue(hoyISO());
      await dlg.getByRole('button', { name: 'Ya fue atendida' }).click();
      await expect(dlg.getByText('Sin hora, la cita queda registrada')).toBeVisible();
      await dlg.getByRole('button', { name: /Registrar y cobrar/ }).click();
      await expect(dlg).toBeHidden({ timeout: 15_000 });
      await expect(page.getByText('Cita registrada como completada')).toBeVisible();
    } finally {
      await cerrarRoles(s);
    }
  });
});
