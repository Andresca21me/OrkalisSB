import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, especialistasPublicos, citasDelDia, clientesDe, crearCitaInterna, type Sucursal } from '../../fixtures/api';
import { AdminAgendaPage, SpecAgendaPage } from '../../pages/agenda.page';
import { reseed } from '../../fixtures/seed';
import { hoyISO, horaBogota, nombreUnico, telefonoUnico } from '../../fixtures/data';

/**
 * FASE-06 v3 · Admin · Crear turnos en cualquier sucursal (HU-ADM-012): el admin
 * agenda en una sede específica respetando la validez de especialista por sede
 * (solo se ofrecen los asignados) y el anti-solape. El turno creado se refleja en
 * la agenda del especialista de esa sede (cruzado ADM→ESP).
 */
test.describe('Admin · crear turno en cualquier sucursal', () => {
  let api: APIRequestContext;
  let centro: Sucursal;
  let norte: Sucursal;
  let carlosId: string;
  let servicio: { id: string; nombre: string };

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' });
  });
  test.afterAll(async () => { await api.dispose(); });

  test.beforeEach(async () => {
    reseed();
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    centro = sucursales.find((s) => /centro/i.test(s.nombre)) ?? sucursales[0];
    norte = sucursales.find((s) => /norte/i.test(s.nombre))!;
    const servs = await serviciosPublicos(api, centro.id);
    servicio = { id: servs[0].id, nombre: servs[0].nombre };
    carlosId = (await especialistasPublicos(api, centro.id)).find((e) => /carlos/i.test(e.nombre))!.id;
  });

  test('crea un turno en Sede Norte y el especialista lo ve (cruzado)', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia', 'especialista']);
    try {
      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.abrir();
      // La hora sale del selector de franjas (disponibilidad real), no de un valor fijo.
      const hora = await admin.crearTurno({ sucursal: 'Sede Norte', especialista: 'Carlos Barbero', servicio: servicio.nombre });

      const id = (await citasDelDia(api, USERS.adminBarberia, norte.id, hoyISO()))
        .find((c) => /carlos/i.test(c.especialistaNombre) && horaBogota(c.inicio) === hora)!.id;
      expect(id, 'el turno creado existe en Norte').toBeTruthy();
      await expect(admin.fila(id)).toBeVisible({ timeout: 15_000 });

      // Cruzado: la agenda del especialista está acotada a su sede activa; Carlos
      // cambia a Sede Norte y entonces ve el turno creado por el admin.
      const spec = new SpecAgendaPage(s.especialista.page);
      await spec.cambiarSede('Sede Norte');
      await expect(spec.turno(id)).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });

  test('en Sede Norte solo ofrece especialistas de esa sede', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.abrir();
      const dlg = await admin.abrirNuevaCita();
      await dlg.getByLabel('Sucursal').selectOption({ label: 'Sede Norte' });
      const opciones = dlg.getByLabel('Especialista').locator('option');
      await expect(opciones.filter({ hasText: 'Carlos' })).toHaveCount(1);
      await expect(opciones.filter({ hasText: 'Diana' })).toHaveCount(0); // Diana solo en Centro
    } finally {
      await cerrarRoles(s);
    }
  });

  test('crea un turno registrando al vuelo un cliente nuevo (nombre + celular)', async ({ browser }) => {
    const nombre = nombreUnico('Cliente');
    const celular = telefonoUnico();
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.abrir();
      await admin.crearTurno({ sucursal: 'Sede Centro', especialista: 'Carlos Barbero', servicio: servicio.nombre, cliente: { nombre, celular } });

      // La fila del turno muestra al cliente recién registrado…
      await expect(s.adminBarberia.page.locator('[data-testid^="appt-row-"]').filter({ hasText: nombre })).toBeVisible({ timeout: 15_000 });
      // …y quedó en el directorio del CRM con su celular (oráculo de API).
      const cli = (await clientesDe(api, USERS.adminBarberia, nombre))[0];
      expect(cli, 'el cliente existe en /clientes').toBeTruthy();
      expect(cli.telefono).toBe(celular);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('sugiere clientes existentes por nombre y autocompleta su celular', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.abrir();
      const dlg = await admin.abrirNuevaCita();
      await dlg.getByPlaceholder('Nombre del cliente').fill('Juan');
      // La sugerencia muestra nombre y celular del cliente sembrado.
      await dlg.getByRole('button', { name: /Juan Pérez/ }).click();
      await expect(dlg.getByPlaceholder('Nombre del cliente')).toHaveValue('Juan Pérez');
      await expect(dlg.getByPlaceholder('311 845 2210')).toHaveValue('3001112233');
      await expect(dlg.getByText('Cliente existente')).toBeVisible();
    } finally {
      await cerrarRoles(s);
    }
  });

  test('rechaza un turno que se solapa con otro del mismo especialista (anti-solape)', async ({ browser }) => {
    // El selector solo ofrece franjas libres, así que el solape se provoca por
    // CARRERA: otro actor ocupa la franja después de cargado el selector y antes
    // de confirmar. El backend debe rechazarla igual.
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.abrir();
      const dlg = await admin.abrirNuevaCita();
      await dlg.getByLabel('Sucursal').selectOption({ label: 'Sede Centro' });
      await dlg.getByLabel('Especialista').selectOption({ label: 'Carlos Barbero' });
      await dlg.getByRole('button', { name: new RegExp(servicio.nombre) }).first().click();
      const hora = await admin.elegirFranja(dlg);

      const inicio = new Date(`${hoyISO()}T${hora}:00-05:00`).toISOString();
      await crearCitaInterna(api, USERS.adminBarberia, { sucursalId: centro.id, especialistaId: carlosId, servicioIds: [servicio.id], inicio });

      await dlg.getByRole('button', { name: /Crear cita/ }).click();
      await expect(dlg.getByText(/solapa|turno activo en esa franja/i)).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
