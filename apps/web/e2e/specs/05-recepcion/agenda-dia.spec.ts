import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, especialistasPublicos, sembrarReserva, type Sucursal } from '../../fixtures/api';
import { RecepcionPage } from '../../pages/agenda.page';
import { reseed } from '../../fixtures/seed';
import { fechaMasDias } from '../../fixtures/data';

/**
 * FASE-05 v3 · Recepción · Agenda del día (HU-REC-003): el recepcionista de
 * Sede Centro ve los turnos del día y la pantalla resuelve sus estados
 * (poblado, vacío, error). Re-siembra por prueba para un día limpio y estable.
 */
test.describe('Recepción · agenda del día', () => {
  let api: APIRequestContext;
  let centro: Sucursal;

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' });
  });
  test.afterAll(async () => { await api.dispose(); });

  test.beforeEach(async () => {
    reseed();
    const sucursales = await sucursalesDe(api, USERS.adminBarberia);
    centro = sucursales.find((s) => /centro/i.test(s.nombre)) ?? sucursales[0];
  });

  test('muestra los turnos del día de la sede (poblado)', async ({ browser }) => {
    const servicioId = (await serviciosPublicos(api, centro.id))[0].id;
    const carlos = (await especialistasPublicos(api, centro.id)).find((e) => /carlos/i.test(e.nombre))!;
    const reserva = await sembrarReserva(api, centro.id, servicioId, { especialista: carlos.id, maxDias: 0 });

    const s = await abrirRoles(browser, ['recepcion']);
    try {
      const rec = new RecepcionPage(s.recepcion.page);
      await expect(rec.fila(reserva.citaId)).toBeVisible({ timeout: 15_000 });
      await expect(rec.fila(reserva.citaId)).toContainText(reserva.nombre);
      // Encabezados de conteo del día presentes.
      await expect(s.recepcion.page.getByText('Total citas')).toBeVisible();
    } finally {
      await cerrarRoles(s);
    }
  });

  test('día futuro sin citas muestra estado vacío', async ({ browser }) => {
    const s = await abrirRoles(browser, ['recepcion']);
    try {
      const rec = new RecepcionPage(s.recepcion.page);
      await rec.elegirDia(fechaMasDias(45));
      await expect(s.recepcion.page.getByText('No hay citas para este día')).toBeVisible({ timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });

  test('un 5xx al cargar citas muestra ErrorState', async ({ browser }) => {
    const s = await abrirRoles(browser, ['recepcion']);
    try {
      const page = s.recepcion.page;
      await page.route('**/api/citas?**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
      await page.reload();
      await expect(page.getByText('No pudimos cargar la información')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    } finally {
      await cerrarRoles(s);
    }
  });

  // Exportar resumen diario (HU-REC-003): no existe control de exportación en
  // RecepcionApp todavía → hallazgo H-003 (feature ausente, escalado). Ver
  // _MATRIZ-TRAZABILIDAD §3. Se deja en fixme hasta que exista la feature.
  test.fixme('exporta el resumen diario (PDF/descarga)', async () => {
    // Pendiente: implementar acción `recepcion-exportar-dia` y verificar la descarga.
  });
});
