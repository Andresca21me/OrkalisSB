/**
 * Regla de acceso por estado de suscripción (Plan-Pagos FASE-00, ADR-P2).
 *
 * La implementación vive en `@orkalis/shared` para ser UNA sola fuente de verdad
 * compartida con el frontend (`auth.tsx`). Este módulo solo la reexpone en la
 * ruta documentada del backend (`pagos/acceso`).
 */
export { tieneAcceso } from '@orkalis/shared';
