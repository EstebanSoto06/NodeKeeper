/* Servicio de Mantenimientos. Mapea 1:1 los endpoints reales de
   backend/src/modules/maintenance/maintenance.routes.js, incluidas las
   transiciones start y complete. NO existe endpoint de cancelacion, por lo
   que este servicio no lo expone. Sin filtros ni paginacion. */
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient.js';

const BASE = '/maintenances';

/** GET /maintenances */
export function list() {
  return apiGet(BASE);
}

/** GET /maintenances/:id */
export function getById(id) {
  return apiGet(`${BASE}/${id}`);
}

/** POST /maintenances (solo ADMIN) */
export function create(payload) {
  return apiPost(BASE, payload);
}

/** PUT /maintenances/:id (solo ADMIN) */
export function update(id, payload) {
  return apiPut(`${BASE}/${id}`, payload);
}

/** DELETE /maintenances/:id (solo ADMIN) */
export function remove(id) {
  return apiDelete(`${BASE}/${id}`);
}

/** POST /maintenances/:id/start (ADMIN u OPERATOR): SCHEDULED -> IN_PROGRESS */
export function start(id) {
  return apiPost(`${BASE}/${id}/start`);
}

/** POST /maintenances/:id/complete (ADMIN u OPERATOR): IN_PROGRESS -> COMPLETED */
export function complete(id) {
  return apiPost(`${BASE}/${id}/complete`);
}
