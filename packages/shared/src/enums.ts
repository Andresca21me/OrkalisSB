/**
 * Enums de dominio — FUENTE DE VERDAD compartida (FASE-01, ADR-008).
 *
 * Tanto la base de datos (FASE-03), la API como el frontend deben usar
 * EXACTAMENTE estos valores. Los términos de dominio se mantienen en español,
 * igual que el modelo ER (ver convenciones globales de PLAN-V1 §5).
 */

/** Roles de usuario interno + operador de la plataforma. */
export enum RolUsuario {
  Admin = 'admin',
  Especialista = 'especialista',
  Recepcionista = 'recepcionista',
  OperadorPlataforma = 'operador_plataforma',
}

/** Perfil del negocio: define plantillas/defaults de configuración. */
export enum PerfilNegocio {
  Salon = 'salon',
  Barberia = 'barberia',
}

/**
 * Plan de suscripción (ADR-009). Dimensión de cobro junto con el nº de
 * especialistas. El catálogo de precios/cupos/funciones por plan vive en un
 * registry de código (FASE-07), no en estos valores.
 */
export enum PlanSuscripcion {
  Basico = 'basico',
  Pro = 'pro',
  Premium = 'premium',
  Empresarial = 'empresarial',
}

/** Estados de la máquina de la cita (detalle en FASE-08). */
export enum EstadoCita {
  Solicitada = 'solicitada',
  Confirmada = 'confirmada',
  EnProgreso = 'en_progreso',
  Completada = 'completada',
  Cancelada = 'cancelada',
  NoAsistio = 'no_asistio',
}

/** Origen de la cita: decide el punto de entrada y la validación (Strategy). */
export enum OrigenCita {
  AgendamientoPublico = 'agendamiento_publico',
  CreacionInterna = 'creacion_interna',
}

/**
 * Estado de la suscripción del negocio (máquina de estados de pagos, ADR-P2).
 * El acceso a la app se decide por este estado (ver `tieneAcceso`).
 */
export enum EstadoSuscripcion {
  /** Prueba gratis de 15 días, sin método de pago. Acceso completo del plan. */
  Prueba = 'prueba',
  /** Pago al día. Acceso completo; entra al cobro recurrente. */
  Activa = 'activa',
  /** Un cobro falló; en ventana de reintentos (≤ 7 días). Acceso con aviso. */
  EnGracia = 'en_gracia',
  /** Sin acceso: prueba vencida, gracia agotada o suspensión del operador. */
  Suspendida = 'suspendida',
  /** El operador asignó beneficios de un plan sin cobro (cuentas de prueba). */
  Cortesia = 'cortesia',
  /** El cliente canceló (terminal). Sin acceso. */
  Cancelada = 'cancelada',
}

/** Tipo de gasto. */
export enum TipoGasto {
  Fijo = 'fijo',
  Variable = 'variable',
}

/** Tipo de producto/ítem. */
export enum TipoProducto {
  Servicio = 'servicio',
  Venta = 'venta',
}

/** Método de pago. */
export enum MetodoPago {
  Efectivo = 'efectivo',
  Tarjeta = 'tarjeta',
  Transferencia = 'transferencia',
  Nequi = 'nequi',
  Otro = 'otro',
}

/** Tipo de repartición (split) profesional/salón. */
export enum SplitType {
  Porcentaje = 'porcentaje',
  ValorFijo = 'valor_fijo',
}

/** Nivel en la cascada de configuración (sistema→negocio→sucursal). */
export enum NivelConfig {
  Sistema = 'sistema',
  Negocio = 'negocio',
  Sucursal = 'sucursal',
}
