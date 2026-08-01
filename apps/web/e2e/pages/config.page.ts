import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Configuración del admin (menú de perfil → Configuración). Secciones en el nav
 * lateral: Módulos · Financieros · Agenda · Notificaciones · Sucursales ·
 * Usuarios · Reservas · Suscripción · Developer.
 */
export class ConfigPage {
  constructor(readonly page: Page, private readonly adminNombre = 'Admin Barbería') {}

  /** Abre Configuración desde el menú de perfil del admin. */
  async abrir() {
    await this.page.getByRole('button', { name: new RegExp(this.adminNombre) }).click();
    await this.page.getByRole('menuitem', { name: 'Configuración' }).click();
  }
  /** Selecciona una sección del nav lateral de Configuración. Acotado a `main`
   *  porque nombres como «Agenda» también existen en el nav global de la app. */
  async seccion(nombre: string) {
    await this.page.getByRole('main').getByRole('button', { name: nombre, exact: true }).click();
  }

  // ── Módulos ──
  moduloSwitch(clave: string): Locator {
    return this.page.getByTestId(`modulo-${clave}-toggle`);
  }
  async toggleModulo(clave: string) {
    await this.moduloSwitch(clave).click();
  }
  async moduloActivo(clave: string): Promise<boolean> {
    return (await this.moduloSwitch(clave).getAttribute('aria-checked')) === 'true';
  }

  // ── Financieros ──
  profInput(): Locator {
    return this.page.getByTestId('repart-profesional').locator('input');
  }
  async fijarReparticionProfesional(pct: number) {
    await this.profInput().fill(String(pct));
  }
  salonValue(): Locator {
    return this.page.getByTestId('repart-salon').locator('input');
  }
  async guardarFinancieros() {
    await this.page.getByRole('button', { name: 'Guardar cambios' }).click();
  }
  /** Cambia el ámbito de configuración (scoped): 'negocio' o 'sucursal'. */
  async ambito(scope: 'negocio' | 'sucursal') {
    await this.page.getByRole('button', { name: scope === 'negocio' ? 'negocio' : 'sucursal', exact: true }).click();
  }

  // ── Usuarios ──
  async crearUsuario(opts: { nombre: string; email: string; password: string; rol: 'Administrador' | 'Recepcionista' | 'Especialista' }) {
    await this.page.getByRole('button', { name: 'Nuevo usuario' }).click();
    const dlg = this.page.getByRole('dialog');
    await dlg.getByLabel('Nombre completo').fill(opts.nombre);
    await dlg.getByLabel('Correo').fill(opts.email);
    await dlg.getByLabel(/Contraseña/).fill(opts.password);
    await dlg.getByLabel('Rol').selectOption(opts.rol);
    await dlg.getByRole('button', { name: 'Crear usuario' }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }
  filaUsuario(email: string): Locator {
    return this.page.getByRole('row').filter({ hasText: email });
  }
  async desactivarUsuario(email: string) {
    await this.filaUsuario(email).getByRole('button', { name: 'Acciones' }).click();
    await this.page.getByRole('menuitem', { name: 'Desactivar' }).click();
  }
}
