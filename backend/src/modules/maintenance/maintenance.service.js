import { prisma } from "../../config/prisma.js";
import { createHttpError } from "../../utils/http-error.js";
import { runSerializableTransaction } from "../../utils/serializable-transaction.js";
import {
  activeMaintenancesAffectingEquipment,
  activeMaintenancesAffectingNode,
} from "../../utils/maintenance-status-rules.js";
import {
  deleteEvidenceFromQuarantine,
  moveEvidenceToQuarantine,
  restoreEvidenceFromQuarantine,
} from "../../utils/evidence-file.js";

const relatedUserSelect = {
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
  },
};

// storedName/relativePath son detalles internos del filesystem y nunca deben
// viajar al cliente: se restringe explicitamente con select en vez de
// `evidences: true`, que traeria todas las columnas del modelo Evidence.
const evidencesInclude = {
  select: {
    id: true,
    maintenanceId: true,
    originalName: true,
    mimeType: true,
    sizeBytes: true,
    createdAt: true,
    uploadedBy: relatedUserSelect,
  },
  orderBy: { createdAt: "asc" },
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
  evidences: evidencesInclude,
};

async function assertNetworkNodeExists(client, networkNodeId) {
  const networkNode = await client.networkNode.findUnique({
    where: { id: networkNodeId },
  });

  if (!networkNode) {
    throw createHttpError(404, "Network node not found");
  }
}

async function assertEquipmentExists(client, equipmentId) {
  const equipment = await client.equipment.findUnique({
    where: { id: equipmentId },
  });

  if (!equipment) {
    throw createHttpError(404, "Equipment not found");
  }
}

// Recibe el cliente Prisma como primer argumento (mismo patron que
// getMaintenanceOrThrow/getChecklistTaskOrThrow en checklist-task.service.js)
// para poder correr DENTRO de la transaccion de createMaintenance: si estas
// lecturas usaran el cliente global quedarian fuera de ella, y el nodo o el
// equipo podrian desaparecer entre la comprobacion y el INSERT sin que la
// transaccion se enterara. updateMaintenance le pasa `prisma` y conserva
// exactamente el comportamiento que ya tenia.
async function prepareMaintenanceData(client, data) {
  if (data.type === "PREVENTIVE") {
    if (!data.networkNodeId) {
      throw createHttpError(400, "Preventive maintenance requires a network node");
    }

    await assertNetworkNodeExists(client, data.networkNodeId);

    return { ...data, equipmentId: null };
  }

  if (!data.equipmentId) {
    throw createHttpError(400, "Corrective maintenance requires equipment");
  }

  await assertEquipmentExists(client, data.equipmentId);

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

// prepareMaintenanceData ya confirmo que el nodo/equipo existia en el momento
// de la lectura, pero entre esa lectura y este write alguien mas pudo
// eliminarlo (p. ej. una eliminacion de Equipment que ya no tenia
// mantenimientos en ese instante). La foreign key rechaza el INSERT/UPDATE
// con P2003 en ese caso; se traduce a 404 en vez de dejarlo escapar como 500.
function rethrowAsNotFoundOnForeignKeyViolation(error) {
  if (error.code === "P2003") {
    throw createHttpError(
      404,
      "The referenced network node or equipment no longer exists",
    );
  }

  throw error;
}

// La orden y las tareas de su plantilla se crean en UNA sola transaccion: si
// la copia del checklist falla a mitad, no puede quedar un mantenimiento sin
// las tareas que el ADMIN pidio, ni un mantenimiento a medio poblar.
//
// Se usa la transaccion por defecto (READ COMMITTED) y no
// runSerializableTransaction a proposito: la orden acaba de nacer y su id no
// existe para ninguna otra transaccion, asi que no hay lectura-escritura
// cruzada que Serializable pudiera proteger. Lo unico que hace falta aqui es
// atomicidad, que la transaccion por defecto ya garantiza. En cambio
// applyChecklistTemplate SI necesita Serializable, porque alli el
// mantenimiento ya existe y otras transacciones pueden estar tocandolo.
export async function createMaintenance(data, userId) {
  const { checklistTemplateId, ...maintenanceData } = data;

  try {
    return await prisma.$transaction(async (tx) => {
      const preparedData = await prepareMaintenanceData(tx, maintenanceData);

      // La plantilla se resuelve ANTES de crear nada: con un id invalido el
      // 404 llega sin haber escrito una sola fila. El rollback tambien lo
      // cubriria, pero fallar temprano es mas barato y mas claro.
      let templateItems = [];

      if (checklistTemplateId) {
        const template = await tx.checklistTemplate.findUnique({
          where: { id: checklistTemplateId },
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

        templateItems = template.items;
      }

      const maintenance = await tx.maintenance.create({
        data: {
          ...preparedData,
          createdById: userId,
        },
        select: { id: true },
      });

      if (templateItems.length > 0) {
        // Copia por valor, igual que applyChecklistTemplate: solo la
        // descripcion. El checklist esta vacio (la orden acaba de crearse),
        // asi que el orden arranca en 0.
        await tx.checklistTask.createMany({
          data: templateItems.map((item, index) => ({
            maintenanceId: maintenance.id,
            description: item.description,
            sortOrder: index,
          })),
        });
      }

      return tx.maintenance.findUnique({
        where: { id: maintenance.id },
        include: maintenanceInclude,
      });
    });
  } catch (error) {
    return rethrowAsNotFoundOnForeignKeyViolation(error);
  }
}

// Estados en los que una orden sigue abierta y, por tanto, editable. Una
// COMPLETED ya se ejecuto y una CANCELLED no se va a ejecutar: cambiarles la
// fecha, el nodo, el equipo o el titulo falsearia el historial de
// mantenimiento que el resto del sistema preserva a proposito (ver las
// relaciones onDelete: Restrict en schema.prisma).
const UPDATABLE_STATUSES = ["SCHEDULED", "IN_PROGRESS"];

const CLOSED_MAINTENANCE_ERROR =
  "Only scheduled or in-progress maintenances can be updated";

const IN_PROGRESS_TARGET_ERROR =
  "The type, network node or equipment of an in-progress maintenance cannot be changed";

// El "objetivo" de una orden: su tipo y el recurso al que apunta, ya
// normalizado igual que lo deja prepareMaintenanceData (exactamente una de
// las dos columnas poblada). Se compara en memoria, sin tocar la base de
// datos, para poder decidir ANTES de cualquier lectura si la edicion es una
// reasignacion.
function maintenanceTargetOf({ type, networkNodeId, equipmentId }) {
  return type === "PREVENTIVE"
    ? { type, networkNodeId: networkNodeId ?? null, equipmentId: null }
    : { type: "CORRECTIVE", networkNodeId: null, equipmentId: equipmentId ?? null };
}

function isSameMaintenanceTarget(a, b) {
  return (
    a.type === b.type &&
    a.networkNodeId === b.networkNodeId &&
    a.equipmentId === b.equipmentId
  );
}

/* Una orden IN_PROGRESS ya puso en MAINTENANCE su nodo/equipos; reasignarla a
   otro recurso dejaria al anterior en MAINTENANCE para siempre (nadie lo
   liberaria al completar) y al nuevo sin marcar. En vez de resincronizar
   origen y destino -que multiplicaria los caminos de escritura de estado y
   las carreras posibles- se prohibe el cambio: el objetivo de una orden en
   ejecucion es inmutable. El resto de campos (titulo, descripcion, fecha)
   se siguen editando con normalidad, porque no afectan a ningun recurso. */
export async function updateMaintenance(id, data) {
  // El estado se toma de la base de datos, nunca del cuerpo de la solicitud:
  // maintenanceSchema ni siquiera acepta `status`, asi que un cliente no
  // puede influir en esta decision. Esta lectura ademas distingue el 404
  // (no existe) del 409 (existe pero esta cerrada).
  const current = await getMaintenanceById(id);

  if (!UPDATABLE_STATUSES.includes(current.status)) {
    throw createHttpError(409, CLOSED_MAINTENANCE_ERROR);
  }

  // Se evalua antes de prepareMaintenanceData (que lee la base de datos) para
  // resolver la reasignacion sin trabajo inutil.
  const targetChanged = !isSameMaintenanceTarget(
    maintenanceTargetOf(data),
    maintenanceTargetOf(current),
  );

  if (targetChanged && current.status === "IN_PROGRESS") {
    throw createHttpError(409, IN_PROGRESS_TARGET_ERROR);
  }

  const preparedData = await prepareMaintenanceData(prisma, data);

  // Cuando la edicion reasigna el recurso, el UPDATE se restringe ademas a
  // SCHEDULED: si entre la comprobacion de arriba y esta escritura otra
  // solicitud inicio la orden, el WHERE deja de cumplirse y la reasignacion
  // se rechaza en lugar de aplicarse sobre una orden ya en ejecucion.
  const writableStatuses = targetChanged ? ["SCHEDULED"] : UPDATABLE_STATUSES;

  let result;

  try {
    // El UPDATE se condiciona por id + status (mismo patron que
    // startMaintenance/completeMaintenance) y no solo por id: entre la
    // lectura de arriba y esta escritura, un POST /complete concurrente pudo
    // cerrar la orden. Con el status dentro del WHERE, esa carrera no puede
    // colar una edicion sobre una orden ya cerrada -- PostgreSQL bloquea la
    // fila y la condicion deja de cumplirse.
    result = await prisma.maintenance.updateMany({
      where: { id, status: { in: writableStatuses } },
      data: preparedData,
    });
  } catch (error) {
    return rethrowAsNotFoundOnForeignKeyViolation(error);
  }

  if (result.count === 0) {
    // Ninguna fila cambio: la orden se cerro entre la lectura y la escritura,
    // o -si esta edicion reasignaba el recurso- se inicio.
    const latest = await prisma.maintenance.findUnique({
      where: { id },
      select: { status: true },
    });

    if (targetChanged && latest?.status === "IN_PROGRESS") {
      throw createHttpError(409, IN_PROGRESS_TARGET_ERROR);
    }

    throw createHttpError(409, CLOSED_MAINTENANCE_ERROR);
  }

  return getMaintenanceById(id);
}

async function restoreQuarantinedEvidences(storedNames) {
  await Promise.all(
    storedNames.map((storedName) => restoreEvidenceFromQuarantine(storedName)),
  );
}

const IN_PROGRESS_DELETE_ERROR =
  "An in-progress maintenance cannot be deleted";

export async function deleteMaintenance(id) {
  const maintenance = await prisma.maintenance.findUnique({ where: { id } });

  if (!maintenance) {
    throw createHttpError(404, "Maintenance not found");
  }

  // Una orden en ejecucion tiene su nodo/equipos en MAINTENANCE y es ella
  // quien los libera al completarse: borrarla los dejaria en ese estado sin
  // nadie que pudiera devolverlos. Se rechaza en vez de liberar los recursos
  // desde el DELETE, para que exista una sola via de salida de MAINTENANCE
  // (completar la orden) y el historial no se pierda a medias.
  //
  // Se comprueba ANTES de mover ninguna evidencia a cuarentena: un 409 no
  // puede tocar el filesystem.
  if (maintenance.status === "IN_PROGRESS") {
    throw createHttpError(409, IN_PROGRESS_DELETE_ERROR);
  }

  const evidences = await prisma.evidence.findMany({
    where: { maintenanceId: id },
    select: { id: true, storedName: true },
  });

  // PostgreSQL y el filesystem no comparten una transaccion atomica: los
  // archivos se mueven a cuarentena ANTES de borrar en base de datos para
  // poder restaurarlos si el delete falla, evitando dejar filas borradas
  // con archivos huerfanos o archivos borrados con filas aun presentes.
  const movedStoredNames = [];

  for (const evidence of evidences) {
    try {
      await moveEvidenceToQuarantine(evidence.storedName);
      movedStoredNames.push(evidence.storedName);
    } catch (error) {
      if (error.code === "ENOENT") {
        // El archivo fisico ya no existe: no hay nada que mover ni
        // restaurar para esta evidencia en particular, se continua.
        continue;
      }

      await restoreQuarantinedEvidences(movedStoredNames);
      throw createHttpError(
        500,
        "Failed to prepare evidence files for deletion",
      );
    }
  }

  // deleteMany condicionado por status (y no delete por id) para cerrar la
  // carrera con un POST /start simultaneo: si la orden se inicio despues de
  // la comprobacion de arriba, el WHERE ya no la encuentra y no se borra.
  let deleted;

  try {
    deleted = await prisma.maintenance.deleteMany({
      where: { id, status: { not: "IN_PROGRESS" } },
    });
  } catch (error) {
    await restoreQuarantinedEvidences(movedStoredNames);
    throw error;
  }

  if (deleted.count === 0) {
    await restoreQuarantinedEvidences(movedStoredNames);

    const latest = await prisma.maintenance.findUnique({
      where: { id },
      select: { id: true },
    });

    throw latest
      ? createHttpError(409, IN_PROGRESS_DELETE_ERROR)
      : createHttpError(404, "Maintenance not found");
  }

  await Promise.all(
    movedStoredNames.map((storedName) =>
      deleteEvidenceFromQuarantine(storedName).catch((cleanupError) => {
        console.error(
          `Evidence quarantine cleanup failed for maintenance ${id}: ${cleanupError.message}`,
        );
      }),
    ),
  );
}

/* ---------------------------------------------------------------------------
   Sincronizacion del estado de NetworkNode / Equipment
   ---------------------------------------------------------------------------

   Que orden afecta a que recurso lo definen
   activeMaintenancesAffectingNode/Equipment en
   utils/maintenance-status-rules.js: esa definicion la comparten este modulo
   (para poner y quitar MAINTENANCE) y los modulos network-nodes/equipment
   (para rechazar los cambios manuales que la romperian), de modo que las tres
   no puedan divergir.

   Todas las escrituras automaticas de estado llevan el estado ESPERADO dentro
   del WHERE (updateMany condicionado), nunca un update incondicional por id:

     iniciar:   AVAILABLE / OPERATIONAL -> MAINTENANCE
     completar: MAINTENANCE             -> AVAILABLE / OPERATIONAL

   Esa condicion es lo que protege a OUT_OF_SERVICE. Un nodo o un equipo
   marcado fuera de servicio lo esta por una razon de negocio ajena al
   mantenimiento (se registra a mano con PUT /network-nodes/:id o
   PUT /equipment/:id, la unica via existente para cambiar el estado): no
   entra en MAINTENANCE al iniciar y, sobre todo, no puede salir a
   AVAILABLE/OPERATIONAL al completar, porque nunca cumple el WHERE.

   De ahi que AVAILABLE/OPERATIONAL sea SIEMPRE el estado correcto al
   restaurar, sin necesidad de una columna que recuerde el estado previo:
   como MAINTENANCE solo se escribe automaticamente partiendo de
   AVAILABLE/OPERATIONAL, el estado anterior de toda fila puesta en
   MAINTENANCE por un mantenimiento es exactamente ese, y el unico estado que
   podria perderse (OUT_OF_SERVICE) queda excluido por el propio WHERE.

   El razonamiento vale igual si el estado cambia a mano MIENTRAS el
   mantenimiento corre: marcar OUT_OF_SERVICE un nodo que estaba en
   MAINTENANCE hace que al completar la restauracion no lo toque. */

async function markNodeUnderMaintenance(tx, networkNodeId) {
  await tx.networkNode.updateMany({
    where: { id: networkNodeId, status: "AVAILABLE" },
    data: { status: "MAINTENANCE" },
  });
}

async function markEquipmentUnderMaintenance(tx, where) {
  await tx.equipment.updateMany({
    where: { ...where, status: "OPERATIONAL" },
    data: { status: "MAINTENANCE" },
  });
}

// Resuelve el nodo padre del equipo de un correctivo. La foreign key
// Maintenance.equipmentId -> Equipment (onDelete: Restrict, ver
// schema.prisma) impide que el equipo desaparezca mientras exista el
// mantenimiento, asi que en la practica siempre encuentra la fila; devolver
// null en vez de asumirlo evita convertir un dato inconsistente heredado en
// un 500 y deja la transicion del mantenimiento intacta.
function findMaintenanceEquipment(tx, equipmentId) {
  return tx.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, networkNodeId: true },
  });
}

async function applyStartToResources(tx, maintenance) {
  if (maintenance.type === "PREVENTIVE") {
    if (!maintenance.networkNodeId) {
      return;
    }

    await markNodeUnderMaintenance(tx, maintenance.networkNodeId);
    // Todos los equipos del nodo en una sola escritura: el preventivo
    // interviene el nodo completo.
    await markEquipmentUnderMaintenance(tx, {
      networkNodeId: maintenance.networkNodeId,
    });

    return;
  }

  if (!maintenance.equipmentId) {
    return;
  }

  const equipment = await findMaintenanceEquipment(tx, maintenance.equipmentId);

  if (!equipment) {
    return;
  }

  // Solo el equipo intervenido; sus hermanos del mismo nodo no se tocan.
  await markEquipmentUnderMaintenance(tx, { id: equipment.id });
  await markNodeUnderMaintenance(tx, equipment.networkNodeId);
}

/* Restauracion al completar. La regla es que un recurso solo vuelve a
   AVAILABLE/OPERATIONAL cuando YA NO queda ningun otro mantenimiento
   IN_PROGRESS que lo afecte: si dos ordenes tocan el mismo nodo y se cierra
   una, el nodo sigue en MAINTENANCE hasta que se cierre la ultima.

   Los conteos de abajo corren DESPUES de que la propia orden paso a
   COMPLETED dentro de la misma transaccion, por lo que ella misma ya no
   aparece entre los IN_PROGRESS y no hace falta excluirla por id. */

async function restoreNodeIfFree(tx, networkNodeId) {
  const activeCount = await tx.maintenance.count({
    where: activeMaintenancesAffectingNode(networkNodeId),
  });

  if (activeCount > 0) {
    return;
  }

  await tx.networkNode.updateMany({
    where: { id: networkNodeId, status: "MAINTENANCE" },
    data: { status: "AVAILABLE" },
  });
}

async function restoreEquipmentIfFree(tx, equipment) {
  const activeCount = await tx.maintenance.count({
    where: activeMaintenancesAffectingEquipment(equipment),
  });

  if (activeCount > 0) {
    return;
  }

  await tx.equipment.updateMany({
    where: { id: equipment.id, status: "MAINTENANCE" },
    data: { status: "OPERATIONAL" },
  });
}

// Restaura los equipos de un nodo tras cerrar un preventivo. No se resuelve
// equipo por equipo (eso serian N consultas dependientes del tamano del
// nodo): un preventivo IN_PROGRESS bloquea a todos por igual, y los
// correctivos IN_PROGRESS bloquean unicamente a SU equipo, asi que basta
// excluir esos equipos concretos del UPDATE.
async function restoreNodeEquipmentIfFree(tx, networkNodeId) {
  const activePreventiveCount = await tx.maintenance.count({
    where: { status: "IN_PROGRESS", networkNodeId },
  });

  if (activePreventiveCount > 0) {
    return;
  }

  const activeCorrectives = await tx.maintenance.findMany({
    where: { status: "IN_PROGRESS", equipment: { networkNodeId } },
    select: { equipmentId: true },
  });

  const busyEquipmentIds = activeCorrectives
    .map((maintenance) => maintenance.equipmentId)
    .filter(Boolean);

  await tx.equipment.updateMany({
    where: {
      networkNodeId,
      status: "MAINTENANCE",
      // El filtro se omite cuando no hay equipos ocupados en vez de enviar
      // `notIn: []`, cuyo significado depende de la version del cliente.
      ...(busyEquipmentIds.length > 0
        ? { id: { notIn: busyEquipmentIds } }
        : {}),
    },
    data: { status: "OPERATIONAL" },
  });
}

async function applyCompletionToResources(tx, maintenance) {
  if (maintenance.type === "PREVENTIVE") {
    if (!maintenance.networkNodeId) {
      return;
    }

    await restoreNodeEquipmentIfFree(tx, maintenance.networkNodeId);
    await restoreNodeIfFree(tx, maintenance.networkNodeId);

    return;
  }

  if (!maintenance.equipmentId) {
    return;
  }

  const equipment = await findMaintenanceEquipment(tx, maintenance.equipmentId);

  if (!equipment) {
    return;
  }

  await restoreEquipmentIfFree(tx, equipment);
  await restoreNodeIfFree(tx, equipment.networkNodeId);
}

// Columnas minimas que necesita la sincronizacion de recursos.
const maintenanceResourceSelect = {
  id: true,
  status: true,
  type: true,
  networkNodeId: true,
  equipmentId: true,
};

// Iniciar un mantenimiento dejo de ser una unica escritura sobre Maintenance:
// ahora tambien pone en MAINTENANCE el nodo y/o los equipos afectados, y todo
// eso debe ocurrir o no ocurrir junto (no puede quedar la orden IN_PROGRESS
// con el nodo AVAILABLE, ni al reves), por lo que pasa a una transaccion.
//
// La transaccion es Serializable, y no la de por defecto, por la misma razon
// que completeMaintenance: esta funcion ESCRIBE Maintenance y luego ESCRIBE
// NetworkNode/Equipment, mientras que completeMaintenance LEE Maintenance
// (el conteo de IN_PROGRESS que decide si puede restaurar) y ESCRIBE esos
// mismos recursos. Bajo READ COMMITTED ese cruce admite un intercalado real:
// un "complete" que cuenta cero ordenes activas justo antes de que este
// "start" confirme la suya termina devolviendo el nodo a AVAILABLE con un
// mantenimiento ya IN_PROGRESS encima. PostgreSQL solo detecta y aborta ese
// ciclo si AMBOS lados corren en Serializable, asi que iniciar tambien tiene
// que hacerlo; runSerializableTransaction reintenta el conflicto.
export async function startMaintenance(id, userId) {
  const outcome = await runSerializableTransaction(async (tx) => {
    // Transicion condicionada por id + status: dos solicitudes simultaneas no
    // pueden iniciar el mismo mantenimiento dos veces, porque la segunda ya
    // no cumple el WHERE (y ademas no llega a duplicar la sincronizacion de
    // recursos, que queda dentro de esta misma rama).
    const result = await tx.maintenance.updateMany({
      where: { id, status: "SCHEDULED" },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
        startedById: userId,
      },
    });

    if (result.count === 0) {
      // Ninguna fila cambio: distinguir inexistente (404) de conflicto (409).
      const existing = await tx.maintenance.findUnique({
        where: { id },
        select: { id: true },
      });

      return existing ? "INVALID_STATE" : "NOT_FOUND";
    }

    const maintenance = await tx.maintenance.findUnique({
      where: { id },
      select: maintenanceResourceSelect,
    });

    await applyStartToResources(tx, maintenance);

    return "STARTED";
  });

  if (outcome === "NOT_FOUND") {
    throw createHttpError(404, "Maintenance not found");
  }

  if (outcome === "INVALID_STATE") {
    throw createHttpError(409, "Only scheduled maintenances can be started");
  }

  return getMaintenanceById(id);
}

export async function completeMaintenance(id, userId) {
  // Se agrupan la verificacion del checklist y la transicion de estado en una
  // transaccion. La transicion IN_PROGRESS -> COMPLETED se hace condicionada
  // por id + status, de modo que dos "complete" simultaneos no puedan cerrar
  // el mismo mantenimiento dos veces (la segunda encuentra 0 filas).
  //
  // Se usa aislamiento Serializable (via runSerializableTransaction) y no
  // solo la transaccion por defecto: esta funcion LEE ChecklistTask (el
  // conteo de pendientes) y luego ESCRIBE Maintenance, mientras que
  // checklist-task.service.js LEE Maintenance.status y luego ESCRIBE
  // ChecklistTask. Esas dos direcciones cruzadas forman un ciclo de
  // dependencias real: si un PATCH de estado de una tarea reabre la
  // checklist justo despues de que este conteo la vio completa, pero antes
  // de que el UPDATE de abajo confirme, el mantenimiento podria quedar
  // COMPLETED con una tarea pendiente. PostgreSQL solo detecta y aborta ese
  // ciclo si AMBOS lados corren en Serializable (con READ COMMITTED, un lado
  // no participa en la deteccion y el ciclo puede colarse sin error).
  //
  // La restauracion del nodo/equipos se agrega DENTRO de esta misma
  // transaccion, despues del UPDATE: la proteccion del checklist no cambia
  // (sigue siendo el mismo conteo, en el mismo aislamiento, antes de la
  // transicion) y ahora ademas es imposible que la orden quede COMPLETED sin
  // que los recursos se hayan reevaluado, o al reves.
  const outcome = await runSerializableTransaction(async (tx) => {
    const maintenance = await tx.maintenance.findUnique({
      where: { id },
      select: maintenanceResourceSelect,
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

    // Despues del UPDATE a proposito: asi esta orden ya no cuenta como
    // IN_PROGRESS y los conteos de restauracion solo ven a las DEMAS ordenes
    // que siguen afectando al nodo o al equipo.
    await applyCompletionToResources(tx, maintenance);

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
