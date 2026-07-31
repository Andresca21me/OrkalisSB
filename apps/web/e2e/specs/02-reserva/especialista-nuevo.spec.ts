import { test, expect } from '@playwright/test';
import { BookingPage } from '../../pages/booking.page';
import { USERS } from '../../fixtures/roles';
import { sucursalesDe, serviciosPublicos, crearEspecialista, franjaLibre } from '../../fixtures/api';
import { nombreUnico, fechaMasDias } from '../../fixtures/data';

/**
 * VERIFICACIÓN del bug reportado por el USUARIO: al agregar un especialista
 * nuevo, aparecía en la reserva del cliente SIN ninguna hora para reservar
 * (no había forma de darle horario → quedaba reservable-pero-vacío para siempre).
 *
 * Fix (H-002): `equipo.service.crear` asigna un horario por defecto (Lun–Sáb
 * 9–18) en cada sede asignada. Esta prueba afirma el comportamiento corregido:
 * un especialista recién creado SÍ tiene franjas reservables.
 */
test.describe('Especialista nuevo es reservable (bug reportado)', () => {
  test('un especialista creado por el admin aparece con franjas en la reserva del cliente', async ({ page, request }) => {
    const sucursales = await sucursalesDe(request, USERS.adminBarberia);
    const centro = sucursales.find((s) => /centro/i.test(s.nombre)) ?? sucursales[0];
    const servicios = await serviciosPublicos(request, centro.id);

    // Admin crea el especialista nuevo en Sede Centro.
    const nombre = nombreUnico('Nuevo');
    const nuevoId = await crearEspecialista(request, USERS.adminBarberia, nombre, [centro.id], 'Corte');

    // Oráculo: el especialista nuevo tiene disponibilidad (antes del fix daba 0).
    const { fecha } = await franjaLibre(request, centro.id, servicios[0].id, nuevoId);
    expect(fecha).toBeTruthy();

    // UI del cliente: aparece en la lista y tiene franjas (no es un callejón sin salida).
    const booking = new BookingPage(page);
    await booking.ir(centro.id);
    await booking.comenzarReserva();
    await booking.elegirPrimerServicio();
    await expect(booking.especialistaEnLista(nombre)).toBeVisible({ timeout: 15_000 });
    await booking.elegirEspecialista(nombre);
    await booking.elegirDiaYPrimeraFranja(fecha);
    // Llegar al paso de identificación (campo del celular) prueba que SÍ pudo
    // elegir una franja con el especialista nuevo. (El botón ya no dice
    // «Enviar código»: el OTP solo se pide la primera vez.)
    await expect(page.getByPlaceholder('311 845 2210')).toBeVisible({ timeout: 15_000 });
  });
});
