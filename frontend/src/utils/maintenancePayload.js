/* Construye el cuerpo de PUT /maintenances/:id a partir de un mantenimiento
   YA cargado, aplicando solo los cambios indicados.

   Existe porque el endpoint de actualizacion NO es parcial: valida el cuerpo
   completo con maintenanceSchema (title y type obligatorios) y
   prepareMaintenanceData exige networkNodeId en PREVENTIVE y equipmentId en
   CORRECTIVE (backend/src/modules/maintenance/*). Enviar solo la fecha
   devolveria 400 y, peor aun, un cuerpo incompleto borraria datos. Por eso
   cualquier cambio puntual -- como reprogramar arrastrando en el calendario --
   debe reenviar el resto de la orden tal cual estaba.

   Campos NO incluidos a proposito: status, startedAt, completedAt y los
   *ById. El backend no los acepta en este endpoint (los gobiernan
   start/complete), asi que reprogramar nunca altera el estado ni la
   trazabilidad de quien inicio o cerro la orden. */

/**
 * @param {object} maintenance orden tal como la devuelve GET /maintenances
 * @param {object} [overrides] campos a sobrescribir (p. ej. { scheduledDate })
 * @returns {object} cuerpo listo para maintenanceService.update
 */
export function buildMaintenanceUpdatePayload(maintenance, overrides = {}) {
  const isPreventive = maintenance.type === 'PREVENTIVE';

  return {
    title: maintenance.title,
    description: maintenance.description ?? null,
    type: maintenance.type,
    // El backend devuelve la fecha en ISO completo; el schema la acepta igual
    // (z.coerce.date), pero se normaliza a "YYYY-MM-DD" para no reintroducir
    // una hora que la aplicacion nunca muestra ni deja editar.
    scheduledDate: maintenance.scheduledDate ? String(maintenance.scheduledDate).slice(0, 10) : null,
    // La respuesta trae networkNodeId en preventivo y equipmentId en
    // correctivo; se leen tambien de la relacion incluida por si acaso.
    networkNodeId: isPreventive ? (maintenance.networkNodeId || maintenance.networkNode?.id || null) : null,
    equipmentId: isPreventive ? null : (maintenance.equipmentId || maintenance.equipment?.id || null),
    ...overrides,
  };
}
