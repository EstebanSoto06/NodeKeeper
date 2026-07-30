import { prisma } from "../../config/prisma.js";
import { createHttpError } from "../../utils/http-error.js";

const mapSelect = {
  id: true,
  code: true,
  name: true,
  location: true,
  latitude: true,
  longitude: true,
  status: true,
};

export async function listNetworkNodes() {
  return prisma.networkNode.findMany({
    orderBy: { code: "asc" },
  });
}

export async function getNetworkNodeMap() {
  return prisma.networkNode.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
    select: mapSelect,
    orderBy: { code: "asc" },
  });
}

export async function getNetworkNodeById(id) {
  const networkNode = await prisma.networkNode.findUnique({
    where: { id },
  });

  if (!networkNode) {
    throw createHttpError(404, "Network node not found");
  }

  return networkNode;
}

export async function createNetworkNode(data) {
  try {
    return await prisma.networkNode.create({ data });
  } catch (error) {
    if (error.code === "P2002") {
      throw createHttpError(409, "Network node code already exists");
    }

    throw error;
  }
}

export async function updateNetworkNode(id, data) {
  await getNetworkNodeById(id);

  try {
    return await prisma.networkNode.update({
      where: { id },
      data,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createHttpError(409, "Network node code already exists");
    }

    throw error;
  }
}

const MAINTENANCE_HISTORY_ERROR =
  "No se puede eliminar el nodo porque posee historial de mantenimiento directo o mediante sus equipos.";

export async function deleteNetworkNode(id) {
  await getNetworkNodeById(id);

  // Comprobacion previa (mensaje claro para el caso comun): cuenta tanto los
  // mantenimientos preventivos directos del nodo como los correctivos de
  // cualquiera de sus equipos. La defensa definitiva contra una carrera es la
  // foreign key ON DELETE RESTRICT (ver catch de P2003 mas abajo).
  const [directMaintenanceCount, equipmentMaintenanceCount] = await Promise.all([
    prisma.maintenance.count({ where: { networkNodeId: id } }),
    prisma.maintenance.count({ where: { equipment: { networkNodeId: id } } }),
  ]);

  if (directMaintenanceCount > 0 || equipmentMaintenanceCount > 0) {
    throw createHttpError(409, MAINTENANCE_HISTORY_ERROR);
  }

  try {
    await prisma.networkNode.delete({ where: { id } });
  } catch (error) {
    // P2003 aqui solo puede provenir de la relacion Maintenance->NetworkNode
    // (ON DELETE RESTRICT): un mantenimiento preventivo se creo justo despues
    // del conteo anterior. La cascada Equipment->NetworkNode no cambia y no
    // produce este codigo. Se traduce a 409, nunca un 500.
    if (error.code === "P2003") {
      throw createHttpError(409, MAINTENANCE_HISTORY_ERROR);
    }

    throw error;
  }
}
