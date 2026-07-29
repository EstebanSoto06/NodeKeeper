/* Servicio de Equipos. Mapea 1:1 los endpoints reales de
   backend/src/modules/equipment/equipment.routes.js. Sin filtros ni
   paginacion. */
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient.js';

const BASE = '/equipment';

/** GET /equipment */
export function list() {
  return apiGet(BASE);
}

/** GET /equipment/:id */
export function getById(id) {
  return apiGet(`${BASE}/${id}`);
}

/** POST /equipment (solo ADMIN) */
export function create(payload) {
  return apiPost(BASE, payload);
}

/** PUT /equipment/:id (solo ADMIN) */
export function update(id, payload) {
  return apiPut(`${BASE}/${id}`, payload);
}

/** DELETE /equipment/:id (solo ADMIN) */
export function remove(id) {
  return apiDelete(`${BASE}/${id}`);
}
