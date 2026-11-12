import { test, expect } from '@playwright/test';
import { BookingPage } from '../../pages/booking.page';
import { USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, franjaLibre, sembrarReserva } from '../../fixtures/api';
import { nombreUnico, telefonoUnico, fechaMasDias } from '../../fixtures/data';

/**
 * Reserva del cliente por la UI, paso a paso (FASE-02 v3, HU-CLI-001..006).
 * Conduce el asistente completo en un navegador y afirma sobre la UI real.
 */
async function contexto(request: import('@playwright/test').APIRequestContext) {
  const sucursales = await sucursalesDe(request, USERS.adminBarberia);
  const sucursalId = sucursales[0].id;
  const servicios = await serviciosPublicos(request, sucursalId);
  return { sucursalId, servicioId: servicios[0].id };
}

test.describe('Reserva del cliente por la UI', () => {
  test('flujo completo: servicios → especialista → franja → datos → confirmación', async ({ page, request }) => {
    const { sucursalId, servicioId } = await contexto(request);
    // El día con cupo para el primer servicio + "cualquiera" (mismo query que la UI).
    const { fecha } = await franjaLibre(request, sucursalId, servicioId, 'any');

    const booking = new BookingPage(page);
    await booking.ir(sucursalId);
    await booking.comenzarReserva();
    await booking.elegirPrimerServicio();
    await booking.elegirCualquiera();
    await booking.elegirDiaYPrimeraFranja(fecha);
    await booking.ingresarDatos(nombreUnico('Cliente'), telefonoUnico());

    await expect(booking.confirmacionHeading).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Total')).toBeVisible();
  });


  test('error al abrir la sucursal → estado de error con reintento', async ({ page, request }) => {
    const { sucursalId } = await contexto(request);
    // Forzar un 5xx en la carga de info de la sucursal.
    await page.route(`**/public/${sucursalId}/info`, (route) => route.fulfill({ status: 500, body: '{}' }));
    await new BookingPage(page).ir(sucursalId);
    await expect(page.getByText('No pudimos abrir la reserva')).toBeVisible({ timeout: 15_000 });
  });

  test('otro dispositivo: buscar por celular NO muestra la cita, solo avisa del enlace por SMS', async ({ page, request }) => {
    const { sucursalId, servicioId } = await contexto(request);
    const reserva = await sembrarReserva(request, sucursalId, servicioId);

    // Navegador nuevo (sin tokens guardados) = otro dispositivo.
    const booking = new BookingPage(page);
    await booking.ir(sucursalId);
    await booking.abrirGestionDesdeInicio();
    await booking.pedirEnlaceDeCita(reserva.telefono);
    await expect(page.getByText(/te enviamos un enlace por mensaje/i)).toBeVisible({ timeout: 15_000 });
    // La cita NO aparece: ni acciones ni especialista.
    await expect(page.getByRole('button', { name: 'Reagendar' })).toHaveCount(0);
    await expect(page.getByText('Especialista')).toHaveCount(0);
  });

  test('el enlace de gestión (SMS) abre la cita y permite cancelarla', async ({ page, request }) => {
    const { sucursalId, servicioId } = await contexto(request);
    // A partir de MAÑANA: supera la antelación mínima de cancelación (2 h).
    const reserva = await sembrarReserva(request, sucursalId, servicioId, { desdeDia: 1 });

    const booking = new BookingPage(page);
    await booking.abrirEnlaceGestion(sucursalId, reserva.tokenGestion);
    await expect(page.getByRole('button', { name: 'Reagendar' })).toBeVisible({ timeout: 15_000 });
    await booking.cancelarCita();
    await expect(page.getByText('Esta cita fue cancelada. Puedes reservar una nueva cuando quieras.')).toBeVisible({ timeout: 15_000 });
  });

  test('un enlace de gestión inventado no abre ninguna cita', async ({ page, request }) => {
    const { sucursalId } = await contexto(request);
    const booking = new BookingPage(page);
    await booking.abrirEnlaceGestion(sucursalId, 'f'.repeat(64));
    await expect(page.getByText(/enlace no es válido/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Reagendar' })).toHaveCount(0);
  });

  test('mismo dispositivo: tras reservar, "Ya tengo una cita" la abre sin pedir el celular', async ({ page, request }) => {
    const { sucursalId, servicioId } = await contexto(request);
    const { fecha } = await franjaLibre(request, sucursalId, servicioId, 'any', 10, 1);

    const booking = new BookingPage(page);
    await booking.ir(sucursalId);
    await booking.comenzarReserva();
    await booking.elegirPrimerServicio();
    await booking.elegirCualquiera();
    await booking.elegirDiaYPrimeraFranja(fecha);
    await booking.ingresarDatos(nombreUnico('Cliente'), telefonoUnico());
    await expect(booking.confirmacionHeading).toBeVisible({ timeout: 15_000 });

    // Volver a entrar a la reserva en el mismo navegador.
    await booking.ir(sucursalId);
    await booking.abrirGestionDesdeInicio();
    await expect(page.getByRole('button', { name: 'Reagendar' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder('311 845 2210')).toHaveCount(0);
  });

  test('cancelar una cita (con antelación suficiente) la deja cancelada', async ({ page, request }) => {
    const { sucursalId, servicioId } = await contexto(request);
    // Reservar a partir de MAÑANA: así supera la antelación mínima de cancelación (2 h).
    const { fecha } = await franjaLibre(request, sucursalId, servicioId, 'any', 10, 1);

    const booking = new BookingPage(page);
    await booking.ir(sucursalId);
    await booking.comenzarReserva();
    await booking.elegirPrimerServicio();
    await booking.elegirCualquiera();
    await booking.elegirDiaYPrimeraFranja(fecha);
    await booking.ingresarDatos(nombreUnico('Cliente'), telefonoUnico());
    await expect(booking.confirmacionHeading).toBeVisible({ timeout: 15_000 });

    await booking.irAVerMiCita();
    await booking.cancelarCita();
    await expect(page.getByText('Esta cita fue cancelada. Puedes reservar una nueva cuando quieras.')).toBeVisible({ timeout: 15_000 });
  });

  test('cancelar dentro de la ventana de antelación → rechazo con mensaje (HU-CLI-006 esc. 2)', async ({ page, request }) => {
    const { sucursalId, servicioId } = await contexto(request);
    // Buscar una franja de HOY a menos de 2 h (dentro de la ventana de antelación).
    const res = await request.get(
      `/api/public/${sucursalId}/disponibilidad?especialista=any&servicios=${servicioId}&fecha=${fechaMasDias(0)}`,
    );
    const franjas = (await res.json()) as { inicio: string }[];
    const dentroVentana = Array.isArray(franjas) && franjas.some((f) => new Date(f.inicio).getTime() - Date.now() < 2 * 3600_000);
    test.skip(!dentroVentana, 'No hay franja de hoy dentro de la ventana de 2 h a esta hora del día.');

    const booking = new BookingPage(page);
    await booking.ir(sucursalId);
    await booking.comenzarReserva();
    await booking.elegirPrimerServicio();
    await booking.elegirCualquiera();
    await booking.elegirDiaYPrimeraFranja(fechaMasDias(0)); // primera franja de hoy (la más cercana)
    await booking.ingresarDatos(nombreUnico('Cliente'), telefonoUnico());
    await expect(booking.confirmacionHeading).toBeVisible({ timeout: 15_000 });

    await booking.irAVerMiCita();
    await booking.cancelarCita();
    // El backend exige ≥2 h de antelación → mensaje de error; la cita NO se cancela.
    await expect(page.getByText(/antelación/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Esta cita fue cancelada. Puedes reservar una nueva cuando quieras.')).toHaveCount(0);
  });

  test('disponibilidad vacía: un día sin cupo muestra el estado vacío', async ({ page, request }) => {
    const { sucursalId, servicioId } = await contexto(request);
    // Buscar (vía API) un día sin franjas dentro de la tira de 14 días.
    let diaVacio: string | null = null;
    for (let i = 0; i < 14; i++) {
      const fecha = fechaMasDias(i);
      const res = await request.get(
        `/api/public/${sucursalId}/disponibilidad?especialista=any&servicios=${servicioId}&fecha=${fecha}`,
      );
      const franjas = await res.json();
      if (Array.isArray(franjas) && franjas.length === 0) { diaVacio = fecha; break; }
    }
    test.skip(!diaVacio, 'El seed tiene cupo todos los días: no hay caso de día vacío que probar.');

    const booking = new BookingPage(page);
    await booking.ir(sucursalId);
    await booking.comenzarReserva();
    await booking.elegirPrimerServicio();
    await booking.elegirCualquiera();
    await booking.esperarDiaSinCupo(diaVacio!);
  });
});
