import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';

export interface UltimoCobro {
  periodo: string;
  estado: string;
  monto: number;
}

export interface ResumenTenant {
  negocioId: string;
  nombre: string;
  perfil: string;
  estadoSuscripcion: string;
  plan: string;
  numEspecialistas: number;
  numSucursales: number;
  cargoMensual: number;
  creadoEn: string;
  ultimoCobro: UltimoCobro | null;
}

export interface CuposMensajeria {
  whatsappUtility: number;
  whatsappMarketing: number;
  sms: number;
  email: number;
}

export interface CobroDetalle {
  id: string;
  periodo: string;
  monto: number;
  estado: string;
  referencia: string;
  creadoEn: string;
  pagadoEn: string | null;
}

export interface DetalleTenant {
  negocio: { id: string; nombre: string; perfil: string; estadoSuscripcion: string; creadoEn: string };
  suscripcion: {
    plan: string;
    numEspecialistas: number;
    estado: string;
    cargoMensual: number;
    metodoUltimos4: string | null;
    proximoCobro: string | null;
  };
  numSucursales: number;
  cobros: CobroDetalle[];
  cupos: { periodo: string; limites: CuposMensajeria; consumo: CuposMensajeria };
}

/** Cuerpo para asignar cortesía (plan + nº de especialistas). */
export interface CortesiaBody {
  plan: string;
  numEspecialistas: number;
}

export interface CobroGenerado {
  cobroId: string;
  referencia: string;
  monto: number;
  periodo: string;
  estado: string;
}

/**
 * Datos y acciones del Operador de Plataforma (FASE-13). Scope global (no
 * tenant-scoped); el backend exige el rol `OperadorPlataforma`.
 */
export function usePlataforma() {
  const { data, cargando, error, recargar } = useApi<ResumenTenant[]>(() =>
    api.get('/plataforma/suscripciones'),
  );

  return {
    negocios: data,
    cargando,
    error,
    recargar,
    detalle: (id: string) => api.get<DetalleTenant>(`/plataforma/negocios/${id}`),
    suspender: (id: string) => api.post<void>(`/plataforma/negocios/${id}/suspender`),
    reactivar: (id: string) => api.post<void>(`/plataforma/negocios/${id}/reactivar`),
    generarCobro: (id: string) => api.post<CobroGenerado>(`/plataforma/negocios/${id}/cobro`),
    darCortesia: (id: string, body: CortesiaBody) =>
      api.post<void>(`/plataforma/negocios/${id}/cortesia`, body),
    quitarCortesia: (id: string) => api.post<void>(`/plataforma/negocios/${id}/cortesia/quitar`),
  };
}
