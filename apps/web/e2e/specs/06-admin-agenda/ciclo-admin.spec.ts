import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, especialistasPublicos, citasDelDia, type Sucursal } from '../../fixtures/api';
import { AdminAgendaPage } from '../../pages/agenda.page';
import { reseed } from '../../fixtures/seed';
import { hoyISO, horaBogota } from '../../fixtures/data';

/**
 * FASE-06 v3 · Admin · Supervisión del ciclo desde la agenda (HU-ADM-012,
 * HU-ESP-006/007 vía admin): el admin crea un turno y opera sus transiciones
 * (iniciar → En progreso, completar con cobro → Completada) desde el menú de
 * acciones de la fila. Re-siembra por prueba.
 */
test.describe('Admin · ciclo del turno desde la agenda', () => {
  let api: APIRequestContext;
  let centro: Sucursal;
  let servicioNombre: string;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' });
  });
  test.afterAll(async () => { await api.dispose(); });

  test.beforeEach(async () => {
    reseed();
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    centro = sucursales.find((s) => /centro/i.test(s.nombre)) ?? sucursales[0];
    servicioNombre = (await serviciosPublicos(api, centro.id))[0].nombre;
    // Asegura que Carlos existe (oráculo de datos, no se usa el id aquí).
    await especialistasPublicos(api, centro.id);
  });

  test('crear → iniciar (En progreso) → completar con cobro (Completada)', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.abrir();
      await admin.crearTurno({ sucursal: 'Sede Centro', especialista: 'Carlos Barbero', servicio: servicioNombre, hora: '16:30' });

      const id = (await citasDelDia(api, USERS.adminBarberia, centro.id, hoyISO()))
        .find((c) => /carlos/i.test(c.especialistaNombre) && horaBogota(c.inicio) === '16:30' && c.estado === 'confirmada')!.id;
      expect(id, 'el turno creado existe').toBeTruthy();

      // Iniciar → En progreso.
      await admin.transicionar(admin.fila(id), 'En progreso');
      await expect(admin.fila(id)).toContainText('En progreso', { timeout: 15_000 });

      // Completar con cobro → Completada.
      await admin.cobrar(admin.fila(id), 'Efectivo');
      await expect(admin.fila(id)).toContainText('Completada', { timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
