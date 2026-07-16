/**
 * Contratos de tokens JWT (FASE-05, ADR-003).
 */

/** Claims del access token. */
export interface AccessTokenPayload {
  sub: string; // usuario_id
  negocio_id: string;
  rol: string; // RolUsuario
  sucursal_ids: string[] | null; // null = alcance consolidado (admin)
  tipo: 'access';
}

/** Claims del refresh token. */
export interface RefreshTokenPayload {
  sub: string; // usuario_id
  negocio_id: string;
  jti: string; // id del token (rastreado en refresh_token)
  familia: string; // familia de rotación
  tipo: 'refresh';
}

/** Respuesta de login/refresh. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
