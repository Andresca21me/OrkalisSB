import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { USERS } from '../../fixtures/roles';
import {
  sucursalesDe, crearEspecialista, crearServicioApi, crearCitaInterna, accionCitaApi, completarCitaApi,
  previewLiquidacionApi, type Sucursal,
} from '../../fixtures/api';
import { reseed } from '../../fixtures/seed';
import { nombreUnico, hoyISO } from '../../fixtures/data';

/**
 * FASE-08 v3 · Gestión · Repartición → payout (HU-ADM-006, flujo cruzado
 * servicio→finanzas): al COMPLETAR un servicio, el bruto del profesional se
 * reparte según la configuración del servicio. Se verifica con un especialista
 * nuevo (sin ruido) vía la liquidación, que es la fuente que ve la UI.
 *
 * Es API-only a propósito: el reparto es cálculo de backend y el resto de la
 * fase ejercita la UI; la pantalla de liquidación se cubre en FASE-09.
 */
test.describe('Gestión · repartición y payout', () => {
  let api: APIRequestContext;
  let centro: Sucursal;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => {
    reseed();
    centro = (await sucursalesDe(api, USERS.adminBarberia)).find((s) => /centro/i.test(s.nombre))!;
  });

  /** Crea esp nuevo + servicio, completa un turno y devuelve su bruto liquidable. */
  async function brutoTras(servicio: { precio: number; tipo: 'porcentaje' | 'valor_fijo'; valor: number }): Promise<number> {
    const espId = await crearEspecialista(api, USERS.adminBarberia, nombreUnico('Payout Esp'), [centro.id], 'Tester');
    const serv = await crearServicioApi(api, USERS.adminBarberia, {
      nombre: nombreUnico('Payout Svc'), precio: servicio.precio, duracionMin: 30,
      splitType: servicio.tipo, splitValor: servicio.valor,
    });
    const inicio = new Date(`${hoyISO()}T16:00:00-05:00`).toISOString();
    const cita = await crearCitaInterna(api, USERS.adminBarberia, { sucursalId: centro.id, especialistaId: espId, servicioIds: [serv.id], inicio });
    await accionCitaApi(api, USERS.adminBarberia, cita.id, 'iniciar');
    await completarCitaApi(api, USERS.adminBarberia, cita.id);

    const ymd = hoyISO();
    const desde = `${ymd.slice(0, 8)}01T00:00:00.000Z`;
    const hasta = new Date(Date.now() + 86_400_000).toISOString();
    const filas = await previewLiquidacionApi(api, USERS.adminBarberia, { desde, hasta, sucursalId: centro.id });
    const fila = filas.find((f) => f.especialistaId === espId);
    expect(fila, 'el especialista aparece en la liquidación').toBeTruthy();
    return fila!.bruto;
  }

  test('valor fijo: el profesional recibe exactamente el monto fijo del servicio', async () => {
    const bruto = await brutoTras({ precio: 30000, tipo: 'valor_fijo', valor: 15000 });
    expect(bruto).toBe(15000);
  });

  // H-007 corregido: el reparto por porcentaje ahora usa el `splitValor` por
  // servicio (antes usaba el % global del negocio). 60% de 40000 = 24000.
  test('porcentaje: el profesional recibe el % por servicio', async () => {
    const bruto = await brutoTras({ precio: 40000, tipo: 'porcentaje', valor: 60 });
    expect(bruto).toBe(24000);
  });
});
