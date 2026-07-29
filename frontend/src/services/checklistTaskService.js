/* Servicio de Tareas de checklist. Estos endpoints estan anidados bajo un
   mantenimiento: /maintenances/:maintenanceId/checklist-tasks (ver
   backend/src/modules/checklist-tasks/checklist-task.routes.js), por lo que
   todas las funciones reciben maintenanceId como primer argumento. */
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './apiClient.js';

function base(maintenanceId) {
  return `/maintenances/${maintenanceId}/checklist-tasks`;
}

/** GET .../checklist-tasks */
export function list(maintenanceId) {
  return apiGet(base(maintenanceId));
}

/** POST .../checklist-tasks (solo ADMIN) */
export function create(maintenanceId, payload) {
  return apiPost(base(maintenanceId), payload);
}

/** PUT .../checklist-tasks/:taskId (solo ADMIN) */
export function update(maintenanceId, taskId, payload) {
  return apiPut(`${base(maintenanceId)}/${taskId}`, payload);
}

/** PATCH .../checklist-tasks/:taskId/status (ADMIN u OPERATOR) */
export function setStatus(maintenanceId, taskId, payload) {
  return apiPatch(`${base(maintenanceId)}/${taskId}/status`, payload);
}

/** DELETE .../checklist-tasks/:taskId (solo ADMIN) */
export function remove(maintenanceId, taskId) {
  return apiDelete(`${base(maintenanceId)}/${taskId}`);
}
