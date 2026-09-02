/* Reglas que relacionan el estado de un NetworkNode/Equipment con las ordenes
   de mantenimiento que lo afectan.

   Vive en utils/ y no dentro del modulo de mantenimiento porque la MISMA
   definicion la necesitan tres modulos: maintenance (para poner y quitar
   MAINTENANCE al iniciar/completar), network-nodes y equipment (para rechazar
   los cambios manuales de estado que romperian esa sincronizacion). Tenerla
   en un solo lugar es lo que garantiza que las tres no puedan divergir; si
   cada modulo la reescribiera, un cambio en la definicion de "afecta"
   quedaria aplicado a medias. */

/* MAINTENANCE es un estado AUTOMATICO en los dos enums (NodeStatus y
   EquipmentStatus): lo escribe exclusivamente el ciclo de vida de una orden
   (POST /maintenances/:id/start y /complete). Ningun cliente puede asignarlo
   a mano, ni por el formulario ni llamando directo a la API. */
export const AUTOMATIC_STATUS = "MAINTENANCE";

// El estado "normal" (recurso en servicio y libre) tiene un nombre distinto
// en cada enum, y es la unica diferencia entre las reglas de nodo y de
// equipo; se pasa como parametro en vez de duplicar la funcion.
export const NODE_NORMAL_STATUS = "AVAILABLE";
export const EQUIPMENT_NORMAL_STATUS = "OPERATIONAL";

// OUT_OF_SERVICE responde a una razon de negocio ajena al mantenimiento
// (avera, baja, retiro) y por eso tiene PRIORIDAD sobre MAINTENANCE: se puede
// asignar en cualquier momento, incluso con una orden en ejecucion, y ninguna
// escritura automatica lo revierte.
export const MANUAL_ONLY_STATUS = "OUT_OF_SERVICE";

/* Un mantenimiento "afecta" a un recurso cuando su ejecucion implica que ese
   recurso esta intervenido:

     PREVENTIVE (networkNodeId): afecta al nodo y a TODOS sus equipos.
     CORRECTIVE (equipmentId):   afecta al equipo y a su nodo padre, pero NO
                                 a los demas equipos de ese nodo.

   Ambos filtros se apoyan en que prepareMaintenanceData deja siempre
   exactamente una de las dos columnas poblada (networkNodeId en PREVENTIVE,
   equipmentId en CORRECTIVE). */

// Mantenimientos IN_PROGRESS que mantienen ocupado a un nodo: los preventivos
// del propio nodo y los correctivos de cualquiera de sus equipos.
export function activeMaintenancesAffectingNode(networkNodeId) {
  return {
    status: "IN_PROGRESS",
    OR: [{ networkNodeId }, { equipment: { networkNodeId } }],
  };
}

// Mantenimientos IN_PROGRESS que mantienen ocupado a un equipo: los
// correctivos de ese equipo y los preventivos de su nodo padre (que por
// definicion intervienen todos los equipos del nodo).
export function activeMaintenancesAffectingEquipment({ id, networkNodeId }) {
  return {
    status: "IN_PROGRESS",
    OR: [{ equipmentId: id }, { networkNodeId }],
  };
}

export const MANUAL_STATUS_VIOLATION = {
  // El cliente intenta ASIGNAR MAINTENANCE, que solo escribe el sistema.
  AUTOMATIC: "AUTOMATIC_STATUS",
  // El cliente intenta liberar (AVAILABLE/OPERATIONAL) un recurso que una
  // orden en ejecucion mantiene ocupado.
  ACTIVE_MAINTENANCE: "ACTIVE_MAINTENANCE",
};

/**
 * Decide si un cambio MANUAL de estado (PUT /network-nodes/:id o
 * PUT /equipment/:id) es admisible. Devuelve `null` si lo es, o el motivo del
 * rechazo (MANUAL_STATUS_VIOLATION) para que cada modulo redacte su mensaje.
 *
 * La distincion clave es entre "mantener el estado automatico que ya tiene"
 * y "asignar MAINTENANCE a mano": lo primero es un no-op sobre la columna y
 * DEBE permitirse, porque de lo contrario editar el nombre o la ubicacion de
 * un recurso en mantenimiento fallaria solo por reenviar su estado actual en
 * el payload. Lo segundo es lo que se prohibe.
 *
 * @param {object} params
 * @param {string|undefined} params.requestedStatus estado del payload; si es
 *   `undefined` el estado no se toca y no hay nada que validar.
 * @param {string|undefined} params.currentStatus estado ya persistido; en un
 *   alta no existe todavia.
 * @param {boolean} params.hasActiveMaintenance si alguna orden IN_PROGRESS
 *   afecta al recurso.
 * @param {string} params.normalStatus AVAILABLE (nodo) u OPERATIONAL (equipo).
 * @returns {string|null}
 */
export function checkManualStatusChange({
  requestedStatus,
  currentStatus,
  hasActiveMaintenance,
  normalStatus,
}) {
  if (requestedStatus === undefined) {
    return null;
  }

  // OUT_OF_SERVICE siempre se puede registrar, incluso durante una orden.
  if (requestedStatus === MANUAL_ONLY_STATUS) {
    return null;
  }

  if (requestedStatus === AUTOMATIC_STATUS) {
    // Reenviar el estado actual es conservarlo, no asignarlo.
    return currentStatus === AUTOMATIC_STATUS
      ? null
      : MANUAL_STATUS_VIOLATION.AUTOMATIC;
  }

  if (requestedStatus === normalStatus && hasActiveMaintenance) {
    return MANUAL_STATUS_VIOLATION.ACTIVE_MAINTENANCE;
  }

  return null;
}
