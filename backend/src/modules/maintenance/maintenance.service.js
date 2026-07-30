import { prisma } from "../../config/prisma.js";
import { createHttpError } from "../../utils/http-error.js";
import { runSerializableTransaction } from "../../utils/serializable-transaction.js";
import {
  deleteEvidenceFromQuarantine,
  moveEvidenceToQuarantine,
  restoreEvidenceFromQuarantine,
} from "../../utils/evidence-file.js";

const relatedUserSelect = {
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
  },
};

// storedName/relativePath son detalles internos del filesystem y nunca deben
// viajar al cliente: se restringe explicitamente con select en vez de
// `evidences: true`, que traeria todas las columnas del modelo Evidence.
const evidencesInclude = {
  select: {
    id: true,
    maintenanceId: true,
    originalName: true,
    mimeType: true,
    sizeBytes: true,
    createdAt: true,
    uploadedBy: relatedUserSelect,
  },
  orderBy: { createdAt: "asc" },
};

const maintenanceInclude = {
  networkNode: true,
  equipment: true,
  createdBy: relatedUserSelect,
  startedBy: relatedUserSelect,
  closedBy: relatedUserSelect,
  checklistTasks: {
    orderBy: { sortOrder: "asc" },
  },
  evidences: evidencesInclude,
};

async function assertNetworkNodeExists(networkNodeId) {
  const networkNode = await prisma.networkNode.findUnique({
    where: { id: networkNodeId },
  });

  if (!networkNode) {
    throw createHttpError(404, "Network node not found");
  }
}

async function assertEquipmentExists(equipmentId) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
  });

  if (!equipment) {
    throw createHttpError(404, "Equipment not found");
  }
}

async function prepareMaintenanceData(data) {
  if (data.type === "PREVENTIVE") {
    if (!data.networkNodeId) {
      throw createHttpError(400, "Preventive maintenance requires a network node");
    }

    await assertNetworkNodeExists(data.networkNodeId);

    return { ...data, equipmentId: null };
  }

  if (!data.equipmentId) {
    throw createHttpError(400, "Corrective maintenance requires equipment");
  }

  await assertEquipmentExists(data.equipmentId);

  return { ...data, networkNodeId: null };
}

export async function listMaintenances() {
  return prisma.maintenance.findMany({
    include: maintenanceInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getMaintenanceById(id) {
  const maintenance = await prisma.maintenance.findUnique({
    where: { id },
    include: maintenanceInclude,
  });

  if (!maintenance) {
    throw createHttpError(404, "Maintenance not found");
  }

  return maintenance;
}

// prepareMaintenanceData ya confirmo que el nodo/equipo existia en el momento
// de la lectura, pero entre esa lectura y este write alguien mas pudo
// eliminarlo (p. ej. una eliminacion de Equipment que ya no tenia
// mantenimientos en ese instante). La foreign key rechaza el INSERT/UPDATE
// con P2003 en ese caso; se traduce a 404 en vez de dejarlo escapar como 500.
function rethrowAsNotFoundOnForeignKeyViolation(error) {
  if (error.code === "P2003") {
    throw createHttpError(
      404,
      "The referenced network node or equipment no longer exists",
    );
  }

  throw error;
}

export async function createMaintenance(data, userId) {
  const preparedData = await prepareMaintenanceData(data);

  try {
    return await prisma.maintenance.create({
      data: {
        ...preparedData,
        createdById: userId,
      },
      include: maintenanceInclude,
    });
  } catch (error) {
    return rethrowAsNotFoundOnForeignKeyViolation(error);
  }
}

export async function updateMaintenance(id, data) {
  await getMaintenanceById(id);

  const preparedData = await prepareMaintenanceData(data);

  try {
    return await prisma.maintenance.update({
      where: { id },
      data: preparedData,
      include: maintenanceInclude,
    });
  } catch (error) {
    return rethrowAsNotFoundOnForeignKeyViolation(error);
  }
}

async function restoreQuarantinedEvidences(storedNames) {
  await Promise.all(
    storedNames.map((storedName) => restoreEvidenceFromQuarantine(storedName)),
  );
}

export async function deleteMaintenance(id) {
  const maintenance = await prisma.maintenance.findUnique({ where: { id } });

  if (!maintenance) {
    throw createHttpError(404, "Maintenance not found");
  }

  const evidences = await prisma.evidence.findMany({
    where: { maintenanceId: id },
    select: { id: true, storedName: true },
  });

  // PostgreSQL y el filesystem no comparten una transaccion atomica: los
  // archivos se mueven a cuarentena ANTES de borrar en base de datos para
  // poder restaurarlos si el delete falla, evitando dejar filas borradas
  // con archivos huerfanos o archivos borrados con filas aun presentes.
  const movedStoredNames = [];

  for (const evidence of evidences) {
    try {
      await moveEvidenceToQuarantine(evidence.storedName);
      movedStoredNames.push(evidence.storedName);
    } catch (error) {
      if (error.code === "ENOENT") {
        // El archivo fisico ya no existe: no hay nada que mover ni
        // restaurar para esta evidencia en particular, se continua.
        continue;
      }

      await restoreQuarantinedEvidences(movedStoredNames);
      throw createHttpError(
        500,
        "Failed to prepare evidence files for deletion",
      );
    }
  }

  try {
    await prisma.maintenance.delete({ where: { id } });
  } catch (error) {
    await restoreQuarantinedEvidences(movedStoredNames);
    throw error;
  }

  await Promise.all(
    movedStoredNames.map((storedName) =>
      deleteEvidenceFromQuarantine(storedName).catch((cleanupError) => {
        console.error(
          `Evidence quarantine cleanup failed for maintenance ${id}: ${cleanupError.message}`,
        );
      }),
    ),
  );
}

export async function startMaintenance(id, userId) {
  // Transicion atomica: solo cambia SCHEDULED -> IN_PROGRESS.
  // El WHERE condicionado por id + status hace que dos solicitudes
  // simultaneas no puedan iniciar el mismo mantenimiento dos veces:
  // PostgreSQL bloquea la fila y la segunda ya no cumple el WHERE.
  const result = await prisma.maintenance.updateMany({
    where: { id, status: "SCHEDULED" },
    data: {
      status: "IN_PROGRESS",
      startedAt: new Date(),
      startedById: userId,
    },
  });

  if (result.count === 0) {
    // Ninguna fila cambio: distinguir inexistente (404) de conflicto (409).
    await getMaintenanceById(id);
    throw createHttpError(409, "Only scheduled maintenances can be started");
  }

  return getMaintenanceById(id);
}

export async function completeMaintenance(id, userId) {
  // Se agrupan la verificacion del checklist y la transicion de estado en una
  // transaccion. La transicion IN_PROGRESS -> COMPLETED se hace condicionada
  // por id + status, de modo que dos "complete" simultaneos no puedan cerrar
  // el mismo mantenimiento dos veces (la segunda encuentra 0 filas).
  //
  // Se usa aislamiento Serializable (via runSerializableTransaction) y no
  // solo la transaccion por defecto: esta funcion LEE ChecklistTask (el
  // conteo de pendientes) y luego ESCRIBE Maintenance, mientras que
  // checklist-task.service.js LEE Maintenance.status y luego ESCRIBE
  // ChecklistTask. Esas dos direcciones cruzadas forman un ciclo de
  // dependencias real: si un PATCH de estado de una tarea reabre la
  // checklist justo despues de que este conteo la vio completa, pero antes
  // de que el UPDATE de abajo confirme, el mantenimiento podria quedar
  // COMPLETED con una tarea pendiente. PostgreSQL solo detecta y aborta ese
  // ciclo si AMBOS lados corren en Serializable (con READ COMMITTED, un lado
  // no participa en la deteccion y el ciclo puede colarse sin error).
  const outcome = await runSerializableTransaction(async (tx) => {
    const maintenance = await tx.maintenance.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!maintenance) {
      return "NOT_FOUND";
    }

    if (maintenance.status !== "IN_PROGRESS") {
      return "INVALID_STATE";
    }

    const pendingTasks = await tx.checklistTask.count({
      where: {
        maintenanceId: id,
        isCompleted: false,
      },
    });

    if (pendingTasks > 0) {
      return "CHECKLIST_INCOMPLETE";
    }

    const result = await tx.maintenance.updateMany({
      where: { id, status: "IN_PROGRESS" },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        closedById: userId,
      },
    });

    if (result.count === 0) {
      // Perdio la carrera: otra solicitud concurrente ya cambio el estado.
      return "INVALID_STATE";
    }

    return "COMPLETED";
  });

  if (outcome === "NOT_FOUND") {
    throw createHttpError(404, "Maintenance not found");
  }

  if (outcome === "CHECKLIST_INCOMPLETE") {
    throw createHttpError(
      409,
      "The checklist must be completed before closing the maintenance",
    );
  }

  if (outcome === "INVALID_STATE") {
    throw createHttpError(409, "Only in-progress maintenances can be completed");
  }

  return getMaintenanceById(id);
}
