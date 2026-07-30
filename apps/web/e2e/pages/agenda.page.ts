import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page Objects de las vistas de agenda (observadoras de los flujos cruzados).
 * Localizan una cita por su id vía `data-testid` (appt-row-{id} / turno-{id}).
 * Como la app no tiene push en vivo, `refrescar()` recarga antes de afirmar.
 */

/** Agenda del administrador (`/admin` → pestaña Agenda). */
export class AdminAgendaPage {
  constructor(readonly page: Page) {}

  async abrir() {
    await this.page.getByRole('navigation').getByRole('button', { name: 'Agenda' }).click();
    // Espera amplia: en la corrida completa el panel carga más lento bajo carga.
    await expect(this.page.getByRole('heading', { name: 'Agenda' })).toBeVisible({ timeout: 30_000 });
  }
  async refrescar() {
    await this.page.reload();
    await this.abrir();
  }
  fila(citaId: string) {
    return this.page.getByTestId(`appt-row-${citaId}`);
  }

  /** Cambia el alcance: 'Todo el negocio' (consolidado) o el nombre de una sede. */
  async elegirVista(nombre: string) {
    await this.page.getByTestId('branch-selector').click();
    await this.page.getByRole('menuitem', { name: nombre, exact: true }).click();
  }

  /** Navega el mini-calendario de la agenda admin hasta `fechaISO` y la selecciona. */
  async elegirDia(fechaISO: string) {
    const cal = this.page.getByTestId('mini-cal');
    const dia = cal.getByTestId(`cal-dia-${fechaISO}`);
    for (let i = 0; i < 18 && (await dia.count()) === 0; i++) {
      await cal.getByRole('button', { name: 'Mes siguiente' }).click();
    }
    await dia.click();
  }

  /** Abre el modal "Nueva cita" y devuelve su locator de diálogo. */
  async abrirNuevaCita(): Promise<Locator> {
    await this.page.getByRole('button', { name: 'Nueva cita' }).click();
    return this.page.getByRole('dialog');
  }

  /**
   * Elige una franja del selector dinámico de horas (disponibilidad real): la
   * pedida en `hora` ('HH:mm') o, si se omite, la última libre del día (la menos
   * propensa a quedar en el pasado durante la corrida). Devuelve la hora elegida.
   */
  async elegirFranja(dlg: Locator, hora?: string): Promise<string> {
    const chips = dlg.locator('[data-testid^="franja-"]');
    await expect(chips.first()).toBeVisible({ timeout: 15_000 });
    const chip = hora ? dlg.getByTestId(`franja-${hora}`) : chips.last();
    const elegida = (await chip.innerText()).trim();
    await chip.click();
    return elegida;
  }

  /**
   * Llena y envía "Nueva cita". No espera el cierre: el caller decide si verifica
   * éxito (diálogo oculto) o un error (anti-solape / validación). Devuelve el
   * diálogo y la hora efectivamente elegida en el selector de franjas.
   */
  async llenarNuevaCita(opts: { sucursal?: string; especialista: string; servicio: string; hora?: string; fecha?: string; cliente?: { nombre: string; celular?: string } }): Promise<{ dlg: Locator; hora: string }> {
    const dlg = await this.abrirNuevaCita();
    if (opts.sucursal) await dlg.getByLabel('Sucursal').selectOption({ label: opts.sucursal });
    await dlg.getByLabel('Especialista').selectOption({ label: opts.especialista });
    if (opts.cliente) {
      await dlg.getByPlaceholder('Nombre del cliente').fill(opts.cliente.nombre);
      if (opts.cliente.celular) await dlg.getByPlaceholder('311 845 2210').fill(opts.cliente.celular);
    }
    await dlg.getByRole('button', { name: new RegExp(opts.servicio) }).first().click();
    if (opts.fecha) await dlg.locator('input[type="date"]').fill(opts.fecha);
    const hora = await this.elegirFranja(dlg, opts.hora);
    await dlg.getByRole('button', { name: /Crear cita/ }).click();
    return { dlg, hora };
  }

  /** Crea un turno y espera que el modal cierre (camino feliz). Devuelve la hora. */
  async crearTurno(opts: { sucursal?: string; especialista: string; servicio: string; hora?: string; fecha?: string; cliente?: { nombre: string; celular?: string } }): Promise<string> {
    const { dlg, hora } = await this.llenarNuevaCita(opts);
    await expect(dlg).toBeHidden({ timeout: 15_000 });
    return hora;
  }

  // ── Transiciones desde el menú de acciones de una fila ──
  async transicionar(fila: Locator, estadoLabel: string) {
    await fila.getByRole('button', { name: 'Acciones' }).click();
    await this.page.getByRole('menuitem', { name: estadoLabel, exact: true }).click();
  }
  /** Completa una cita En progreso cobrándola desde el menú ("Completar y cobrar" → CobroModal). */
  async cobrar(fila: Locator, metodo = 'Efectivo') {
    await fila.getByRole('button', { name: 'Acciones' }).click();
    await this.page.getByRole('menuitem', { name: 'Completar y cobrar' }).click();
    const dlg = this.page.getByRole('dialog');
    await dlg.getByRole('combobox').selectOption({ label: metodo });
    await dlg.getByRole('button', { name: /Cobrar/ }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }
}

/** Tablero de recepción (`/recepcion`). */
export class RecepcionPage {
  constructor(readonly page: Page) {}

  /** Selecciona la sucursal por nombre si hay selector (scope multi-sede). */
  async elegirSucursal(nombre: string) {
    const sel = this.page.locator('select');
    if (await sel.count()) await sel.first().selectOption({ label: nombre });
  }
  /**
   * Espera a que el tablero quede INTERACTIVO antes de actuar/afirmar. `loginUI`
   * solo espera el cambio de URL, no el render del panel; sin esto, en la corrida
   * completa (más lenta) las primeras acciones corren contra una página a medio
   * cargar y agotan el timeout.
   */
  async listo() {
    await expect(this.page.getByRole('button', { name: 'Nueva cita' })).toBeVisible({ timeout: 30_000 });
  }
  async refrescar() {
    await this.page.reload();
    await this.listo();
  }
  fila(citaId: string) {
    return this.page.getByTestId(`appt-row-${citaId}`);
  }
  /** La fila del walk-in (única "Sin cliente" tras un reseed limpio). */
  filaWalkin(): Locator {
    return this.page.locator('[data-testid^="appt-row-"]').filter({ hasText: 'Sin cliente' });
  }

  /** Navega el mini-calendario hasta `fechaISO` y la selecciona. */
  async elegirDia(fechaISO: string) {
    const cal = this.page.getByTestId('mini-cal');
    const dia = cal.getByTestId(`cal-dia-${fechaISO}`);
    for (let i = 0; i < 18 && (await dia.count()) === 0; i++) {
      await cal.getByRole('button', { name: 'Mes siguiente' }).click();
    }
    await dia.click();
  }

  // ── Crear cita (HU-REC-001) ──
  /** Crea una cita eligiendo la hora en el selector de franjas; devuelve la hora elegida. */
  async crearCita(opts: { especialista: string; servicio: string; hora?: string; fecha?: string }): Promise<string> {
    await this.page.getByRole('button', { name: 'Nueva cita' }).click();
    const dlg = this.page.getByRole('dialog');
    await dlg.getByLabel('Especialista').selectOption({ label: opts.especialista });
    await dlg.getByRole('button', { name: new RegExp(opts.servicio) }).first().click();
    if (opts.fecha) await dlg.locator('input[type="date"]').fill(opts.fecha);
    const chips = dlg.locator('[data-testid^="franja-"]');
    await expect(chips.first()).toBeVisible({ timeout: 15_000 });
    const chip = opts.hora ? dlg.getByTestId(`franja-${opts.hora}`) : chips.last();
    const hora = (await chip.innerText()).trim();
    await chip.click();
    await dlg.getByRole('button', { name: /Crear cita/ }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
    return hora;
  }

  // ── Reasignar especialista (HU-REC-001, cruzado) ──
  async reasignar(fila: Locator, destino: string) {
    await fila.getByRole('button', { name: 'Acciones' }).click();
    await this.page.getByRole('menuitem', { name: 'Reasignar especialista' }).click();
    const dlg = this.page.getByRole('dialog');
    await dlg.getByRole('combobox').selectOption({ label: destino });
    await dlg.getByRole('button', { name: 'Reasignar', exact: true }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }

  // ── Walk-in + cobro (HU-REC-002) ──
  async walkin(opts: { especialista: string; servicio: string }) {
    await this.page.getByRole('button', { name: 'Walk-in' }).click();
    const dlg = this.page.getByRole('dialog');
    await dlg.getByLabel('Especialista').selectOption({ label: opts.especialista });
    await dlg.getByRole('button', { name: new RegExp(opts.servicio) }).first().click();
    await dlg.getByRole('button', { name: /Iniciar atención/ }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }

  /** Cobra (completa) una fila en progreso desde su menú de acciones. */
  async cobrar(fila: Locator, metodo = 'Efectivo') {
    await fila.getByRole('button', { name: 'Acciones' }).click();
    await this.page.getByRole('menuitem', { name: 'Completar y cobrar' }).click();
    const dlg = this.page.getByRole('dialog');
    await dlg.getByRole('combobox').selectOption({ label: metodo });
    await dlg.getByRole('button', { name: /Cobrar/ }).click();
    await expect(dlg).toBeHidden({ timeout: 15_000 });
  }
}

/** Agenda del especialista (`/especialista` → pestaña Agenda, vista Día). */
export class SpecAgendaPage {
  constructor(private readonly page: Page) {}

  async abrirAgenda() {
    await this.page.getByRole('button', { name: 'Agenda' }).click();
    // Asegura que la agenda terminó de cargar antes de afirmar (evita que un
    // `toHaveCount(0)` "pase" sobre una página a medio renderizar bajo carga).
    await this.page.waitForLoadState('networkidle');
  }
  async refrescar() {
    await this.page.reload();
    await this.abrirAgenda();
  }
  /** Cambia la sede activa del especialista (Perfil → sede → Cambiar) y vuelve a Agenda. */
  async cambiarSede(nombre: string) {
    await this.page.getByRole('button', { name: 'Perfil' }).click();
    await this.page.getByRole('button', { name: new RegExp(nombre) }).click();
    await this.page.getByRole('button', { name: 'Cambiar', exact: true }).click();
    await this.abrirAgenda();
  }
  turno(citaId: string) {
    return this.page.getByTestId(`turno-${citaId}`);
  }
  /** Abre el detalle del turno (desde la agenda del día). */
  async abrirDetalle(citaId: string) {
    await expect(this.turno(citaId)).toBeVisible({ timeout: 15_000 });
    await this.turno(citaId).click();
  }
  /** Abre el detalle del turno, pulsa "Iniciar turno" y confirma la transición. */
  async iniciarTurno(citaId: string) {
    await this.abrirDetalle(citaId);
    await this.page.getByRole('button', { name: 'Iniciar turno' }).click();
    // El detalle se refresca a en_progreso → debe ofrecer "Completar turno".
    await expect(this.page.getByRole('button', { name: 'Completar turno' })).toBeVisible({ timeout: 15_000 });
  }

  // ── Ciclo del turno (FASE-04) ──
  async iniciar() {
    await this.page.getByRole('button', { name: 'Iniciar turno' }).click();
  }
  async completar() {
    await this.page.getByRole('button', { name: 'Completar turno' }).click();
  }
  async cobrar(metodo = 'Efectivo') {
    await this.page.getByText(metodo, { exact: true }).click();
    await this.page.getByRole('button', { name: 'Confirmar cobro y completar' }).click();
  }
  async confirmarCobroSinPago() {
    await this.page.getByRole('button', { name: 'Confirmar cobro y completar' }).click();
  }
  async marcarNoAsistio() {
    await this.page.getByRole('button', { name: 'No asistió' }).click();
    await this.page.getByRole('button', { name: 'Marcar no asistió' }).click();
  }

  // ── Walk-in (FASE-04) ──
  async irAWalkin() {
    await this.page.getByRole('button', { name: 'Walk-in' }).click();
  }
  async elegirServicioWalkin(nombre: string) {
    await this.page.getByRole('button', { name: new RegExp(nombre) }).first().click();
  }
  async walkinVivo(servicio: string) {
    await this.irAWalkin();
    await this.elegirServicioWalkin(servicio);
    await this.page.getByRole('button', { name: 'Iniciar atención' }).click();
  }
  async walkinRetro(servicio: string, inicio: string, fin: string, pago = 'Efectivo') {
    await this.irAWalkin();
    await this.page.getByText('Atención pasada').click();
    await this.elegirServicioWalkin(servicio);
    await this.page.getByPlaceholder('14:00').fill(inicio);
    await this.page.getByPlaceholder('14:40').fill(fin);
    await this.page.getByText(pago, { exact: true }).click();
    await this.page.getByRole('button', { name: 'Registrar atención' }).click();
  }

  // ── Ganancias (FASE-04) ──
  async irAGanancias() {
    await this.page.getByRole('button', { name: 'Ganancias' }).click();
  }
}
