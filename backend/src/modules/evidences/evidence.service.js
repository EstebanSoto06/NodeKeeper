import fs from "node:fs/promises";

import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { createHttpError } from "../../utils/http-error.js";
import { runSerializableTransaction } from "../../utils/serializable-transaction.js";
import {
  ALLOWED_EVIDENCE_TYPES,
  deleteEvidenceFileIfExists,
  deleteEvidenceFromQuarantine,
  detectRealFileType,
  finalizeUploadedFile,
  getEvidenceFilePath,
  moveEvidenceToQuarantine,
  restoreEvidenceFromQuarantine,
} from "../../utils/evidence-file.js";

const uploadedByInclude = {
  select: { id: true, name: true, email: true, role: true },
};

const publicEvidenceSelect = {
  id: true,
  maintenanceId: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  uploadedBy: uploadedByInclude,
};

async function getMaintenanceOrThrow(client, maintenanceId) {
  const maintenance = await client.maintenance.findUnique({
    where: { id: maintenanceId },
  });

  if (!maintenance) {
    throw createHttpError(404, "Maintenance not found");
  }

  return maintenance;
}

export async function listEvidences(maintenanceId) {
  await getMaintenanceOrThrow(prisma, maintenanceId);

  return prisma.evidence.findMany({
    where: { maintenanceId },
    select: publicEvidenceSelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function createEvidence(maintenanceId, userId, uploadedFile) {
  const detected = await detectRealFileType(uploadedFile.path);
  const allowedEntry = detected && ALLOWED_EVIDENCE_TYPES[detected.mime];

  // El tipo real detectado debe existir en la lista permitida Y coincidir
  // exactamente con el mimetype declarado por el cliente. Esto rechaza tanto
  // contenido no soportado como discrepancias entre lo declarado y lo real
  // (p. ej. un PNG real declarado como PDF, o un ZIP generico declarado como
  // DOCX).
  if (!allowedEntry || detected.mime !== uploadedFile.mimetype) {
    await deleteEvidenceFileIfExists(uploadedFile.filename);
    throw createHttpError(
      400,
      "The file content does not match an allowed evidence format",
    );
  }

  const storedName = await finalizeUploadedFile(
    uploadedFile.filename,
    allowedEntry.extension,
  );

  let outcome;

  try {
    outcome = await runSerializableTransaction(async (tx) => {
      // Se usa un UPDATE condicionado (aunque el valor no cambie) en vez de
      // un simple SELECT del status: completeMaintenance ESCRIBE
      // Maintenance.status pero nunca toca la tabla Evidence, por lo que una
      // lectura de solo consulta aqui no crea ninguna dependencia que
      // PostgreSQL pueda usar para detectar el conflicto. Al escribir la
      // misma fila que completeMaintenance escribe, ambas transacciones
      // Serializable compiten por el mismo row lock: esto es lo que impide
      // que una evidencia se cree justo cuando el mantenimiento pasa a
      // COMPLETED en una carrera real (ver runSerializableTransaction y el
      // comentario equivalente en maintenance.service.js#completeMaintenance).
      const touchResult = await tx.maintenance.updateMany({
        where: { id: maintenanceId, status: "IN_PROGRESS" },
        data: { status: "IN_PROGRESS" },
      });

      if (touchResult.count === 0) {
        const maintenanceExists = await tx.maintenance.findUnique({
          where: { id: maintenanceId },
          select: { id: true },
        });

        return { code: maintenanceExists ? "INVALID_STATE" : "NOT_FOUND" };
      }

      const currentCount = await tx.evidence.count({
        where: { maintenanceId },
      });

      if (currentCount >= env.maxEvidencesPerMaintenance) {
        return { code: "LIMIT_REACHED" };
      }

      const created = await tx.evidence.create({
        data: {
          maintenanceId,
          uploadedById: userId,
          originalName: uploadedFile.originalname,
          storedName,
          mimeType: detected.mime,
          sizeBytes: uploadedFile.size,
          relativePath: storedName,
        },
        select: publicEvidenceSelect,
      });

      return { code: "CREATED", evidence: created };
    });
  } catch (error) {
    // La transaccion fallo por una razon distinta a los outcomes de negocio
    // (p. ej. conflicto de serializacion tras agotar reintentos): el archivo
    // fisico ya escrito queda huerfano si no se compensa aqui.
    await deleteEvidenceFileIfExists(storedName);
    throw error;
  }

  if (outcome.code !== "CREATED") {
    await deleteEvidenceFileIfExists(storedName);
  }

  if (outcome.code === "NOT_FOUND") {
    throw createHttpError(404, "Maintenance not found");
  }

  if (outcome.code === "INVALID_STATE") {
    throw createHttpError(
      409,
      "Evidences can only be uploaded while the maintenance is in progress",
    );
  }

  if (outcome.code === "LIMIT_REACHED") {
    throw createHttpError(
      409,
      `Maximum number of evidences (${env.maxEvidencesPerMaintenance}) reached for this maintenance`,
    );
  }

  return outcome.evidence;
}

export async function getEvidenceFileForDownload(maintenanceId, evidenceId) {
  await getMaintenanceOrThrow(prisma, maintenanceId);

  const evidence = await prisma.evidence.findFirst({
    where: { id: evidenceId, maintenanceId },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      storedName: true,
    },
  });

  if (!evidence) {
    throw createHttpError(404, "Evidence not found");
  }

  const filePath = getEvidenceFilePath(evidence.storedName);

  try {
    await fs.access(filePath);
  } catch {
    throw createHttpError(404, "Evidence file not found");
  }

  const disposition =
    ALLOWED_EVIDENCE_TYPES[evidence.mimeType]?.disposition ?? "attachment";

  return {
    filePath,
    mimeType: evidence.mimeType,
    originalName: evidence.originalName,
    disposition,
  };
}

export async function deleteEvidence(maintenanceId, evidenceId) {
  const maintenance = await getMaintenanceOrThrow(prisma, maintenanceId);

  const evidence = await prisma.evidence.findFirst({
    where: { id: evidenceId, maintenanceId },
    select: { id: true, storedName: true },
  });

  if (!evidence) {
    throw createHttpError(404, "Evidence not found");
  }

  if (maintenance.status !== "IN_PROGRESS") {
    throw createHttpError(
      409,
      "Evidences can only be deleted while the maintenance is in progress",
    );
  }

  let movedToQuarantine = false;

  try {
    await moveEvidenceToQuarantine(evidence.storedName);
    movedToQuarantine = true;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw createHttpError(
        500,
        "Failed to prepare the evidence file for deletion",
      );
    }
    // El archivo fisico ya no existe: se continua de forma controlada y la
    // eliminacion de la fila procede igual (idempotente).
  }

  let outcome;

  try {
    outcome = await runSerializableTransaction(async (tx) => {
      // Mismo motivo que en createEvidence: un UPDATE condicionado (en vez
      // de un SELECT de solo lectura) crea la dependencia de escritura sobre
      // Maintenance necesaria para que PostgreSQL detecte el conflicto con
      // completeMaintenance y nunca deje eliminar una evidencia justo cuando
      // el mantenimiento pasa a COMPLETED en una carrera real.
      const touchResult = await tx.maintenance.updateMany({
        where: { id: maintenanceId, status: "IN_PROGRESS" },
        data: { status: "IN_PROGRESS" },
      });

      if (touchResult.count === 0) {
        const maintenanceExists = await tx.maintenance.findUnique({
          where: { id: maintenanceId },
          select: { id: true },
        });

        return { code: maintenanceExists ? "INVALID_STATE" : "NOT_FOUND" };
      }

      const currentEvidence = await tx.evidence.findFirst({
        where: { id: evidenceId, maintenanceId },
        select: { id: true },
      });

      if (!currentEvidence) {
        return { code: "NOT_FOUND" };
      }

      await tx.evidence.delete({ where: { id: evidenceId } });

      return { code: "DELETED" };
    });
  } catch (error) {
    if (movedToQuarantine) {
      await restoreEvidenceFromQuarantine(evidence.storedName);
    }
    throw error;
  }

  if (outcome.code !== "DELETED") {
    if (movedToQuarantine) {
      await restoreEvidenceFromQuarantine(evidence.storedName);
    }

    if (outcome.code === "NOT_FOUND") {
      throw createHttpError(404, "Evidence not found");
    }

    throw createHttpError(
      409,
      "Evidences can only be deleted while the maintenance is in progress",
    );
  }

  if (movedToQuarantine) {
    try {
      await deleteEvidenceFromQuarantine(evidence.storedName);
    } catch (cleanupError) {
      // La fila ya fue eliminada de forma confirmada: un fallo al purgar la
      // cuarentena no debe convertirse en una respuesta enganosa para el
      // cliente. Se registra para el operador, sin exponer stack ni rutas.
      console.error(
        `Evidence quarantine cleanup failed for evidence ${evidenceId}: ${cleanupError.message}`,
      );
    }
  }
}
