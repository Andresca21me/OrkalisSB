import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, especialistasPublicos, franjaLibre, citasDelDia, type Sucursal } from '../../fixtures/api';
import { RecepcionPage, SpecAgendaPage } from '../../pages/agenda.page';
import { reseed } from '../../fixtures/seed';
import { horaBogota, hoyISO } from '../../fixtures/data';

/**
 * FASE-05 v3 · Recepción · Crear cita (HU-REC-001): el recepcionista agenda un
 * turno confirmado para un especialista en una franja libre; queda en la agenda
 * del día y, al recargar, el especialista (Carlos) lo ve (flujo cruzado REC→ESP).
 */
test.describe('Recepción · crear cita', () => {
  let api: APIRequestContext;
  let centro: Sucursal;
  let servicioNombre: string;
  let hora: string;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' });
  });
  test.afterAll(async () => { await api.dispose(); });

  test.beforeEach(async () => {
    reseed();
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    centro = sucursales.find((s) => /centro/i.test(s.nombre)) ?? sucursales[0];
    const servicio = (await serviciosPublicos(api, centro.id))[0];
    servicioNombre = servicio.nombre;
    const carlos = (await especialistasPublicos(api, centro.id)).find((e) => /carlos/i.test(e.nombre))!;
    // Franja libre hoy para Carlos → su hora local (la UI arma el inicio con HH:mm).
    const { franja } = await franjaLibre(api, centro.id, servicio.id, carlos.id, 0, 0);
    hora = horaBogota(franja.inicio);
  });

  test('crea una cita confirmada y el especialista la ve (cruzado)', async ({ browser }) => {
    const s = await abrirRoles(browser, ['recepcion', 'especialista']);
    try {
      const rec = new RecepcionPage(s.recepcion.page);
      await rec.crearCita({ especialista: 'Carlos Barbero', servicio: servicioNombre, hora });

      // La cita creada queda confirmada en la agenda de recepción.
      const carlosCitas = await citasDelDia(api, USERS.adminBarberia, centro.id, hoyISO());
      const creada = carlosCitas.find((c) => /carlos/i.test(c.especialistaNombre) && c.estado === 'confirmada' && horaBogota(c.inicio) === hora);
      expect(creada, 'la cita creada existe en la sede').toBeTruthy();

      await expect(rec.fila(creada!.id)).toBeVisible({ timeout: 15_000 });
      await expect(rec.fila(creada!.id)).toContainText('Confirmada');

      // Cruzado: el especialista Carlos la ve en su agenda del día. Se recarga
      // su vista (se abrió antes de crear la cita; no hay push en vivo).
      const spec = new SpecAgendaPage(s.especialista.page);
      await spec.refrescar();
      await expect(spec.turno(creada!.id)).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
