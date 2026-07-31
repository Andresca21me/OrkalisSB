import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Centro financiero del admin (`/admin` → pestaña Finanzas). Sub-pestañas:
 * Análisis · (Control quincenal si cierre ON) · Reportes. Los gráficos (recharts)
 * se cargan lazy al abrir su pestaña.
 */
export class FinanzasPage {
  constructor(readonly page: Page) {}

  async abrir() {
    await this.page.getByRole('navigation').getByRole('button', { name: 'Finanzas' }).click();
  }
  async subtab(nombre: string) {
    await this.page.getByRole('button', { name: nombre, exact: true }).click();
  }

  /** Cambia el alcance del admin: 'Todo el negocio' o el nombre de una sede. */
  async elegirVista(nombre: string) {
    await this.page.getByTestId('branch-selector').click();
    await this.page.getByRole('menuitem', { name: nombre, exact: true }).click();
  }

  /** Tile financiero (FinTile) por su etiqueta. */
  tile(label: string): Locator {
    return this.page.locator('div').filter({ hasText: new RegExp(`^${label}`) }).first();
  }

  // ── Gastos (en Análisis) ──
  /** Abre el modal de gasto: kind 'fijo' (1ª tarjeta) o 'variable' (2ª). */
  async agregarGasto(kind: 'fijo' | 'variable', monto: number, categoria: string) {
    const idx = kind === 'fijo' ? 0 : 1;
    await this.page.getByRole('button', { name: 'Agregar gasto' }).nth(idx).click();
    const dlg = this.page.getByRole('dialog');
    await dlg.getByLabel('Categoría').fill(categoria);
    await dlg.getByLabel('Monto').fill(String(monto));
    await dlg.getByRole('button', { name: 'Registrar gasto' }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }

  async exportarCsv(boton = 'CSV'): Promise<import('@playwright/test').Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.page.getByRole('button', { name: boton, exact: true }).click(),
    ]);
    return download;
  }

  // ── Período global (Plan-Finanzas F4) ──
  /** Cambia el período de TODAS las pestañas: 'Quincena 1' | 'Quincena 2' | 'Mes'. */
  async elegirPeriodo(nombre: string) {
    await this.page.getByTestId('period-picker').getByText(nombre, { exact: true }).click();
  }

  // ── Cierre de período (Plan-Finanzas F6) ──
  async cerrarMes() {
    await this.elegirPeriodo('Mes');
    await this.page.getByRole('button', { name: 'Cerrar el mes' }).click();
    const dlg = this.page.getByRole('dialog');
    await dlg.getByRole('button', { name: 'Generar cierre' }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }
}
