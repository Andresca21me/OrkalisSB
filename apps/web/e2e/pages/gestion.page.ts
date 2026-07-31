import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Gestión del admin (`/admin` → pestaña Gestión): sub-pestañas Servicios /
 * Equipo / Inventario (Inventario solo si el módulo está ON). Filas por
 * `data-testid`: `esp-row-{id}`, `servicio-row-{id}`, `producto-row-{id}`.
 */
export class GestionPage {
  constructor(readonly page: Page) {}

  async abrir() {
    await this.page.getByRole('navigation').getByRole('button', { name: 'Gestión' }).click();
  }
  /** Selecciona la sub-pestaña por etiqueta ('Servicios' | 'Equipo' | 'Inventario'). */
  async subtab(nombre: string) {
    await this.page.getByRole('button', { name: nombre, exact: true }).click();
    await expect(this.page.getByRole('heading', { name: nombre })).toBeVisible({ timeout: 15_000 });
  }

  // ── Equipo ──
  filaEsp(id: string): Locator { return this.page.getByTestId(`esp-row-${id}`); }

  /**
   * Crea un especialista por invitación (Plan-Correo E5): el alta pide el
   * correo del invitado y el especialista queda creado de inmediato con el
   * badge «Invitación enviada». `sucursalesExtra` = sedes a pulsar además de la
   * pre-seleccionada (la 1ª). En E2E el correo sale por el MockAdapter (log).
   */
  async crearEspecialista(nombre: string, sucursalesExtra: string[] = [], especialidad?: string, email?: string) {
    await this.page.getByRole('button', { name: 'Nuevo especialista' }).first().click();
    const dlg = this.page.getByRole('dialog');
    await dlg.getByLabel(/^Nombre/).fill(nombre);
    await dlg.getByLabel(/Correo/).fill(email ?? `e2e.${Date.now()}.${Math.floor(Math.random() * 1e6)}@invitado.test`);
    if (especialidad) await dlg.getByLabel(/Especialidad/).fill(especialidad);
    // Los botones de sede heredan el texto del label del campo en su nombre
    // accesible, por eso se exige coincidencia exacta.
    for (const s of sucursalesExtra) await dlg.getByRole('button', { name: s, exact: true }).click();
    await dlg.getByRole('button', { name: 'Crear y enviar invitación' }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }

  async darDeBajaEsp(id: string) {
    await this.filaEsp(id).getByRole('button', { name: 'Acciones' }).click();
    await this.page.getByRole('menuitem', { name: 'Eliminar' }).click();
    const dlg = this.page.getByRole('dialog');
    await dlg.getByRole('button', { name: 'Dar de baja' }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }

  // ── Servicios ──
  filaServicio(id: string): Locator { return this.page.getByTestId(`servicio-row-${id}`); }

  /** Crea un servicio. `split`: {tipo:'porcentaje'|'valor_fijo', valor}. */
  async crearServicio(opts: { nombre: string; precio: number; tipo: 'porcentaje' | 'valor_fijo'; valor: number }) {
    await this.page.getByRole('button', { name: 'Nuevo servicio' }).first().click();
    const dlg = this.page.getByRole('dialog');
    await dlg.getByLabel('Nombre del servicio').fill(opts.nombre);
    await dlg.getByLabel('Precio').fill(String(opts.precio));
    await dlg.getByLabel('Modo').selectOption(opts.tipo);
    if (opts.tipo === 'porcentaje') {
      await dlg.getByLabel('% Profesional').fill(String(opts.valor));
    } else {
      // Etiqueta exacta del campo: /Valor fijo/ también casa con el <select> Modo.
      await dlg.getByLabel('Valor fijo al profesional').fill(String(opts.valor));
    }
    await dlg.getByRole('button', { name: 'Crear servicio' }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }

  // ── Inventario ──
  filaProducto(id: string): Locator { return this.page.getByTestId(`producto-row-${id}`); }

  /** Registra un movimiento de stock desde la fila del producto. */
  async registrarMovimiento(id: string, dir: 'Entrada' | 'Salida' | 'Ajuste', cantidad: number) {
    await this.filaProducto(id).getByRole('button', { name: 'Acciones' }).click();
    await this.page.getByRole('menuitem', { name: 'Registrar movimiento' }).click();
    const dlg = this.page.getByRole('dialog');
    // El primer botón del segmentado hereda el label del campo en su nombre
    // accesible; se localiza por su texto visible.
    await dlg.getByRole('button').filter({ hasText: dir }).click();
    // El campo de cantidad es el único input numérico del modal (GNumber).
    await dlg.locator('input[inputmode="numeric"]').first().fill(String(cantidad));
    await dlg.getByRole('button', { name: 'Registrar' }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }

}
