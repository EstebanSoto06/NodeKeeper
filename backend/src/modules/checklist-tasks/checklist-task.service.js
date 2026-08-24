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

// Aplicar una plantilla es una modificacion ESTRUCTURAL del checklist, no
// una operacion nueva con reglas propias: reutiliza exactamente la misma
// autorizacion (solo ADMIN, en la ruta), el mismo estado exigido (SCHEDULED)
// y el mismo mensaje de conflicto que createChecklistTask. Aplicarla no
// puede permitir nada que crear una tarea a mano no permitiera ya.
//
// Corre en runSerializableTransaction por el mismo motivo que el resto del
// modulo: LEE Maintenance.status y luego ESCRIBE ChecklistTask, mientras
// completeMaintenance LEE ChecklistTask y ESCRIBE Maintenance. Ese ciclo
// cruzado solo lo detecta PostgreSQL si ambos lados corren en Serializable.
export async function applyChecklistTemplate(maintenanceId, templateId) {
  return runSerializableTransaction(async (tx) => {
    const maintenance = await getMaintenanceOrThrow(tx, maintenanceId);

    assertMaintenanceStatus(
      maintenance,
      "SCHEDULED",
      "created while the maintenance is scheduled",
    );

    const template = await tx.checklistTemplate.findUnique({
      where: { id: templateId },
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!template) {
      throw createHttpError(404, "Checklist template not found");
    }

    if (template.items.length === 0) {
      throw createHttpError(409, "The checklist template has no tasks");
    }

    // Las tareas de la plantilla se AGREGAN al final del checklist: las
    // existentes no se leen para compararlas ni se tocan de ninguna forma.
    // Se parte de MAX(sortOrder)+1 y no de un conteo de filas porque el
    // ADMIN pudo borrar tareas intermedias, dejando huecos: contar daria
    // posiciones ya ocupadas y el bloque entrante se intercalaria con las
    // que ya estaban.
    const { _max } = await tx.checklistTask.aggregate({
      where: { maintenanceId },
      _max: { sortOrder: true },
    });
    const baseSortOrder = (_max.sortOrder ?? -1) + 1;

    // Copia POR VALOR: solo viaja la descripcion. No se copia el id del
    // item, ni el templateId, ni ninguna referencia, de modo que la tarea
    // resultante es indistinguible de una creada a mano. isCompleted,
    // completedAt y completedById quedan en sus valores por defecto: las
    // tareas nacen pendientes.
    await tx.checklistTask.createMany({
      data: template.items.map((item, index) => ({
        maintenanceId,
        description: item.description,
        sortOrder: baseSortOrder + index,
      })),
    });

    // Se devuelve el checklist COMPLETO (no solo lo insertado) para que el
    // cliente pueda refrescar la vista sin una segunda peticion.
    return tx.checklistTask.findMany({
      where: { maintenanceId },
      include: { completedBy: completedByInclude },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
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
