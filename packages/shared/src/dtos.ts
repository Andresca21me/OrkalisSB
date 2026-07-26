/**
 * DTOs y contratos compartidos front↔back.
 *
 * Solo tipos verdaderamente compartidos entre `api` y `web`. Cada fase agrega
 * aquí los DTOs de los endpoints que cablea (ADR-008).
 */
import type { EstadoCita, EstadoSuscripcion, MetodoPago, OrigenCita, PerfilNegocio, RolUsuario, TipoProducto } from './enums';

/** Negocio (tenant) en el contexto de sesión. */
export interface NegocioSesion {
  id: string;
  nombre: string;
  perfil: PerfilNegocio;
  estadoSuscripcion: EstadoSuscripcion;
}

/** Respuesta de `GET /auth/me`: usuario + su contexto de negocio y alcance. */
export interface SesionUsuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  negocioId: string;
  /** null = alcance consolidado (admin/operador); lista = sucursales asignadas. */
  sucursalIds: string[] | null;
  /** Especialista enlazado (si el usuario es especialista con recurso de agenda). */
  especialistaId: string | null;
  /**
   * Fecha de la última foto del especialista enlazado, para componer su URL.
   * Viaja en la sesión y no en una petición aparte porque el avatar sale en la
   * cabecera del panel desde el primer render. `null` = sin foto (inicial).
   */
  fotoVersion: string | null;
  negocio: NegocioSesion;
}

/** Resumen de ganancias de un especialista en un período (FASE-10, H3). */
export interface GananciasEspecialista {
  desde: string;
  hasta: string;
  servicios: number; // nº de atenciones completadas
  ganServicios: number; // Σ ganancia del profesional por servicios
  comisiones: number; // Σ comisiones por venta de productos
  total: number; // ganServicios + comisiones
}

// ── Reserva pública (FASE-03) ────────────────────────────────────────────────

/** `GET /public/:sucursalId/info`. */
export interface PublicInfo {
  negocioId: string;
  sucursalId: string;
  sucursalNombre: string;
  negocioNombre: string;
  perfil: PerfilNegocio;
  sucursales: { id: string; nombre: string }[];
  /** Días laborables de la sucursal, índice 0=domingo … 6=sábado (true=abre). */
  diasLaborables: boolean[];
  /** Por servicioId, actividad por día (índice 0=domingo … 6=sábado; true=disponible). */
  serviciosDia: Record<string, boolean[]>;
  /** Marca del negocio (branding dinámico); null = se usan los valores por defecto. */
  negocioDescripcion: string | null;
  colorPrimario: string | null;
  logoVersion: string | null;
}

/** Especialista público (para reservar). */
export interface PublicEspecialista {
  id: string;
  nombre: string;
  especialidad: string | null;
  /** Fecha de la foto (hace de versión en la URL) o null si no tiene. */
  fotoVersion: string | null;
}

/** Servicio público (precio como string numérico). */
export interface PublicServicio {
  id: string;
  nombre: string;
  precio: string;
  duracionMin: number;
  categoria: string | null;
  /** Marcado como destacado por el administrador (respaldo de «Lo más reservado»). */
  favorito: boolean;
  /** Veces que se ha reservado en la sucursal (sin canceladas ni ausencias). */
  reservas: number;
  /**
   * Especialistas de ESTA sucursal (activos y libres) que realizan el servicio.
   * Con esta lista el cliente resuelve todo el filtrado por intersección: si
   * llega vacía, nadie puede atenderlo y el servicio no se ofrece.
   */
  especialistaIds: string[];
}

/** Franja libre devuelta por `disponibilidad` (incluye el especialista asignado). */
export interface FranjaPublica {
  inicio: string; // ISO
  fin: string; // ISO
  especialistaId: string;
}

/** Respuesta de `retener`. */
export interface RetencionResp {
  retencionId: string;
  expiraEn: string;
}

/** Respuesta de `otp/enviar` (devCode solo en desarrollo). */
export interface OtpResp {
  /** false = no salió ningún SMS; el código viaja en `devCode` para mostrarlo. */
  enviado: boolean;
  /**
   * false = el teléfono ya es cliente del negocio: no hace falta código y la
   * reserva puede confirmarse directamente. El código solo se pide la primera
   * vez que un número reserva en el negocio.
   */
  requerido: boolean;
  /**
   * Código en claro. Solo llega cuando la mensajería no está operativa (sin
   * proveedor configurado o con el saldo pausado): sin esto nadie podría
   * completar una reserva. Con la mensajería en marcha va siempre `undefined`.
   */
  devCode?: string;
}

/** Respuesta de `confirmar`. */
export interface ConfirmarResp {
  citaId: string;
  codigo: string;
  estado: EstadoCita;
}

// ── Agenda interna / Panel admin (FASE-05) ───────────────────────────────────

/** Cita enriquecida para la agenda/panel del admin (`GET /citas`). */
export interface CitaAgenda {
  id: string;
  sucursalId: string;
  clienteId: string | null;
  clienteNombre: string | null;
  especialistaId: string;
  especialistaNombre: string;
  inicio: string; // ISO
  fin: string; // ISO
  estado: EstadoCita;
  origen: OrigenCita;
  precioEst: string | null;
  servicios: { nombre: string; precio: string }[];
  /** Ids de los servicios de la cita: permiten filtrar quién puede atenderla al reasignar. */
  servicioIds: string[];
}

/** Resumen del panel admin (`GET /reportes/panel?fecha&sucursalId`). */
export interface PanelResumen {
  fecha: string; // YYYY-MM-DD (Bogotá)
  citasHoy: number;
  citasAyer: number;
  ingresosEstimadosHoy: string;
  ticketPromedioHoy: string;
  especialistasTotal: number;
  especialistasDisponibles: number;
  proximaCita: { inicio: string; clienteNombre: string | null } | null;
  /** Resumen del mes en curso (motor financiero). */
  mes: {
    etiqueta: string;
    ingresos: string;
    ganProfesionales: string;
    ganSalon: string;
    valorProductos: string;
  };
}

// ── Clientes / CRM (FASE-06) ─────────────────────────────────────────────────

/** Cliente enriquecido para la tarjeta del directorio (`GET /clientes`). */
export interface ClienteCRM {
  id: string;
  nombre: string;
  telefono: string | null;
  /** ISO; usado para marcar "Nuevo este mes". */
  creadoEn: string;
  /** Nº de servicios completados (atenciones). */
  numServicios: number;
  /** Total gastado acumulado (COP). */
  gastado: number;
  /** ISO de la última atención, o null si nunca ha venido. */
  ultimaVisita: string | null;
}

/** Una visita en la línea de tiempo del historial del cliente. */
export interface VisitaCliente {
  fecha: string; // ISO
  servicio: string;
  especialista: string;
  metodoPago: MetodoPago;
  monto: number;
}

/** Respuesta de `GET /clientes/:id/historial`. */
export interface ClienteHistorial {
  cliente: {
    id: string;
    nombre: string;
    telefono: string | null;
    activo: boolean;
    creadoEn: string;
  };
  numServicios: number;
  gastoAcumulado: number;
  visitas: VisitaCliente[];
}

/** Detalle de una cita pública (gestión). */
export interface CitaPublica {
  id: string;
  codigo: string;
  estado: EstadoCita;
  inicio: string; // ISO
  fin: string; // ISO
  sucursalNombre: string;
  especialistaNombre: string;
  servicios: { nombre: string; precio: string }[];
  total: string;
}

// ── Gestión: Equipo / Servicios / Inventario (FASE-07) ───────────────────────

/** Especialista enriquecido para la pantalla de Equipo (`GET /especialistas`). */
export interface EspecialistaEquipo {
  id: string;
  nombre: string;
  especialidad: string | null;
  disponible: boolean;
  activo: boolean;
  /** Sucursales asignadas (vía `especialista_sucursal`). */
  sucursalIds: string[];
  /**
   * Servicios que realiza. **Lista vacía = realiza todos** (convención de
   * `especialista_servicio`: sin restricción declarada, no hay restricción).
   */
  servicioIds: string[];
  /** Fecha de la foto (hace de versión en la URL) o null si no tiene. */
  fotoVersion: string | null;
}

/** Citas futuras pendientes de un especialista (previo a darlo de baja). */
export interface CitasFuturasResp {
  total: number;
  /** Primeras citas para mostrar en el aviso (no es la lista completa). */
  muestra: { id: string; inicio: string; clienteNombre: string | null; servicios: string[] }[];
}

/** Resultado de dar de baja resolviendo las citas futuras. */
export interface BajaEspecialistaResp {
  reasignadas: number;
  canceladas: number;
}

/** Producto de inventario (`GET /inventario/productos`). Dinero como string numérico. */
export interface ProductoInventario {
  id: string;
  sucursalId: string;
  nombre: string;
  tipo: TipoProducto;
  cantidad: number;
  stockMin: number;
  costo: string;
  precioVenta: string;
  activo: boolean;
}

/** Resultado de liquidación por especialista (`POST /liquidaciones/{preview,generar}`). */
export interface LiquidacionResultado {
  especialistaId: string;
  nombre: string;
  bruto: number;
  /** Parte del bruto que viene de servicios (invariante: servicios + productos = bruto). */
  comisionServicios: number;
  /** Parte del bruto que viene de comisiones por venta de productos. */
  comisionProductos: number;
  descuento: number;
  neto: number;
}

/** Movimiento de stock para el kardex (`GET /inventario/movimientos`). */
export interface MovimientoInventarioItem {
  id: string;
  productoId: string;
  productoNombre: string;
  tipoMov: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  motivo: string | null;
  /** Lo pagado en la compra; `null` cuando el movimiento no es una compra. */
  costoTotal: string | null;
  /** Stock tras el movimiento; `null` en filas anteriores a esta función. */
  stockResultante: number | null;
  gastoId: string | null;
  creadoEn: string;
}

/**
 * Una línea del historial de ventas de producto (`GET /inventario/ventas`).
 *
 * Unifica DOS fuentes que no se pueden fusionar en la base sin duplicar
 * ingresos: la venta dentro de una cita (`atencion_producto`, ya contenida en
 * `atencion.total`) y la venta directa de mostrador (`venta_producto`).
 */
export interface VentaProductoHistorial {
  id: string;
  fecha: string;
  origen: 'cita' | 'directa';
  citaId: string | null;
  atencionId: string | null;
  clienteNombre: string | null;
  especialistaId: string | null;
  especialistaNombre: string | null;
  productoId: string;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  comision: number;
  costoUnitario: number;
  /** Margen bruto de la línea: total − costo. La comisión se reporta aparte. */
  margen: number;
}

/** Historial de ventas con sus totales del período (`GET /inventario/ventas`). */
export interface HistorialVentasResp {
  items: VentaProductoHistorial[];
  totales: {
    total: number;
    comision: number;
    costo: number;
    margen: number;
    unidades: number;
  };
}

// ── Finanzas (FASE-08) ───────────────────────────────────────────────────────

export type SaludFinanciera = 'sin_datos' | 'saludable' | 'ajustada' | 'en_perdida';

/** Reporte financiero agregado (`GET /reportes/financiero`). */
export interface ReporteFinanciero {
  desde: string;
  hasta: string;
  ingresos: number;
  gastos: number;
  gananciaNeta: number;
  margen: number; // 0..1
  salud: SaludFinanciera;
}

/**
 * Análisis financiero del período con desgloses y series para los gráficos
 * (`GET /reportes/analisis`). Todo derivado de atenciones/ventas/gastos.
 */
export interface ReporteAnalisis {
  desde: string;
  hasta: string;
  ingresosTotales: number; // facturado (servicios + productos)
  ingresosSalon: number; // parte del negocio (servicios + ventas netas de comisión)
  ganProfesionales: number; // parte de los profesionales (ya separada en origen)
  ventasProducto: number; // facturado por productos
  servicios: number; // nº de atenciones
  gastosFijos: number;
  gastosVariables: number;
  egresos: number;
  gananciaNeta: number; // ingresosSalon − egresos
  margen: number; // 0..1
  salud: SaludFinanciera;
  porMetodoPago: { metodo: MetodoPago; total: number }[];
  porServicio: { nombre: string; total: number }[];
  porEspecialista: { nombre: string; ingresos: number }[];
  tendencia: { etiqueta: string; total: number }[];
}

/** Cierre de período archivado (`GET /cierres`). */
export interface Cierre {
  id: string;
  sucursalId: string | null;
  tipo: 'quincenal' | 'mensual';
  desde: string;
  hasta: string;
  datosArchivados: ReporteFinanciero;
  creadoEn: string;
}

/** Gasto operativo (`GET /gastos`). */
export interface Gasto {
  id: string;
  sucursalId: string;
  tipo: 'fijo' | 'variable';
  categoria: string | null;
  monto: string;
  activo: boolean;
  creadoEn: string;
}

// ── Configuración (FASE-09) ──────────────────────────────────────────────────

/** Canal lógico de cupo de mensajería (ADR-009). */
export type CanalCupo = 'whatsapp_utility' | 'whatsapp_marketing' | 'sms' | 'email';

/**
 * Estado de cupo de un canal en el **ciclo de cobro** vigente
 * (`GET /notificaciones/cupos`). Los cupos se recargan en el aniversario de
 * cobro del negocio, no el día 1 del mes (Plan-Mensajeria D1).
 */
export interface EstadoCupo {
  canal: CanalCupo;
  consumo: number;
  cupo: number;
  restante: number;
  dentroDeCupo: boolean;
  /** Inicio del ciclo vigente (ISO, inclusivo). */
  cicloInicio: string;
  /** Fin del ciclo vigente (ISO, exclusivo). */
  cicloFin: string;
}

/** Eventos cuyo texto puede personalizar cada negocio (FASE-04, D5). */
export type EventoPlantilla =
  | 'confirmacion'
  | 'recordatorio'
  | 'aviso'
  | 'aviso_especialista'
  | 'marketing';

/** Canales que admiten plantilla (el OTP NO es configurable, es de plataforma). */
export type CanalPlantilla = 'sms' | 'whatsapp';

/**
 * Variables permitidas en las plantillas. Es una **whitelist**: guardar una
 * variable fuera de esta lista se rechaza, para que un typo no acabe enviándose
 * al cliente como `{{fehca}}`.
 */
export const VARIABLES_PLANTILLA = [
  'cliente',
  'fecha',
  'hora',
  'sucursal',
  'especialista',
  'servicio',
  /** Solo en `aviso_especialista`: "nueva cita", "cancelada"… */
  'motivo',
] as const;

export type VariablePlantilla = (typeof VARIABLES_PLANTILLA)[number];

/** Plantilla de un evento/canal (`GET /notificaciones/plantillas`). */
export interface PlantillaMensaje {
  evento: EventoPlantilla;
  canal: CanalPlantilla;
  /** Texto del negocio; `null` = usa el default de plataforma. */
  contenidoSms: string | null;
  whatsappContentSid: string | null;
  activo: boolean;
  /** Texto de plataforma que se usa cuando no hay personalización. */
  porDefecto: string;
  actualizadoEn: string | null;
}

/** Aviso persistente para el admin (`GET /notificaciones/alertas`). */
export interface AlertaAdmin {
  id: string;
  tipo: string;
  severidad: 'aviso' | 'critico' | string;
  titulo: string;
  detalle: string | null;
  leidaEn: string | null;
  creadoEn: string;
}

/** Usuario interno con acceso (`GET /usuarios`). */
export interface UsuarioInterno {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  /** Sucursales asignadas; vacío = admin (todas). */
  sucursalIds: string[];
}

// ── Registro de mensajes (FASE-10) ───────────────────────────────────────────

/** Una fila del outbox tal como la ve el admin (`GET /notificaciones/mensajes`). */
export interface MensajeRegistro {
  id: string;
  canal: 'sms' | 'whatsapp' | 'email';
  tipo: string;
  estado: 'pendiente' | 'enviando' | 'enviado' | 'entregado' | 'fallido' | 'sin_cupo';
  destino: string;
  cuerpo: string | null;
  error: string | null;
  intento: number;
  sobreCupo: boolean;
  /** Id en el proveedor: sirve para rastrear el envío en el panel de Twilio. */
  proveedorId: string | null;
  citaId: string | null;
  creadoEn: string;
  enviadoEn: string | null;
  entregadoEn: string | null;
}

export interface PaginaMensajes {
  total: number;
  pagina: number;
  porPagina: number;
  mensajes: MensajeRegistro[];
}

/** Conteo por estado del período (`GET /notificaciones/mensajes/resumen`). */
export interface ResumenMensajes {
  dias: number;
  total: number;
  porEstado: Record<string, number>;
  /** Fracción 0..1 de mensajes fallidos o sin cupo. */
  tasaFallo: number;
}
