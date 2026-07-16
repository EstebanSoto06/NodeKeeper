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

export async function deleteNetworkNode(id) {
  await getNetworkNodeById(id);

  await prisma.networkNode.delete({ where: { id } });
}
