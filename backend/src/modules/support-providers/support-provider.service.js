import { prisma } from "../../config/prisma.js";
import { createHttpError } from "../../utils/http-error.js";

export async function listSupportProviders() {
  return prisma.supportProvider.findMany({
    orderBy: { companyName: "asc" },
  });
}

export async function getSupportProviderById(id) {
  const supportProvider = await prisma.supportProvider.findUnique({
    where: { id },
  });

  if (!supportProvider) {
    throw createHttpError(404, "Support provider not found");
  }

  return supportProvider;
}

export async function createSupportProvider(data) {
  return prisma.supportProvider.create({ data });
}

export async function updateSupportProvider(id, data) {
  await getSupportProviderById(id);

  return prisma.supportProvider.update({
    where: { id },
    data,
  });
}

export async function deleteSupportProvider(id) {
  await getSupportProviderById(id);

  await prisma.supportProvider.delete({ where: { id } });
}
