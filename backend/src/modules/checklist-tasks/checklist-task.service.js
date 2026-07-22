import { prisma } from "../../config/prisma.js";
import { createHttpError } from "../../utils/http-error.js";
import { runSerializableTransaction } from "../../utils/serializable-transaction.js";

const completedByInclude = {
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
  },
};

async function getMaintenanceOrThrow(client, maintenanceId) {
  const maintenance = await client.maintenance.findUnique({
    where: { id: maintenanceId },
  });

  if (!maintenance) {
    throw createHttpError(404, "Maintenance not found");
  }

  return maintenance;
}

async function getChecklistTaskOrThrow(client, maintenanceId, taskId) {
  // Se filtra siempre por taskId + maintenanceId para que una tarea de otro
  // mantenimiento nunca sea visible ni modificable a traves de esta ruta.
  const task = await client.checklistTask.findFirst({
    where: { id: taskId, maintenanceId },
    include: { completedBy: completedByInclude },
  });

  if (!task) {
    throw createHttpError(404, "Checklist task not found");
  }

  return task;
}

function assertMaintenanceStatus(maintenance, expectedStatus, action) {
  if (maintenance.status !== expectedStatus) {
    throw createHttpError(409, `Checklist tasks can only be ${action}`);
  }
}

export async function listChecklistTasks(maintenanceId) {
  await getMaintenanceOrThrow(prisma, maintenanceId);

  return prisma.checklistTask.findMany({
    where: { maintenanceId },
    include: { completedBy: completedByInclude },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createChecklistTask(maintenanceId, data) {
  return runSerializableTransaction(async (tx) => {
    const maintenance = await getMaintenanceOrThrow(tx, maintenanceId);

    assertMaintenanceStatus(
      maintenance,
      "SCHEDULED",
      "created while the maintenance is scheduled",
    );

    return tx.checklistTask.create({
      data: {
        maintenanceId,
        description: data.description,
        sortOrder: data.sortOrder ?? 0,
      },
      include: { completedBy: completedByInclude },
    });
  });
}

export async function updateChecklistTask(maintenanceId, taskId, data) {
  return runSerializableTransaction(async (tx) => {
    const maintenance = await getMaintenanceOrThrow(tx, maintenanceId);

    assertMaintenanceStatus(
      maintenance,
      "SCHEDULED",
      "edited while the maintenance is scheduled",
    );

    await getChecklistTaskOrThrow(tx, maintenanceId, taskId);

    return tx.checklistTask.update({
      where: { id: taskId },
      data: {
        description: data.description,
        sortOrder: data.sortOrder,
      },
      include: { completedBy: completedByInclude },
    });
  });
}

export async function deleteChecklistTask(maintenanceId, taskId) {
  return runSerializableTransaction(async (tx) => {
    const maintenance = await getMaintenanceOrThrow(tx, maintenanceId);

    assertMaintenanceStatus(
      maintenance,
      "SCHEDULED",
      "deleted while the maintenance is scheduled",
    );

    await getChecklistTaskOrThrow(tx, maintenanceId, taskId);

    await tx.checklistTask.delete({ where: { id: taskId } });
  });
}

export async function setChecklistTaskStatus(
  maintenanceId,
  taskId,
  isCompleted,
  userId,
) {
  return runSerializableTransaction(async (tx) => {
    const maintenance = await getMaintenanceOrThrow(tx, maintenanceId);

    assertMaintenanceStatus(
      maintenance,
      "IN_PROGRESS",
      "updated while the maintenance is in progress",
    );

    await getChecklistTaskOrThrow(tx, maintenanceId, taskId);

    // Idempotencia entre dos PATCH concurrentes sobre la MISMA tarea: el
    // WHERE condicionado por el isCompleted actual hace que, ante dos
    // solicitudes "true" simultaneas, solo una encuentre la fila en
    // isCompleted:false y la actualice; la otra no modifica nada y
    // completedAt/completedById originales quedan intactos.
    await tx.checklistTask.updateMany({
      where: { id: taskId, maintenanceId, isCompleted: !isCompleted },
      data: isCompleted
        ? { isCompleted: true, completedAt: new Date(), completedById: userId }
        : { isCompleted: false, completedAt: null, completedById: null },
    });

    return getChecklistTaskOrThrow(tx, maintenanceId, taskId);
  });
}
