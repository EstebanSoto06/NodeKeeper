import { prisma } from "../../config/prisma.js";
import { createHttpError } from "../../utils/http-error.js";
import { runSerializableTransaction } from "../../utils/serializable-transaction.js";

const createdBySelect = {
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
  },
};

// Los items se devuelven SIEMPRE en el mismo orden en que se aplicaran al
// checklist: sortOrder asc, con createdAt como desempate estable.
const templateInclude = {
  createdBy: createdBySelect,
  items: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
};

const DUPLICATE_NAME_ERROR = "A checklist template with this name already exists";

async function getTemplateOrThrow(client, id) {
  const template = await client.checklistTemplate.findUnique({
    where: { id },
    include: templateInclude,
  });

  if (!template) {
    throw createHttpError(404, "Checklist template not found");
  }

  return template;
}

// El @unique de la base de datos es sensible a mayusculas en PostgreSQL, de
// modo que "Mantenimiento UPS" y "mantenimiento ups" pasarian el constraint
// siendo el mismo nombre a ojos de un usuario. Esta comprobacion explicita
// con mode: "insensitive" cierra ese hueco. Corre DENTRO de la transaccion
// Serializable del llamador: bajo ese aislamiento PostgreSQL toma predicate
// locks sobre el rango leido, asi que dos creaciones simultaneas de "UPS" y
// "ups" no pueden pasar ambas -- una aborta con conflicto de serializacion y
// runSerializableTransaction la reintenta, encontrando ya la fila de la otra.
async function assertNameIsAvailable(tx, name, excludeId) {
  const existing = await tx.checklistTemplate.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw createHttpError(409, DUPLICATE_NAME_ERROR);
  }
}

// El constraint de base de datos sigue siendo la ultima defensa: si una
// carrera se colara pese a la comprobacion anterior, P2002 llega aqui y se
// traduce al mismo 409 de negocio en vez de escapar como 500. Mismo patron
// que user.service.js / network-node.service.js / equipment.service.js.
function rethrowAsConflictOnDuplicateName(error) {
  if (error.code === "P2002") {
    throw createHttpError(409, DUPLICATE_NAME_ERROR);
  }

  throw error;
}

// El sortOrder se deriva del indice del array recibido: la posicion de cada
// tarea la decide el orden en que el ADMIN las dejo en el formulario, no un
// campo que el cliente pueda enviar a mano.
function buildItemsData(items) {
  return items.map((item, index) => ({
    description: item.description,
    sortOrder: index,
  }));
}

export async function listChecklistTemplates() {
  return prisma.checklistTemplate.findMany({
    include: templateInclude,
    orderBy: { name: "asc" },
  });
}

export async function getChecklistTemplateById(id) {
  return getTemplateOrThrow(prisma, id);
}

export async function createChecklistTemplate(data, userId) {
  try {
    return await runSerializableTransaction(async (tx) => {
      await assertNameIsAvailable(tx, data.name);

      const template = await tx.checklistTemplate.create({
        data: {
          name: data.name,
          description: data.description ?? null,
          createdById: userId,
          items: {
            create: buildItemsData(data.items),
          },
        },
        include: templateInclude,
      });

      return template;
    });
  } catch (error) {
    return rethrowAsConflictOnDuplicateName(error);
  }
}

export async function updateChecklistTemplate(id, data) {
  try {
    return await runSerializableTransaction(async (tx) => {
      await getTemplateOrThrow(tx, id);
      await assertNameIsAvailable(tx, data.name, id);

      // PUT declarativo: el array recibido es el estado final de los items.
      // Se pueden borrar y recrear sin perder informacion porque un
      // ChecklistTemplateItem no tiene historial propio ni lo referencia
      // nadie -- a diferencia de ChecklistTask, que si guarda quien y cuando
      // la completo. Ambas operaciones van en la misma transaccion: un fallo
      // entre el delete y el create dejaria la plantilla vacia.
      await tx.checklistTemplateItem.deleteMany({ where: { templateId: id } });

      return tx.checklistTemplate.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description ?? null,
          items: {
            create: buildItemsData(data.items),
          },
        },
        include: templateInclude,
      });
    });
  } catch (error) {
    return rethrowAsConflictOnDuplicateName(error);
  }
}

export async function deleteChecklistTemplate(id) {
  await getTemplateOrThrow(prisma, id);

  // Solo desaparecen la plantilla y sus items (cascade). Las ChecklistTask
  // que se copiaron de ella en el pasado NO se tocan: no existe ninguna
  // foreign key entre ambas, por lo que la base de datos no tiene forma de
  // alcanzarlas ni aunque se quisiera.
  await prisma.checklistTemplate.delete({ where: { id } });
}
