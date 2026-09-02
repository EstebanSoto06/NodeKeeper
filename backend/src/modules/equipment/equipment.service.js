import { prisma } from "../../config/prisma.js";
import { createHttpError } from "../../utils/http-error.js";
import { isForeignKeyConstraintError } from "../../utils/foreign-key-error.js";
import { runSerializableTransaction } from "../../utils/serializable-transaction.js";
import {
  activeMaintenancesAffectingEquipment,
  checkManualStatusChange,
  EQUIPMENT_NORMAL_STATUS,
  MANUAL_STATUS_VIOLATION,
} from "../../utils/maintenance-status-rules.js";

const equipmentInclude = {
  networkNode: true,
  supportProvider: true,
};

async function assertNetworkNodeExists(networkNodeId) {
  const networkNode = await prisma.networkNode.findUnique({
    where: { id: networkNodeId },
  });

  if (!networkNode) {
    throw createHttpError(404, "Network node not found");
  }
}

async function assertSupportProviderExists(supportProviderId) {
  if (!supportProviderId) {
    return;
  }

  const supportProvider = await prisma.supportProvider.findUnique({
    where: { id: supportProviderId },
  });

  if (!supportProvider) {
    throw createHttpError(404, "Support provider not found");
  }
}

export async function listEquipment() {
  return prisma.equipment.findMany({
    include: equipmentInclude,
    orderBy: { name: "asc" },
  });
}

export async function getEquipmentById(id) {
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: equipmentInclude,
  });

  if (!equipment) {
    throw createHttpError(404, "Equipment not found");
  }

  return equipment;
}

/* Misma regla que en network-node.service.js, con OPERATIONAL como estado
   normal: MAINTENANCE lo asigna solo el ciclo de vida de una orden, y un
   equipo ocupado por una orden en ejecucion no puede devolverse a OPERATIONAL
   a mano. Reenviar el MAINTENANCE que el equipo ya tiene si se permite, para
   no romper la edicion de nombre, categoria o proveedor durante una orden.
   OUT_OF_SERVICE siempre se puede registrar. */
const AUTOMATIC_STATUS_ERROR =
  "El estado En mantenimiento lo asigna el sistema al iniciar un mantenimiento y no puede establecerse manualmente.";

const ACTIVE_MAINTENANCE_STATUS_ERROR =
  "No se puede marcar el equipo como Operativo mientras tiene un mantenimiento en ejecución.";

function throwManualStatusViolation(violation) {
  if (violation === MANUAL_STATUS_VIOLATION.AUTOMATIC) {
    throw createHttpError(409, AUTOMATIC_STATUS_ERROR);
  }

  if (violation === MANUAL_STATUS_VIOLATION.ACTIVE_MAINTENANCE) {
    throw createHttpError(409, ACTIVE_MAINTENANCE_STATUS_ERROR);
  }
}

export async function createEquipment(data) {
  await assertNetworkNodeExists(data.networkNodeId);
  await assertSupportProviderExists(data.supportProviderId);

  // Un equipo recien creado no puede tener ordenes en ejecucion: la unica
  // regla aplicable es que MAINTENANCE no sea asignable a mano.
  throwManualStatusViolation(
    checkManualStatusChange({
      requestedStatus: data.status,
      currentStatus: undefined,
      hasActiveMaintenance: false,
      normalStatus: EQUIPMENT_NORMAL_STATUS,
    }),
  );

  try {
    return await prisma.equipment.create({
      data,
      include: equipmentInclude,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createHttpError(409, "Equipment serial number already exists");
    }

    throw error;
  }
}

export async function updateEquipment(id, data) {
  await getEquipmentById(id);

  if (data.networkNodeId) {
    await assertNetworkNodeExists(data.networkNodeId);
  }

  if (data.supportProviderId !== undefined) {
    await assertSupportProviderExists(data.supportProviderId);
  }

  try {
    // Transaccion Serializable por el mismo motivo que updateNetworkNode:
    // aqui se LEE Maintenance (las ordenes activas sobre el equipo) y se
    // ESCRIBE Equipment, justo el cruce inverso al de startMaintenance.
    return await runSerializableTransaction(async (tx) => {
      const current = await tx.equipment.findUnique({
        where: { id },
        select: { id: true, status: true, networkNodeId: true },
      });

      if (!current) {
        throw createHttpError(404, "Equipment not found");
      }

      // Se pregunta por el nodo ACTUAL del equipo, no por el del payload: lo
      // que decide si esta ocupado es la orden que corre sobre el ahora.
      const activeMaintenanceCount = await tx.maintenance.count({
        where: activeMaintenancesAffectingEquipment(current),
      });

      // Mover el equipo de nodo durante una orden activa rompe el mismo
      // invariante que reasignar la orden (ver updateMaintenance): el nodo
      // de origen quedaria en MAINTENANCE sin nadie que lo liberase -al
      // completar, el equipo ya no seria suyo- y el de destino recibiria un
      // equipo en MAINTENANCE sin estarlo el. Se prohibe el traslado
      // mientras dure la orden; el resto de campos se editan igual.
      if (
        activeMaintenanceCount > 0 &&
        data.networkNodeId !== undefined &&
        data.networkNodeId !== current.networkNodeId
      ) {
        throw createHttpError(
          409,
          "No se puede cambiar el equipo de nodo mientras tiene un mantenimiento en ejecución.",
        );
      }

      throwManualStatusViolation(
        checkManualStatusChange({
          requestedStatus: data.status,
          currentStatus: current.status,
          hasActiveMaintenance: activeMaintenanceCount > 0,
          normalStatus: EQUIPMENT_NORMAL_STATUS,
        }),
      );

      return tx.equipment.update({
        where: { id },
        data,
        include: equipmentInclude,
      });
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createHttpError(409, "Equipment serial number already exists");
    }

    throw error;
  }
}

const MAINTENANCE_HISTORY_ERROR =
  "No se puede eliminar el equipo porque posee historial de mantenimiento.";

export async function deleteEquipment(id) {
  await getEquipmentById(id);

  // Comprobacion previa: mejora el mensaje para el caso comun, pero no es la
  // defensa definitiva contra una carrera (ver catch de P2003 mas abajo, que
  // es lo que realmente impide la eliminacion si un Maintenance se crea justo
  // despues de este conteo).
  const maintenanceCount = await prisma.maintenance.count({
    where: { equipmentId: id },
  });

  if (maintenanceCount > 0) {
    throw createHttpError(409, MAINTENANCE_HISTORY_ERROR);
  }

  try {
    await prisma.equipment.delete({ where: { id } });
  } catch (error) {
    // Violacion de llave foranea (P2003, o su equivalente SQLSTATE
    // 23001/23503 con @prisma/adapter-pg, ver isForeignKeyConstraintError).
    // Con Maintenance.equipmentId ahora en ON DELETE RESTRICT, esto ocurre
    // si un Maintenance referencia este equipo (por ejemplo, creado justo
    // despues del conteo anterior). Se traduce a 409 de negocio, nunca un
    // 500, sin exponer el nombre interno de la restriccion.
    if (isForeignKeyConstraintError(error)) {
      throw createHttpError(409, MAINTENANCE_HISTORY_ERROR);
    }

    throw error;
  }
}
