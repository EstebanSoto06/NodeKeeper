import { prisma } from "../../config/prisma.js";
import { createHttpError } from "../../utils/http-error.js";

const relatedUserSelect = {
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
  },
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
  evidences: true,
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

export async function createMaintenance(data, userId) {
  const preparedData = await prepareMaintenanceData(data);

  return prisma.maintenance.create({
    data: {
      ...preparedData,
      createdById: userId,
    },
    include: maintenanceInclude,
  });
}

export async function updateMaintenance(id, data) {
  await getMaintenanceById(id);

  const preparedData = await prepareMaintenanceData(data);

  return prisma.maintenance.update({
    where: { id },
    data: preparedData,
    include: maintenanceInclude,
  });
}

export async function deleteMaintenance(id) {
  await getMaintenanceById(id);

  await prisma.maintenance.delete({ where: { id } });
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
  const outcome = await prisma.$transaction(async (tx) => {
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
