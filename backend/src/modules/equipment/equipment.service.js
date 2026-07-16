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

export async function deleteEquipment(id) {
  await getEquipmentById(id);

  await prisma.equipment.delete({ where: { id } });
}
