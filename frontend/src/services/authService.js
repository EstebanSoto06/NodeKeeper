/* Servicio de autenticacion. Rutas sin prefijo /api (la base del apiClient ya
   lo incluye). Mapea unicamente los endpoints reales: POST /auth/login y
   GET /auth/me. */
import { apiPost, apiGet } from './apiClient.js';

/** POST /auth/login -> { user, token } */
export function login(email, password) {
  return apiPost('/auth/login', { email, password });
}

/** GET /auth/me -> user actual (revalida el token) */
export async function getCurrentUser() {
  const data = await apiGet('/auth/me');
  return data.user;
}
