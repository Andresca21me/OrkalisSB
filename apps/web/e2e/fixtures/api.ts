import { expect, type APIRequestContext } from '@playwright/test';
import { loginAPI } from './roles';
import { telefonoUnico, nombreUnico, fechaMasDias } from './data';

/**
 * Oráculo de API (FASE-00 v3). Se usa para PREPARAR (obtener ids, sembrar una
 * cita cuando la prueba solo observa) o como doble verificación — NUNCA para
 * sustituir la aserción del flujo, que siempre es sobre la UI.
 */

export interface Sucursal { id: string; nombre: string }
export interface Servicio { id: string; nombre: string; precio?: number; duracionMin?: number }
export interface Franja { inicio: string; fin: string; especialistaId: string }

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Sucursales del tenant del usuario (requiere token de ese tenant). */
export async function sucursalesDe(request: APIRequestContext, email: string): Promise<Sucursal[]> {
  const token = await loginAPI(request, email);
  const res = await request.get('/api/sucursales', { headers: authHeaders(token) });
  expect(res.ok(), 'GET /sucursales').toBeTruthy();
  return res.json();
}

/** Catálogo público de servicios de una sucursal (sin token). */
export async function serviciosPublicos(request: APIRequestContext, sucursalId: string): Promise<Servicio[]> {
  const res = await request.get(`/api/public/${sucursalId}/servicios`);
  expect(res.ok(), 'GET /public/servicios').toBeTruthy();
  return res.json();
}

/** Especialistas públicos (reservables) de una sucursal (sin token). */
export async function especialistasPublicos(
  request: APIRequestContext,
  sucursalId: string,
): Promise<{ id: string; nombre: string }[]> {
  const res = await request.get(`/api/public/${sucursalId}/especialistas`);
  expect(res.ok(), 'GET /public/especialistas').toBeTruthy();
  return res.json();
}

/** Primera franja libre (hoy..+maxDias) para un servicio. `especialista` = uuid o 'any'. */
export async function franjaLibre(
  request: APIRequestContext,
  sucursalId: string,
  servicioId: string,
  especialista = 'any',
  maxDias = 10,
  desdeDia = 0,
): Promise<{ fecha: string; franja: Franja }> {
  for (let i = desdeDia; i <= desdeDia + maxDias; i++) {
    const fecha = fechaMasDias(i);
    const res = await request.get(
      `/api/public/${sucursalId}/disponibilidad?especialista=${especialista}&servicios=${servicioId}&fecha=${fecha}`,
    );
    const franjas = (await res.json()) as Franja[];
    if (Array.isArray(franjas) && franjas.length > 0) return { fecha, franja: franjas[0] };
  }
  throw new Error(`Sin disponibilidad en ${maxDias} días para servicio ${servicioId}`);
}

export interface ReservaSembrada {
  citaId: string;
  telefono: string;
  nombre: string;
  servicioId: string;
  especialistaId: string;
  fecha: string;
  franja: Franja;
}

/**
 * Siembra una reserva confirmada por API (retener → OTP → confirmar). Útil
 * cuando la prueba quiere OBSERVAR el reflejo de una cita en una vista sin
 * agendar por UI (el agendado por UI se prueba en FASE-02). Devuelve datos
 * únicos para localizar la cita en las vistas observadoras.
 */
export async function sembrarReserva(
  request: APIRequestContext,
  sucursalId: string,
  servicioId: string,
  opts: { telefono?: string; nombre?: string; especialista?: string; maxDias?: number } = {},
): Promise<ReservaSembrada> {
  const telefono = opts.telefono ?? telefonoUnico();
  const nombre = opts.nombre ?? nombreUnico('Cliente');
  const { fecha, franja } = await franjaLibre(
    request,
    sucursalId,
    servicioId,
    opts.especialista ?? 'any',
    opts.maxDias ?? 10,
  );

  const ret = await request.post(`/api/public/${sucursalId}/retener`, {
    data: { especialistaId: franja.especialistaId, inicio: franja.inicio, fin: franja.fin },
  });
  expect(ret.ok(), 'POST /retener').toBeTruthy();
  const { retencionId } = await ret.json();

  const otp = await request.post(`/api/public/${sucursalId}/otp/enviar`, { data: { telefono } });
  const { devCode } = await otp.json();
  expect(devCode, 'devCode de OTP en dev').toBeTruthy();

  const conf = await request.post(`/api/public/${sucursalId}/confirmar`, {
    data: { retencionId, telefono, nombre, codigoOtp: devCode, servicioIds: [servicioId] },
  });
  expect(conf.status(), await conf.text()).toBe(201);
  const { citaId } = await conf.json();

  return { citaId, telefono, nombre, servicioId, especialistaId: franja.especialistaId, fecha, franja };
}

/** Crea un especialista (admin) asignado a las sucursales dadas. Devuelve su id. */
export async function crearEspecialista(
  request: APIRequestContext,
  email: string,
  nombre: string,
  sucursalIds: string[],
  especialidad?: string,
): Promise<string> {
  const token = await loginAPI(request, email);
  const res = await request.post('/api/especialistas', {
    headers: authHeaders(token),
    data: { nombre, especialidad, sucursalIds },
  });
  expect(res.ok(), `POST /especialistas: ${res.status()}`).toBeTruthy();
  return (await res.json()).id as string;
}

export interface CitaApi {
  id: string;
  estado: string;
  clienteNombre: string | null;
  especialistaId: string;
  especialistaNombre: string;
  inicio: string;
  fin: string;
}

/**
 * Citas (enriquecidas) de una sucursal en un día Bogotá. Oráculo para LOCALIZAR
 * el id de una cita creada por UI (p. ej. un walk-in o una cita nueva), nunca
 * para sustituir la aserción sobre la vista.
 */
export async function citasDelDia(
  request: APIRequestContext,
  email: string,
  sucursalId: string,
  fechaISO: string,
): Promise<CitaApi[]> {
  const token = await loginAPI(request, email);
  const desde = `${fechaISO}T05:00:00.000Z`;
  const d = new Date(`${fechaISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const hasta = `${d.toISOString().slice(0, 10)}T05:00:00.000Z`;
  const res = await request.get(
    `/api/citas?desde=${desde}&hasta=${hasta}&sucursalId=${sucursalId}`,
    { headers: authHeaders(token) },
  );
  expect(res.ok(), 'GET /citas').toBeTruthy();
  return res.json();
}

/** Crea una cita interna agendada (admin/recepción) por API. Devuelve su id. */
export async function crearCitaInterna(
  request: APIRequestContext,
  email: string,
  body: { sucursalId: string; especialistaId: string; clienteId?: string; servicioIds: string[]; inicio: string },
): Promise<{ id: string }> {
  const token = await loginAPI(request, email);
  const res = await request.post('/api/citas', { headers: authHeaders(token), data: body });
  expect(res.ok(), `POST /citas: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

export interface ClienteCRM {
  id: string;
  nombre: string;
  telefono: string | null;
  numServicios: number;
  gastado: number;
  activo?: boolean;
}

/** Directorio CRM del tenant (solo clientes activos). `buscar` filtra por nombre/teléfono. */
export async function clientesDe(request: APIRequestContext, email: string, buscar?: string): Promise<ClienteCRM[]> {
  const token = await loginAPI(request, email);
  const qs = buscar ? `?buscar=${encodeURIComponent(buscar)}` : '';
  const res = await request.get(`/api/clientes${qs}`, { headers: authHeaders(token) });
  expect(res.ok(), 'GET /clientes').toBeTruthy();
  return res.json();
}

/** Historial CRM de un cliente (incluye inactivos: sirve para verificar la baja lógica). */
export async function historialClienteApi(
  request: APIRequestContext,
  email: string,
  clienteId: string,
): Promise<{ numServicios: number; gastoAcumulado: number; visitas: unknown[]; cliente: { activo: boolean } }> {
  const token = await loginAPI(request, email);
  const res = await request.get(`/api/clientes/${clienteId}/historial`, { headers: authHeaders(token) });
  expect(res.ok(), 'GET /clientes/:id/historial').toBeTruthy();
  return res.json();
}

/** Aplica una transición de estado a una cita por API (p. ej. 'iniciar'). */
export async function accionCitaApi(
  request: APIRequestContext,
  email: string,
  citaId: string,
  evento: 'aprobar' | 'iniciar' | 'cancelar' | 'no-asistio',
): Promise<void> {
  const token = await loginAPI(request, email);
  const res = await request.post(`/api/citas/${citaId}/${evento}`, { headers: authHeaders(token) });
  expect(res.ok(), `POST /citas/:id/${evento}: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/** Completa (cobra) una cita por API. Crea la atención que alimenta el CRM. */
export async function completarCitaApi(
  request: APIRequestContext,
  email: string,
  citaId: string,
  metodoPago = 'efectivo',
): Promise<void> {
  const token = await loginAPI(request, email);
  const res = await request.post(`/api/citas/${citaId}/completar`, { headers: authHeaders(token), data: { metodoPago } });
  expect(res.ok(), `POST /citas/:id/completar: ${res.status()} ${await res.text()}`).toBeTruthy();
}

export interface EspecialistaEquipo {
  id: string;
  nombre: string;
  especialidad: string | null;
  activo: boolean;
  disponible: boolean;
  sucursalIds: string[];
}

/** Equipo (admin): especialistas con sus sucursales asignadas y estado. */
export async function equipoDe(request: APIRequestContext, email: string): Promise<EspecialistaEquipo[]> {
  const token = await loginAPI(request, email);
  const res = await request.get('/api/especialistas', { headers: authHeaders(token) });
  expect(res.ok(), 'GET /especialistas').toBeTruthy();
  return res.json();
}

/** Crea un servicio (admin). `splitType`: 'porcentaje' | 'valor_fijo'. Devuelve su id. */
export async function crearServicioApi(
  request: APIRequestContext,
  email: string,
  body: { nombre: string; precio: number; duracionMin: number; splitType: string; splitValor: number; categoria?: string },
): Promise<{ id: string }> {
  const token = await loginAPI(request, email);
  const res = await request.post('/api/servicios', { headers: authHeaders(token), data: body });
  expect(res.ok(), `POST /servicios: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

export interface ProductoInv {
  id: string;
  nombre: string;
  cantidad: number;
  stockMin: number;
  costo: string;
}

/** Productos de inventario de una sucursal (admin). */
export async function productosDe(request: APIRequestContext, email: string, sucursalId: string): Promise<ProductoInv[]> {
  const token = await loginAPI(request, email);
  const res = await request.get(`/api/inventario/productos?sucursalId=${sucursalId}`, { headers: authHeaders(token) });
  expect(res.ok(), 'GET /inventario/productos').toBeTruthy();
  return res.json();
}

export interface LiquidacionRow {
  especialistaId: string;
  nombre: string;
  bruto: number;
  descuento: number;
  neto: number;
}

/** Previsualización de liquidación de una sucursal/periodo (admin). */
export async function previewLiquidacionApi(
  request: APIRequestContext,
  email: string,
  body: { desde: string; hasta: string; sucursalId: string },
): Promise<LiquidacionRow[]> {
  const token = await loginAPI(request, email);
  const res = await request.post('/api/liquidaciones/preview', { headers: authHeaders(token), data: body });
  expect(res.ok(), `POST /liquidaciones/preview: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

export interface AnalisisApi {
  ingresosTotales: number;
  ingresosSalon: number;
  gastosFijos: number;
  gastosVariables: number;
  egresos: number;
  gananciaNeta: number;
  margen: number;
  salud: string;
}

/** Reporte de análisis financiero de un rango/sucursal (admin). */
export async function analisisApi(
  request: APIRequestContext,
  email: string,
  desde: string,
  hasta: string,
  sucursalId?: string,
): Promise<AnalisisApi> {
  const token = await loginAPI(request, email);
  const qs = `desde=${desde}&hasta=${hasta}${sucursalId ? `&sucursalId=${sucursalId}` : ''}`;
  const res = await request.get(`/api/reportes/analisis?${qs}`, { headers: authHeaders(token) });
  expect(res.ok(), 'GET /reportes/analisis').toBeTruthy();
  return res.json();
}

export interface TenantPlataforma {
  negocioId: string;
  nombre: string;
  plan: string;
  estadoSuscripcion: string;
  numEspecialistas: number;
  numSucursales: number;
  cargoMensual: number;
}

/** Lista de tenants de la consola del operador de plataforma. */
export async function suscripcionesPlataformaApi(request: APIRequestContext, email: string): Promise<TenantPlataforma[]> {
  const token = await loginAPI(request, email);
  const res = await request.get('/api/plataforma/suscripciones', { headers: authHeaders(token) });
  expect(res.ok(), 'GET /plataforma/suscripciones').toBeTruthy();
  return res.json();
}

/** Cambia el estado de un tenant desde el operador (suspender/reactivar). */
export async function cambiarEstadoTenantApi(request: APIRequestContext, email: string, negocioId: string, accion: 'suspender' | 'reactivar'): Promise<void> {
  const token = await loginAPI(request, email);
  const res = await request.post(`/api/plataforma/negocios/${negocioId}/${accion}`, { headers: authHeaders(token) });
  expect([200, 204], `${accion} tenant`).toContain(res.status());
}

/** negocioId del tenant del usuario (vía /auth/me). */
export async function negocioIdDe(request: APIRequestContext, email: string): Promise<string> {
  const token = await loginAPI(request, email);
  const res = await request.get('/api/auth/me', { headers: authHeaders(token) });
  expect(res.ok(), 'GET /auth/me').toBeTruthy();
  const me = await res.json();
  return (me.negocioId ?? me.negocio?.id) as string;
}

/** Fija un valor de config (booleano o numérico) a nivel de negocio. */
export async function setConfigApi(
  request: APIRequestContext,
  email: string,
  negocioId: string,
  clave: string,
  valor: boolean | number,
): Promise<void> {
  const token = await loginAPI(request, email);
  const res = await request.put(`/api/config/negocio/${negocioId}/${clave}`, { headers: authHeaders(token), data: { valor } });
  expect(res.ok(), `PUT /config/negocio/${clave}: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/** Activa/desactiva un módulo a nivel de negocio (azúcar sobre setConfigApi). */
export async function setModuloApi(
  request: APIRequestContext,
  email: string,
  negocioId: string,
  clave: string,
  valor: boolean,
): Promise<void> {
  return setConfigApi(request, email, negocioId, clave, valor);
}

/** Código de reserva de una cita pública (para la búsqueda en "Mi cita"). */
export async function codigoDeCita(
  request: APIRequestContext,
  sucursalId: string,
  citaId: string,
): Promise<string> {
  const res = await request.get(`/api/public/${sucursalId}/cita/${citaId}`);
  expect(res.ok(), 'GET /public/cita/:id').toBeTruthy();
  return (await res.json()).codigo as string;
}
