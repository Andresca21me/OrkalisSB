import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import {
  sucursalesDe,
  serviciosPublicos,
  especialistasPublicos,
  sembrarReserva,
  franjaLibre,
  type Franja,
  type Sucursal,
} from '../../fixtures/api';
import { reseed } from '../../fixtures/seed';
import { ConfigPage } from '../../pages/config.page';

/**
 * Plan-Franjas · el intervalo configurado en Config → Agenda rige la rejilla de
 * la reserva pública, y las franjas se re-anclan al minuto exacto en que
 * termina una cita (una de 45 min con rejilla de 30 deja la siguiente franja
 * en su fin, no en la siguiente marca de la rejilla). Destructiva → reseed.
 */
test.describe('Config · franjas de reserva', () => {
  let api: APIRequestContext;
  let centro: Sucursal;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => {
    reseed();
    centro = (await sucursalesDe(api, USERS.adminBarberia)).find((s) => /centro/i.test(s.nombre))!;
  });

  const franjasDe = async (fecha: string, servicioId: string, especialistaId: string): Promise<Franja[]> => {
    const res = await api.get(
      `/api/public/${centro.id}/disponibilidad?especialista=${especialistaId}&servicios=${servicioId}&fecha=${fecha}`,
    );
    expect(res.ok(), 'GET /disponibilidad').toBeTruthy();
    return (await res.json()) as Franja[];
  };

  test('el intervalo elegido en la UI rige la rejilla y las franjas se anclan al fin de cada cita', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      // 1) UI: Config → Agenda → intervalo "Cada 30 minutos".
      const cfg = new ConfigPage(s.adminBarberia.page);
      await cfg.abrir();
      await cfg.seccion('Agenda');
      const guardado = s.adminBarberia.page.waitForResponse(
        (r) => r.url().includes('/api/config/') && r.request().method() === 'PUT' && r.ok(),
      );
      await s.adminBarberia.page.getByTestId('intervalo-franjas').selectOption('30');
      await guardado;

      // 2) La reserva pública ofrece la rejilla nueva: mañana, sin citas, las
      //    primeras franjas van de 30 en 30.
      const servicios = await serviciosPublicos(api, centro.id);
      const s30 = servicios.find((x) => x.duracionMin === 30)!;
      const s45 = servicios.find((x) => x.duracionMin === 45)!;
      const carlos = (await especialistasPublicos(api, centro.id)).find((e) => /carlos/i.test(e.nombre))!;

      // Primer día ABIERTO desde mañana (hoy tiene las citas del seed; un
      // domingo cerrado no ofrece franjas).
      const { fecha: diaLimpio } = await franjaLibre(api, centro.id, s45.id, carlos.id, 10, 1);
      const rejilla = await franjasDe(diaLimpio, s30.id, carlos.id);
      expect(rejilla.length).toBeGreaterThan(2);
      const paso01 = new Date(rejilla[1].inicio).getTime() - new Date(rejilla[0].inicio).getTime();
      const paso12 = new Date(rejilla[2].inicio).getTime() - new Date(rejilla[1].inicio).getTime();
      expect(paso01).toBe(30 * 60000);
      expect(paso12).toBe(30 * 60000);

      // 3) Cita de 45 min (no múltiplo de 30): la disponibilidad del día debe
      //    ofrecer una franja que empieza EXACTAMENTE cuando la cita termina.
      // Desde mañana: hoy tiene citas del seed que podrían dejar un hueco < 30
      // min tras la nueva cita (y entonces no habría franja en su fin).
      const reserva = await sembrarReserva(api, centro.id, s45.id, { especialista: carlos.id, desdeDia: 1 });
      const trasCita = await franjasDe(reserva.fecha, s30.id, carlos.id);
      expect(trasCita.some((f) => f.inicio === reserva.franja.fin)).toBe(true);
      // …y ninguna pisa la cita sembrada.
      const ini = new Date(reserva.franja.inicio).getTime();
      const fin = new Date(reserva.franja.fin).getTime();
      for (const f of trasCita) {
        expect(new Date(f.inicio).getTime() < fin && new Date(f.fin).getTime() > ini).toBe(false);
      }
    } finally {
      await cerrarRoles(s);
    }
  });
});
