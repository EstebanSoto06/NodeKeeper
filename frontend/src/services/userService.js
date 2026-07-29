/* Servicio de Usuarios. Mapea 1:1 los endpoints reales de
   backend/src/modules/users/user.routes.js. Exclusivo de ADMIN (el backend
   rechaza a OPERATOR con 403 en todas las rutas, incluida la lectura).
   No existe DELETE: el modelo prefiere activar/desactivar (isActive) sobre
   el borrado fisico, para no perder la atribucion de quien creo/inicio/
   cerro mantenimientos o completo tareas de checklist. */
import { apiGet, apiPost, apiPatch } from './apiClient.js';

const BASE = '/users';

/** GET /users */
export function list() {
  return apiGet(BASE);
}

/** GET /users/:id */
export function getById(id) {
  return apiGet(`${BASE}/${id}`);
}

/** POST /users — { name, email, password, role? } */
export function create(payload) {
  return apiPost(BASE, payload);
}

/** PATCH /users/:id — { name, email, role } */
export function update(id, payload) {
  return apiPatch(`${BASE}/${id}`, payload);
}

/** PATCH /users/:id/status — { isActive } */
export function setActive(id, isActive) {
  return apiPatch(`${BASE}/${id}/status`, { isActive });
}

/** PATCH /users/:id/password — { newPassword } (restablecimiento administrativo) */
export function resetPassword(id, newPassword) {
  return apiPatch(`${BASE}/${id}/password`, { newPassword });
}
