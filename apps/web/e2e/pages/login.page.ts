import { expect, type Page } from '@playwright/test';
import { PASSWORD } from '../fixtures/roles';

/** Page Object de la pantalla de Login (`/login`). */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async ir() {
    // Marca el tutorial guiado como visto para que su overlay no interfiera (E2E).
    await this.page.addInitScript(() => { try { localStorage.setItem('orkalis:tour:admin:v1', '1'); } catch { /* noop */ } });
    await this.page.goto('/login');
  }

  async completar(email: string, password = PASSWORD) {
    await this.page.locator('input[type="email"]').fill(email);
    await this.page.locator('input[type="password"]').fill(password);
  }

  async enviar() {
    await this.page.getByRole('button', { name: 'Entrar' }).click();
  }

  /** Login completo que espera salir de /login. */
  async entrar(email: string, password = PASSWORD) {
    await this.ir();
    await this.completar(email, password);
    await this.enviar();
    await expect(this.page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
  }

  /** Login que se espera que NO navegue (error de credenciales o cuenta suspendida). */
  async entrarConError(email: string, password = PASSWORD) {
    await this.ir();
    await this.completar(email, password);
    await this.enviar();
  }

  get errorVisible() {
    return this.page.getByText(/incorrect/i);
  }
}
