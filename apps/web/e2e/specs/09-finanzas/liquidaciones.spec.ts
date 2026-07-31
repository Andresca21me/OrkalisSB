import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import {
  sucursalesDe, previewLiquidacionApi, negocioIdDe, setModuloApi,
  crearEspecialista, crearServicioApi, crearCitaInterna, accionCitaApi, completarCitaApi, setConfigApi, type Sucursal,
} from '../../fixtures/api';
import { FinanzasPage } from '../../pages/finanzas.page';
import { reseed } from '../../fixtures/seed';
import { hoyISO, nombreUnico } from '../../fixtures/data';

/**
 * Plan-Finanzas F5 · Liquidaciones (HU-ADM-009). Viven en Finanzas (ya no en
 * Gestión → Equipo) y SIN doble descuento bancario: la comisión la absorbe el
 * negocio en el cobro (D3), así que neto = bruto. Con partición desactivada,
 * la pestaña no existe.
 */
test.describe('Finanzas · liquidaciones', () => {
  let api: APIRequestContext;
  let centro: Sucursal;
  let negocioId: string;

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => {
    reseed();
    centro = (await sucursalesDe(api, USERS.adminBarberia)).find((s) => /centro/i.test(s.nombre))!;
    negocioId = await negocioIdDe(api, USERS.adminBarberia);
  });

  test('la liquidación aplica el descuento por pago electrónico (2%)', async ({ browser }) => {
    // La comisión bancaria viene en 0 por defecto: se fija al 2% para el negocio.
    await setConfigApi(api, USERS.adminBarberia, negocioId, 'finanzas.comision_bancaria', 2);
    // Completa un turno por la vía real con TRANSFERENCIA: su atención guarda el
    // snapshot con la comisión bancaria (2%), que la liquidación retiene del bruto.
    const nombre = nombreUnico('Liq Esp');
    const espId = await crearEspecialista(api, USERS.adminBarberia, nombre, [centro.id], 'Tester');
    const serv = await crearServicioApi(api, USERS.adminBarberia, { nombre: nombreUnico('Liq Svc'), precio: 100000, duracionMin: 30, splitType: 'porcentaje', splitValor: 50 });
    const inicio = new Date(`${hoyISO()}T15:00:00-05:00`).toISOString();
    const cita = await crearCitaInterna(api, USERS.adminBarberia, { sucursalId: centro.id, especialistaId: espId, servicioIds: [serv.id], inicio });
    await accionCitaApi(api, USERS.adminBarberia, cita.id, 'iniciar');
    await completarCitaApi(api, USERS.adminBarberia, cita.id, 'transferencia');

    // Oráculo D3: bruto 50% de 100000 = 50000 y neto = bruto — la comisión
    // bancaria ya la absorbió el negocio en el cobro; NO se descuenta otra vez.
    const ymd = hoyISO();
    const desde = `${ymd.slice(0, 8)}01T00:00:00.000Z`;
    const hasta = new Date(Date.now() + 86_400_000).toISOString();
    const filas = await previewLiquidacionApi(api, USERS.adminBarberia, { desde, hasta, sucursalId: centro.id });
    const fila = filas.find((f) => f.especialistaId === espId)!;
    expect(fila, 'el especialista aparece en la liquidación').toBeTruthy();
    expect(fila.bruto).toBe(50000);
    expect(fila.descuento).toBe(0);
    expect(fila.neto).toBe(50000);

    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const fin = new FinanzasPage(page);
      await fin.abrir();
      await fin.subtab('Liquidación');
      await expect(page.getByRole('heading', { name: 'Liquidación del período' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Neto a pagar')).toBeVisible();
      const filaEsp = page.getByRole('row').filter({ hasText: nombre });
      await expect(filaEsp).toBeVisible({ timeout: 15_000 });
      await expect(filaEsp).toContainText('50.000');
    } finally {
      await cerrarRoles(s);
    }
  });

  test('con partición desactivada, la pestaña Liquidación no existe en Finanzas', async ({ browser }) => {
    await setModuloApi(api, USERS.adminBarberia, negocioId, 'modulo.particion_por_especialista', false);
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const fin = new FinanzasPage(page);
      await fin.abrir();
      await expect(page.getByRole('heading', { name: 'Resumen financiero' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: 'Liquidación', exact: true })).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });
});
