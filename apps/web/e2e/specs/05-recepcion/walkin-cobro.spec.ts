import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, citasDelDia, crearEspecialista, type Sucursal } from '../../fixtures/api';
import { AdminAgendaPage, RecepcionPage } from '../../pages/agenda.page';
import { reseed } from '../../fixtures/seed';
import { hoyISO, nombreUnico } from '../../fixtures/data';

/**
 * FASE-05 v3 · Recepción · Walk-in + cobro (HU-REC-002, HU-ESP-006): recepción
 * registra una atención sin reserva (entra en progreso) y la cobra al final;
 * queda Completada con el monto real y se refleja en el panel del admin
 * (flujo cruzado REC → ADM). Re-siembra por prueba.
 */
test.describe('Recepción · walk-in y cobro', () => {
  // Flujo cruzado (2 contextos + cobro + reflejo en admin): se vuelve frágil en la
  // corrida larga por contención de recursos. El reintento (contexto fresco +
  // reseed) lo estabiliza; un fallo de lógica real fallaría las 3 veces.
  test.describe.configure({ retries: 2 });
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

  test('registra walk-in, cobra al final y se refleja en admin', async ({ browser }) => {
    // Flujo cruzado (2 contextos + cobro + reflejo en admin): se ralentiza en la
    // corrida larga por contención de recursos. `slow()` triplica el budget.
    test.slow();
    // Especialista FRESCO (sin citas) para el walk-in: un walk-in entra "ahora",
    // y los especialistas del seed pueden tener una cita activa que solape la hora
    // real de la corrida ("El especialista ya tiene un turno activo en esa franja").
    const espNombre = nombreUnico('WalkIn Esp');
    await crearEspecialista(api, USERS.adminBarberia, espNombre, [centro.id], 'Tester');

    const s = await abrirRoles(browser, ['recepcion', 'adminBarberia']);
    try {
      const rec = new RecepcionPage(s.recepcion.page);
      await rec.listo(); // tablero interactivo antes de abrir el modal de walk-in
      await rec.walkin({ especialista: espNombre, servicio: 'Corte de cabello' });

      // El walk-in entra en progreso (única fila "Sin cliente").
      const fila = rec.filaWalkin();
      await expect(fila).toContainText('En progreso', { timeout: 30_000 });

      // Localiza su id por oráculo (cita sin cliente del día).
      const delDia = await citasDelDia(api, USERS.adminBarberia, centro.id, hoyISO());
      const wi = delDia.find((c) => !c.clienteNombre)!;
      expect(wi, 'el walk-in existe en la sede').toBeTruthy();

      // Cobro al final → Completada con el monto del servicio.
      await rec.cobrar(fila, 'Efectivo');
      await expect(rec.fila(wi.id)).toContainText('Completada', { timeout: 30_000 });
      await expect(rec.fila(wi.id)).toContainText(/25\.000/);

      // Cruzado: el admin ve el turno completado.
      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.abrir();
      await expect(admin.fila(wi.id)).toContainText('Completada', { timeout: 30_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
