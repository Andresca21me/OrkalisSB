import { expect, type Page } from '@playwright/test';

/**
 * Page Object de la reserva pública (`/reservar/:sucursalId`). Conduce el flujo
 * completo por la UI: inicio → servicios → especialista → horario → datos → OTP
 * → confirmación, y la gestión de la cita.
 */
export class BookingPage {
  constructor(private readonly page: Page) {}

  async ir(sucursalId: string) {
    await this.page.goto(`/reservar/${sucursalId}`);
  }

  negocioHeading(nombre: string) {
    return this.page.getByRole('heading', { name: nombre });
  }
  servicioTexto(regex: RegExp) {
    return this.page.getByText(regex).first();
  }

  // ── Pasos del asistente ──
  async comenzarReserva() {
    await this.page.getByRole('button', { name: 'Reservar una cita' }).click();
  }

  async elegirPrimerServicio() {
    await this.page.getByTestId('booking-servicio').first().click();
    await this.page.getByRole('button', { name: 'Continuar' }).click();
  }

  async elegirCualquiera() {
    await this.page.getByText('Cualquiera disponible').click();
    await this.page.getByRole('button', { name: 'Ver disponibilidad' }).click();
  }

  /** Elige un especialista concreto por su nombre. */
  async elegirEspecialista(nombre: string) {
    await this.page.getByText(nombre, { exact: true }).click();
    await this.page.getByRole('button', { name: 'Ver disponibilidad' }).click();
  }

  /** ¿Aparece el especialista en la lista del paso de selección? */
  especialistaEnLista(nombre: string) {
    return this.page.getByText(nombre, { exact: true });
  }

  /** Selecciona el día (ISO 'YYYY-MM-DD') y la primera franja libre. */
  async elegirDiaYPrimeraFranja(fechaISO: string) {
    await this.page.getByTestId(`booking-dia-${fechaISO}`).click();
    const slot = this.page.getByTestId('booking-slot').first();
    await expect(slot).toBeVisible({ timeout: 15_000 });
    await slot.click();
    await this.page.getByRole('button', { name: /^Continuar/ }).click();
  }

  /** Selecciona un día sin cupo y verifica que se muestra el estado vacío. */
  async esperarDiaSinCupo(fechaISO: string) {
    await this.page.getByTestId(`booking-dia-${fechaISO}`).click();
    await expect(this.page.getByText('No quedan horas libres este día')).toBeVisible({ timeout: 15_000 });
  }

  async ingresarDatos(nombre: string, telefono: string) {
    await this.page.getByPlaceholder('Ej. Daniel Ríos').fill(nombre);
    await this.page.getByPlaceholder('311 845 2210').fill(telefono);
    await this.page.getByRole('button', { name: 'Continuar' }).click();
  }

  /** Lee el código que la UI muestra en el paso OTP cuando no hay SMS real. */
  async leerDevCode(): Promise<string> {
    const demo = this.page.getByText(/Tu código es/);
    await expect(demo).toBeVisible({ timeout: 15_000 });
    const txt = (await demo.textContent()) ?? '';
    const m = txt.match(/(\d{6})/);
    expect(m, `devCode en "${txt}"`).toBeTruthy();
    return m![1];
  }

  async escribirOtp(codigo: string) {
    const casillas = this.page.locator('input[maxlength="1"]');
    await expect(casillas).toHaveCount(6);
    for (let i = 0; i < 6; i++) await casillas.nth(i).fill(codigo[i]);
  }

  async verificar() {
    await this.page.getByRole('button', { name: 'Verificar y confirmar' }).click();
  }

  get confirmacionHeading() {
    return this.page.getByRole('heading', { name: /¡Cita confirmada!|Solicitud enviada/ });
  }

  /** Código de reserva visible en la confirmación. */
  async leerCodigoReserva(): Promise<string> {
    const cont = this.page.getByText('Código de reserva');
    await expect(cont).toBeVisible();
    // El código está en el span hermano (mismo contenedor).
    const txt = (await cont.locator('xpath=..').textContent()) ?? '';
    const m = txt.replace('Código de reserva', '').trim().match(/([A-Z0-9]{4,})/);
    expect(m, `código en "${txt}"`).toBeTruthy();
    return m![1];
  }

  // ── Gestión de la cita ──
  async irAVerMiCita() {
    await this.page.getByRole('button', { name: 'Ver mi cita' }).click();
  }

  async abrirGestionDesdeInicio() {
    await this.page.getByRole('button', { name: 'Ya tengo una cita' }).click();
  }

  async buscarCita(codigo: string, telefono: string) {
    await this.page.getByPlaceholder('Ej. EB440454').fill(codigo);
    await this.page.getByPlaceholder('311 845 2210').fill(telefono);
    await this.page.getByRole('button', { name: 'Ver mi cita' }).click();
  }

  async cancelarCita() {
    await this.page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await this.page.getByRole('button', { name: 'Sí, cancelar' }).click();
  }
}
