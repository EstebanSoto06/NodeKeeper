import { Prisma } from "@prisma/client";

import { prisma } from "../config/prisma.js";
import { createHttpError } from "./http-error.js";

const MAX_SERIALIZATION_RETRIES = 3;
const POSTGRES_SERIALIZATION_FAILURE_SQLSTATE = "40001";

// Bajo READ COMMITTED (el nivel por defecto), un SELECT no bloquea a los
// escritores: leer una fila en una llamada Prisma y escribir una fila
// relacionada en otra llamada separada deja una ventana TOCTOU donde una
// transaccion concurrente puede modificar lo que se leyo antes de que la
// escritura ocurra. Ejecutar ambas operaciones dentro de una misma
// transaccion con aislamiento Serializable cierra esa ventana sin SQL
// crudo ni SELECT ... FOR UPDATE (que Prisma no expone en su API estandar):
// si otra transaccion concurrente modifica una fila que esta transaccion
// leyo (o lee una fila que esta transaccion modifico), PostgreSQL aborta
// una de las dos con un conflicto de serializacion (SQLSTATE 40001) en
// lugar de permitir un resultado no serializable.
//
// Importante: esta garantia solo aplica entre transacciones que TAMBIEN
// corren en Serializable. Una transaccion en READ COMMITTED que interactua
// con los mismos datos no participa en la deteccion de conflictos de
// PostgreSQL, por lo que queda fuera de esta proteccion.
//
// Reintentar tras un conflicto de serializacion es el patron que la
// documentacion de PostgreSQL recomienda para Serializable; cualquier otro
// error (incluidos los 404/409 de negocio lanzados dentro de la
// transaccion) se relanza de inmediato, sin reintentar.
function isPostgresSerializationConflict(error) {
  // Forma clasica del motor de Prisma: PrismaClientKnownRequestError con
  // codigo P2034.
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return true;
  }

  // Este proyecto usa el driver adapter @prisma/adapter-pg (ver
  // src/config/prisma.js). Confirmado empiricamente (ver informe de
  // estabilidad): con ese adapter, el MISMO conflicto de PostgreSQL
  // (SQLSTATE 40001, "could not serialize access due to read/write
  // dependencies among transactions") NO llega como
  // PrismaClientKnownRequestError/P2034, sino como un DriverAdapterError
  // cuyo `cause.originalCode` es el SQLSTATE real de Postgres. Sin este
  // chequeo, un conflicto de serializacion legitimo escapaba sin
  // transformar y terminaba en un 500, en vez de reintentarse.
  if (error?.cause?.originalCode === POSTGRES_SERIALIZATION_FAILURE_SQLSTATE) {
    return true;
  }

  return false;
}

export async function runSerializableTransaction(work) {
  for (let attempt = 1; attempt <= MAX_SERIALIZATION_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isPostgresSerializationConflict(error)) {
        throw error;
      }

      if (attempt === MAX_SERIALIZATION_RETRIES) {
        // Se agotaron los reintentos ante contencion real. Se transforma en
        // un 409 de negocio para no dejar escapar el error del driver sin
        // transformar como 500 ante una carrera esperable.
        throw createHttpError(
          409,
          "Concurrent modification detected, please retry",
        );
      }
    }
  }

  // Inalcanzable: cada iteracion del for anterior retorna (sin conflicto) o
  // lanza (conflicto no reconocido, o reintentos agotados en el ultimo
  // intento). Si el flujo llega aqui es un error de programacion en el
  // bucle; se lanza explicitamente en vez de devolver undefined en
  // silencio, que ocultaria el fallo real ante quien llama.
  throw new Error(
    "runSerializableTransaction: unreachable state reached after retry loop",
  );
}
