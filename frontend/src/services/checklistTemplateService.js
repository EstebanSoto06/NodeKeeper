/* Servicio de Plantillas de checklist (listas de tareas reutilizables),
   conectado a /checklist-templates (backend/src/modules/checklist-templates).

   TODOS los endpoints son ADMIN-only en el backend, incluidos los de lectura:
   una plantilla solo se usa desde flujos que ya requieren ADMIN (crear un
   mantenimiento y modificar la estructura de un checklist). Un OPERATOR
   recibe 403 en cualquiera de ellos, asi que la UI no debe invocarlos para
   ese rol.

   Aplicar una plantilla NO vive aqui como recurso propio: la operacion crea
   ChecklistTask, por lo que cuelga del checklist del mantenimiento
   (POST /maintenances/:id/checklist-tasks/apply-template). Se expone en este
   modulo por comodidad del llamador, pero apunta a esa ruta. */
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient.js';

const BASE = '/checklist-templates';

/** GET /checklist-templates (solo ADMIN) */
export function list() {
  return apiGet(BASE);
}

/** GET /checklist-templates/:id (solo ADMIN) */
export function getById(id) {
  return apiGet(`${BASE}/${id}`);
}

/** POST /checklist-templates (solo ADMIN). payload: { name, description?, items: [{ description }] } */
export function create(payload) {
  return apiPost(BASE, payload);
}

/** PUT /checklist-templates/:id (solo ADMIN). El array items es el estado final. */
export function update(id, payload) {
  return apiPut(`${BASE}/${id}`, payload);
}

/** DELETE /checklist-templates/:id (solo ADMIN). No afecta tareas ya copiadas. */
export function remove(id) {
  return apiDelete(`${BASE}/${id}`);
}

/** POST /maintenances/:maintenanceId/checklist-tasks/apply-template (solo ADMIN,
    solo con el mantenimiento SCHEDULED). Devuelve el checklist completo. */
export function applyToMaintenance(maintenanceId, templateId) {
  return apiPost(`/maintenances/${maintenanceId}/checklist-tasks/apply-template`, {
    templateId,
  });
}
