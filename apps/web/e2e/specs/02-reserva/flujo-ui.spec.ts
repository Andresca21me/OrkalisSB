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
  test('flujo completo: servicios → especialista → franja → OTP → confirmación', async ({ page, request }) => {
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
    const code = await booking.leerDevCode();
    await booking.escribirOtp(code);
    await booking.verificar();

    await expect(booking.confirmacionHeading).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Total')).toBeVisible();
  });

  test('OTP incorrecto → mensaje de error y permanece en el paso', async ({ page, request }) => {
    const { sucursalId, servicioId } = await contexto(request);
    const { fecha } = await franjaLibre(request, sucursalId, servicioId, 'any');

    const booking = new BookingPage(page);
    await booking.ir(sucursalId);
    await booking.comenzarReserva();
    await booking.elegirPrimerServicio();
    await booking.elegirCualquiera();
    await booking.elegirDiaYPrimeraFranja(fecha);
    await booking.ingresarDatos(nombreUnico('Cliente'), telefonoUnico());
    await booking.leerDevCode();
    await booking.escribirOtp('000000'); // código equivocado
    await booking.verificar();

    await expect(page.getByText('Código incorrecto. Inténtalo de nuevo.')).toBeVisible({ timeout: 10_000 });
    await expect(booking.confirmacionHeading).toHaveCount(0);
  });

  test('error al abrir la sucursal → estado de error con reintento', async ({ page, request }) => {
    const { sucursalId } = await contexto(request);
    // Forzar un 5xx en la carga de info de la sucursal.
    await page.route(`**/public/${sucursalId}/info`, (route) => route.fulfill({ status: 500, body: '{}' }));
    await new BookingPage(page).ir(sucursalId);
    await expect(page.getByText('No pudimos abrir la reserva')).toBeVisible({ timeout: 15_000 });
  });

  test('gestionar: buscar mi cita por celular', async ({ page, request }) => {
    const { sucursalId, servicioId } = await contexto(request);
    const reserva = await sembrarReserva(request, sucursalId, servicioId);

    const booking = new BookingPage(page);
    await booking.ir(sucursalId);
    await booking.abrirGestionDesdeInicio();
    await booking.buscarCita(reserva.telefono);
    // La ficha de la cita cargó: se pueden reagendar/cancelar.
    await expect(page.getByRole('button', { name: 'Reagendar' })).toBeVisible({ timeout: 15_000 });
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
    await booking.escribirOtp(await booking.leerDevCode());
    await booking.verificar();
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
    await booking.escribirOtp(await booking.leerDevCode());
    await booking.verificar();
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
