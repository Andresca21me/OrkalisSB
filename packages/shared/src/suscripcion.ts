import { EstadoSuscripcion } from './enums';

/**
 * Regla ÚNICA de acceso por estado de suscripción (ADR-P2). La usan el guard
 * del backend y el frontend (`auth.tsx`) — no debe duplicarse en otro lugar.
 *
 * Tienen acceso a la app: `prueba`, `activa`, `en_gracia` (con aviso) y
 * `cortesia`. Quedan bloqueados: `suspendida` y `cancelada`.
 */
export function tieneAcceso(estado: EstadoSuscripcion): boolean {
  return (
    estado === EstadoSuscripcion.Prueba ||
    estado === EstadoSuscripcion.Activa ||
    estado === EstadoSuscripcion.EnGracia ||
    estado === EstadoSuscripcion.Cortesia
  );
}
