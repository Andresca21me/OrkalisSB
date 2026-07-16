import { expect, type Locator, type Page } from '@playwright/test';

/**
 * CRM de clientes (`/admin` → pestaña Clientes). Las tarjetas se localizan por
 * `data-testid="cliente-row-{id}"`; el historial por `historial-visita-{i}`.
 */
export class ClientesPage {
  constructor(readonly page: Page) {}

  async abrir() {
    await this.page.getByRole('navigation').getByRole('button', { name: 'Clientes' }).click();
    await expect(this.page.getByRole('heading', { name: 'Clientes' })).toBeVisible({ timeout: 15_000 });
  }
  /** Recarga la página y vuelve a Clientes (para ver cambios hechos por fuera de la UI). */
  async refrescar() {
    await this.page.reload();
    await this.abrir();
  }

  tarjeta(clienteId: string): Locator {
    return this.page.getByTestId(`cliente-row-${clienteId}`);
  }

  async buscar(texto: string) {
    await this.page.getByPlaceholder('Buscar por nombre o teléfono…').fill(texto);
  }

  // ── Alta / edición ──
  async abrirNuevo(): Promise<Locator> {
    await this.page.getByRole('button', { name: 'Nuevo cliente' }).first().click();
    return this.page.getByRole('dialog');
  }
  async crearCliente(nombre: string, telefono?: string) {
    const dlg = await this.abrirNuevo();
    await dlg.getByLabel('Nombre completo').fill(nombre);
    if (telefono) await dlg.getByLabel(/Teléfono/).fill(telefono);
    await dlg.getByRole('button', { name: 'Crear cliente' }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }
  async editarCliente(clienteId: string, nombre: string) {
    await this.tarjeta(clienteId).getByRole('button', { name: 'Editar' }).click();
    const dlg = this.page.getByRole('dialog');
    await dlg.getByLabel('Nombre completo').fill(nombre);
    await dlg.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }

  // ── Baja lógica ──
  async inactivar(clienteId: string) {
    await this.tarjeta(clienteId).getByRole('button', { name: 'Acciones' }).click();
    await this.page.getByRole('menuitem', { name: 'Eliminar' }).click();
    const dlg = this.page.getByRole('dialog');
    await dlg.getByRole('button', { name: 'Marcar inactivo' }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }

  // ── Historial ──
  async abrirHistorial(clienteId: string): Promise<Locator> {
    await this.tarjeta(clienteId).getByRole('button', { name: 'Historial' }).click();
    return this.page.getByRole('dialog');
  }
}
