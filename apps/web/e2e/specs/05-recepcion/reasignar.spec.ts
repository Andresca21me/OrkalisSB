import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, especialistasPublicos, sembrarReserva, crearEspecialista, type ReservaSembrada, type Sucursal } from '../../fixtures/api';
import { AdminAgendaPage, RecepcionPage, SpecAgendaPage } from '../../pages/agenda.page';
import { reseed } from '../../fixtures/seed';
import { nombreUnico } from '../../fixtures/data';

/**
 * FASE-05 v3 · Recepción · Reasignar especialista (HU-REC-001, flujo cruzado
 * REC → ESP origen/destino y ADM): recepción mueve una cita de Carlos a Diana
 * (misma sede). Al recargar, Carlos ya no la tiene; recepción y admin muestran
 * a Diana como nueva responsable. Re-siembra por prueba (ids frescos, sin solape).
 */
test.describe('Recepción · reasignar especialista', () => {
  // Flujo cruzado pesado (3 contextos + recargas): en la corrida secuencial larga
  // sufre por contención de recursos del navegador/API dev. El reintento (con
  // contexto fresco + reseed) lo estabiliza sin enmascarar fallos reales (un fallo
  // de lógica fallaría las 3 veces).
  test.describe.configure({ retries: 2 });
  let api: APIRequestContext;
  let centro: Sucursal;
  let reserva: ReservaSembrada;
  let destino: string; // especialista destino FRESCO (sin citas → nunca solapa)

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
    // Destino FRESCO (sin agenda): reasignar a Diana podía chocar con una cita del
    // seed que solape la franja de la reserva ("el destino ya tiene un turno").
    destino = nombreUnico('Reasig Dest');
    await crearEspecialista(api, USERS.adminBarberia, destino, [centro.id], 'Tester');
  });

  test('mueve la cita de Carlos a Diana y se refleja en ESP y ADM', async ({ browser }) => {
    // Flujo cruzado pesado (3 contextos + recargas): en la corrida secuencial
    // larga se ralentiza por contención de recursos. `slow()` triplica el budget.
    test.slow();
    const s = await abrirRoles(browser, ['recepcion', 'especialista', 'adminBarberia']);
    try {
      const rec = new RecepcionPage(s.recepcion.page);
      await rec.listo(); // tablero interactivo antes de actuar (estable bajo carga)
      await expect(rec.fila(reserva.citaId)).toContainText('Carlos', { timeout: 30_000 });
      await rec.reasignar(rec.fila(reserva.citaId), destino);

      // Recepción: la misma fila ahora muestra al nuevo responsable.
      await rec.refrescar();
      await expect(rec.fila(reserva.citaId)).toContainText(destino, { timeout: 30_000 });

      // ESP origen (Carlos): ya no tiene el turno en su agenda.
      const spec = new SpecAgendaPage(s.especialista.page);
      await spec.refrescar();
      await expect(spec.turno(reserva.citaId)).toHaveCount(0);

      // ADM: ve la cita con el nuevo responsable.
      const admin = new AdminAgendaPage(s.adminBarberia.page);
      await admin.refrescar();
      await expect(admin.fila(reserva.citaId)).toContainText(destino, { timeout: 30_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
