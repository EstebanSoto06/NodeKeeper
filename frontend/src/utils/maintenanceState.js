/* Fuente central de las reglas VISUALES del ciclo de vida de un mantenimiento.
   Refleja exactamente lo que el backend permite (ver
   backend/src/modules/maintenance/*): las unicas transiciones con endpoint
   real son start (SCHEDULED -> IN_PROGRESS) y complete (IN_PROGRESS ->
   COMPLETED). CANCELLED existe en el enum MaintenanceStatus pero NO tiene
   endpoint, por lo que aqui nunca se ofrece una accion "Cancelar".

   Las evidencias y las tareas de checklist solo pueden crearse/eliminarse
   mientras el mantenimiento esta IN_PROGRESS (reglas impuestas en el
   backend); estos helpers permiten que la UI refleje esas reglas sin
   duplicarlas a mano en cada pantalla. */

import { MAINTENANCE_STATUS } from './statusMaps.js';

export const MAINTENANCE_STATES = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

/** Config visual (label + colores) del estado. Reutiliza statusMaps. */
export function maintenanceStatusView(status) {
  return MAINTENANCE_STATUS[status] || MAINTENANCE_STATUS.SCHEDULED;
}

/** Solo se puede iniciar un mantenimiento programado. */
export function canStart(status) {
  return status === MAINTENANCE_STATES.SCHEDULED;
}

/** Solo se puede completar un mantenimiento en progreso. */
export function canComplete(status) {
  return status === MAINTENANCE_STATES.IN_PROGRESS;
}

/** Evidencias (subir/eliminar) solo son editables mientras esta en progreso. */
export function canManageEvidence(status) {
  return status === MAINTENANCE_STATES.IN_PROGRESS;
}

/** Marcar/desmarcar una tarea existente (PATCH de estado) solo mientras esta
    en progreso (backend: checklist-task.service.js#setChecklistTaskStatus). */
export function canManageChecklist(status) {
  return status === MAINTENANCE_STATES.IN_PROGRESS;
}

/** Crear/editar/eliminar tareas (estructura del checklist) solo mientras el
    mantenimiento esta programado (backend: checklist-task.service.js
    #createChecklistTask/#updateChecklistTask/#deleteChecklistTask exigen
    SCHEDULED). No confundir con canManageChecklist, que rige el toggle. */
export function canManageChecklistStructure(status) {
  return status === MAINTENANCE_STATES.SCHEDULED;
}

/**
 * Acciones de transicion disponibles para un estado dado, en el orden en que
 * deberian mostrarse. Cada accion nombra el metodo del maintenanceService que
 * la ejecuta (start/complete); NUNCA incluye "cancelar" porque no hay endpoint.
 */
export function availableActions(status) {
  const actions = [];
  if (canStart(status)) {
    actions.push({ key: 'start', label: 'Iniciar mantenimiento', service: 'start' });
  }
  if (canComplete(status)) {
    actions.push({ key: 'complete', label: 'Completar mantenimiento', service: 'complete' });
  }
  return actions;
}
