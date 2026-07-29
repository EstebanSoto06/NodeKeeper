/* Servicio de Proveedores de soporte. Mapea 1:1 los endpoints reales de
   backend/src/modules/support-providers/support-provider.routes.js. Sin
   filtros ni paginacion (el backend no los expone). */
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient.js';

const BASE = '/support-providers';

/** GET /support-providers */
export function list() {
  return apiGet(BASE);
}

/** GET /support-providers/:id */
export function getById(id) {
  return apiGet(`${BASE}/${id}`);
}

/** POST /support-providers (solo ADMIN) */
export function create(payload) {
  return apiPost(BASE, payload);
}

/** PUT /support-providers/:id (solo ADMIN) */
export function update(id, payload) {
  return apiPut(`${BASE}/${id}`, payload);
}

/** DELETE /support-providers/:id (solo ADMIN) */
export function remove(id) {
  return apiDelete(`${BASE}/${id}`);
}
