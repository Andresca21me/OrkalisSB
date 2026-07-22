import type { CanalPlantilla, EventoPlantilla, PlantillaMensaje } from '@orkalis/shared';
import { api } from './api';
import { useApi } from './useApi';

/** Plantillas del negocio por evento + el texto por defecto (FASE-04, D5). */
export function usePlantillas(canal: CanalPlantilla = 'sms') {
  return useApi<PlantillaMensaje[]>(() => api.get(`/notificaciones/plantillas?canal=${canal}`), [canal]);
}

/** Guarda una plantilla; `contenidoSms` vacío = volver al texto por defecto. */
export function guardarPlantilla(
  evento: EventoPlantilla,
  canal: CanalPlantilla,
  body: { contenidoSms?: string | null; whatsappContentSid?: string | null; activo?: boolean },
): Promise<unknown> {
  return api.put(`/notificaciones/plantillas/${evento}/${canal}`, body);
}
