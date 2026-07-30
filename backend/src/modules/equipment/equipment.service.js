import { prisma } from "../../config/prisma.js";
import { createHttpError } from "../../utils/http-error.js";

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

export async function createEquipment(data) {
  await assertNetworkNodeExists(data.networkNodeId);
  await assertSupportProviderExists(data.supportProviderId);

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
    return await prisma.equipment.update({
      where: { id },
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
    // P2003: violacion de llave foranea. Con Maintenance.equipmentId ahora en
    // ON DELETE RESTRICT, esto ocurre si un Maintenance referencia este
    // equipo (por ejemplo, creado justo despues del conteo anterior). Se
    // traduce a 409 de negocio, nunca un 500, sin exponer el nombre interno
    // de la restriccion.
    if (error.code === "P2003") {
      throw createHttpError(409, MAINTENANCE_HISTORY_ERROR);
    }

    throw error;
  }
}
