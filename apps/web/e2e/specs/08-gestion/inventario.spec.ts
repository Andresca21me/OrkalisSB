import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import { abrirRoles, cerrarRoles, USERS } from '../../fixtures/roles';
import { sucursalesDe, productosDe, negocioIdDe, setModuloApi, type Sucursal, type ProductoInv } from '../../fixtures/api';
import { GestionPage } from '../../pages/gestion.page';
import { reseed } from '../../fixtures/seed';

/**
 * FASE-08 v3 · Gestión · Inventario (HU-ADM-007): stock y alertas de stock bajo,
 * entrada de compra (sube stock) y salida (baja stock → alerta dinámica). El
 * módulo de inventario viene apagado por defecto; se enciende donde hace falta y
 * se verifica también el estado apagado (la pestaña no aparece).
 */
test.describe('Gestión · inventario', () => {
  let api: APIRequestContext;
  let centro: Sucursal;
  let negocioId: string;
  let productos: ProductoInv[];

  test.beforeAll(async () => { api = await apiRequest.newContext({ baseURL: 'http://localhost:5173' }); });
  test.afterAll(async () => { await api.dispose(); });
  test.beforeEach(async () => {
    reseed();
    centro = (await sucursalesDe(api, USERS.adminBarberia)).find((s) => /centro/i.test(s.nombre))!;
    negocioId = await negocioIdDe(api, USERS.adminBarberia);
  });

  async function conInventarioOn() {
    await setModuloApi(api, USERS.adminBarberia, negocioId, 'modulo.inventario', true);
    productos = await productosDe(api, USERS.adminBarberia, centro.id);
  }
  const idDe = (re: RegExp) => productos.find((p) => re.test(p.nombre))!.id;

  test('módulo apagado: la pestaña Inventario no aparece', async ({ browser }) => {
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const g = new GestionPage(s.adminBarberia.page);
      await g.abrir();
      await g.subtab('Servicios'); // gestión carga
      await expect(s.adminBarberia.page.getByRole('button', { name: 'Inventario', exact: true })).toHaveCount(0);
    } finally {
      await cerrarRoles(s);
    }
  });

  test('marca el producto en stock bajo y lo cuenta en las alertas', async ({ browser }) => {
    await conInventarioOn();
    const shampoo = idDe(/shampoo/i); // cantidad 3 / mín 5 → stock bajo
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const page = s.adminBarberia.page;
      const g = new GestionPage(page);
      await g.abrir();
      await g.subtab('Inventario');
      await expect(page.getByText('En stock bajo')).toBeVisible({ timeout: 15_000 });
      await expect(g.filaProducto(shampoo)).toContainText('Stock bajo');
    } finally {
      await cerrarRoles(s);
    }
  });

  test('una entrada de compra sube el stock y sale de la alerta', async ({ browser }) => {
    await conInventarioOn();
    const shampoo = idDe(/shampoo/i);
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const g = new GestionPage(s.adminBarberia.page);
      await g.abrir();
      await g.subtab('Inventario');
      await g.registrarMovimiento(shampoo, 'Entrada', 10); // 3 → 13 (sobre el mínimo 5)
      await expect(g.filaProducto(shampoo)).toContainText('13', { timeout: 15_000 });
      await expect(g.filaProducto(shampoo)).toContainText('En stock');
    } finally {
      await cerrarRoles(s);
    }
  });

  test('una salida por debajo del mínimo dispara la alerta de stock bajo', async ({ browser }) => {
    await conInventarioOn();
    const cera = idDe(/cera/i); // cantidad 24 / mín 6
    const s = await abrirRoles(browser, ['adminBarberia']);
    try {
      const g = new GestionPage(s.adminBarberia.page);
      await g.abrir();
      await g.subtab('Inventario');
      await expect(g.filaProducto(cera)).toContainText('En stock', { timeout: 15_000 });
      await g.registrarMovimiento(cera, 'Salida', 20); // 24 → 4 (bajo el mínimo 6)
      await expect(g.filaProducto(cera)).toContainText('Stock bajo', { timeout: 15_000 });
    } finally {
      await cerrarRoles(s);
    }
  });
});
