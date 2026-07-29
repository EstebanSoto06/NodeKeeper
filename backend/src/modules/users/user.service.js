import { prisma } from "../../config/prisma.js";
import { createHttpError } from "../../utils/http-error.js";
import { hashPassword } from "../../utils/password.js";

// Nunca incluir passwordHash: este select es la unica forma en que este
// modulo lee usuarios para exponerlos por la API.
const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

// Cuenta administradores ACTIVOS distintos de excludeId. Se usa para
// decidir si una operacion (desactivar o quitar el rol ADMIN) dejaria al
// sistema sin administradores. Como estas rutas ya exigen ADMIN para
// ejecutarse, quien realiza la accion siempre es un admin activo; por eso
// esta proteccion solo puede activarse realmente al operar sobre la propia
// cuenta (ver user.controller.js), pero se calcula de forma general (sin
// asumir quien es el actor) para que la regla sea correcta incluso si en el
// futuro existiera otra via de modificacion.
async function countOtherActiveAdmins(client, excludeId) {
  return client.user.count({
    where: { role: "ADMIN", isActive: true, id: { not: excludeId } },
  });
}

export async function listUsers() {
  return prisma.user.findMany({
    select: publicUserSelect,
    orderBy: { name: "asc" },
  });
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  return user;
}

export async function createUser(data) {
  const passwordHash = await hashPassword(data.password);

  try {
    return await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role ?? "OPERATOR",
      },
      select: publicUserSelect,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createHttpError(409, "Email already in use");
    }

    throw error;
  }
}

export async function updateUser(id, data) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id } });

    if (!user) {
      throw createHttpError(404, "User not found");
    }

    // Si el usuario es ADMIN activo y el rol nuevo ya no es ADMIN, verificar
    // que quede al menos otro administrador activo.
    if (user.role === "ADMIN" && user.isActive && data.role !== "ADMIN") {
      const remaining = await countOtherActiveAdmins(tx, id);

      if (remaining === 0) {
        throw createHttpError(
          409,
          "Cannot remove the last active administrator's role",
        );
      }
    }

    try {
      return await tx.user.update({
        where: { id },
        data: {
          name: data.name,
          email: data.email,
          role: data.role,
        },
        select: publicUserSelect,
      });
    } catch (error) {
      if (error.code === "P2002") {
        throw createHttpError(409, "Email already in use");
      }

      throw error;
    }
  });
}

export async function setUserActive(id, isActive, actorId) {
  // Proteccion unconditional de la propia cuenta: ni siquiera se llega a
  // evaluar la regla del ultimo administrador para este caso.
  if (id === actorId && !isActive) {
    throw createHttpError(403, "You cannot deactivate your own account");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id } });

    if (!user) {
      throw createHttpError(404, "User not found");
    }

    if (!isActive && user.role === "ADMIN" && user.isActive) {
      const remaining = await countOtherActiveAdmins(tx, id);

      if (remaining === 0) {
        throw createHttpError(
          409,
          "Cannot deactivate the last active administrator",
        );
      }
    }

    return tx.user.update({
      where: { id },
      data: { isActive },
      select: publicUserSelect,
    });
  });
}

export async function resetUserPassword(id, newPassword) {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });
}
