import { prisma } from "../../config/prisma.js";
import { createHttpError } from "../../utils/http-error.js";
import { isForeignKeyConstraintError } from "../../utils/foreign-key-error.js";
import { runSerializableTransaction } from "../../utils/serializable-transaction.js";
import {
  activeMaintenancesAffectingNode,
  checkManualStatusChange,
  MANUAL_STATUS_VIOLATION,
  NODE_NORMAL_STATUS,
} from "../../utils/maintenance-status-rules.js";

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

/* MAINTENANCE es un estado AUTOMATICO: lo escribe unicamente el ciclo de vida
   de una orden (ver maintenance.service.js). Estas dos reglas impiden que un
   cliente lo rompa llamando directo a la API, no solo desde el formulario:

     - No se puede ASIGNAR MAINTENANCE a mano. Reenviarlo cuando el nodo ya
       lo tiene si se permite: eso es conservar el estado automatico, y es lo
       que hace cualquier edicion de nombre o ubicacion de un nodo que
       ahora mismo esta en mantenimiento.
     - No se puede devolver un nodo a AVAILABLE mientras una orden en
       ejecucion lo mantiene ocupado; la salida de MAINTENANCE es completar
       esa orden.

   OUT_OF_SERVICE queda fuera de ambas: siempre se puede registrar, incluso
   durante una orden, y ninguna escritura automatica lo revierte. */
const AUTOMATIC_STATUS_ERROR =
  "El estado En mantenimiento lo asigna el sistema al iniciar un mantenimiento y no puede establecerse manualmente.";

const ACTIVE_MAINTENANCE_STATUS_ERROR =
  "No se puede marcar el nodo como Disponible mientras tiene un mantenimiento en ejecución.";

function throwManualStatusViolation(violation) {
  if (violation === MANUAL_STATUS_VIOLATION.AUTOMATIC) {
    throw createHttpError(409, AUTOMATIC_STATUS_ERROR);
  }

  if (violation === MANUAL_STATUS_VIOLATION.ACTIVE_MAINTENANCE) {
    throw createHttpError(409, ACTIVE_MAINTENANCE_STATUS_ERROR);
  }
}

export async function createNetworkNode(data) {
  // Un nodo que acaba de nacer no puede tener ninguna orden en ejecucion, asi
  // que la unica regla aplicable es que MAINTENANCE no sea asignable: la
  // comprobacion se resuelve en memoria, sin transaccion.
  throwManualStatusViolation(
    checkManualStatusChange({
      requestedStatus: data.status,
      currentStatus: undefined,
      hasActiveMaintenance: false,
      normalStatus: NODE_NORMAL_STATUS,
    }),
  );

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
    // La lectura del estado actual, el conteo de ordenes activas y la
    // escritura van en UNA transaccion Serializable, no en llamadas sueltas:
    // esta funcion LEE Maintenance y ESCRIBE NetworkNode, mientras
    // startMaintenance ESCRIBE Maintenance y ESCRIBE/LEE NetworkNode. Bajo
    // READ COMMITTED ese cruce permite que un PUT que conto cero ordenes
    // activas escriba AVAILABLE justo cuando un start acaba de confirmar la
    // suya. PostgreSQL solo detecta ese ciclo si ambos lados corren en
    // Serializable, igual que ya hacen start y complete.
    return await runSerializableTransaction(async (tx) => {
      const current = await tx.networkNode.findUnique({
        where: { id },
        select: { status: true },
      });

      if (!current) {
        throw createHttpError(404, "Network node not found");
      }

      const activeMaintenanceCount = await tx.maintenance.count({
        where: activeMaintenancesAffectingNode(id),
      });

      throwManualStatusViolation(
        checkManualStatusChange({
          requestedStatus: data.status,
          currentStatus: current.status,
          hasActiveMaintenance: activeMaintenanceCount > 0,
          normalStatus: NODE_NORMAL_STATUS,
        }),
      );

      return tx.networkNode.update({ where: { id }, data });
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
    // Violacion de llave foranea (P2003, o su equivalente SQLSTATE
    // 23001/23503 con @prisma/adapter-pg, ver isForeignKeyConstraintError)
    // aqui solo puede provenir de la relacion Maintenance->NetworkNode (ON
    // DELETE RESTRICT): un mantenimiento preventivo se creo justo despues
    // del conteo anterior. La cascada Equipment->NetworkNode no cambia y no
    // produce este error. Se traduce a 409, nunca un 500.
    if (isForeignKeyConstraintError(error)) {
      throw createHttpError(409, MAINTENANCE_HISTORY_ERROR);
    }

    throw error;
  }
}
