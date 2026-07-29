import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { fileTypeFromFile } from "file-type";

import { env } from "../config/env.js";

const QUARANTINE_DIRNAME = ".quarantine";

// Unica fuente de verdad para los formatos aceptados: el tipo REAL detectado
// por file-type (nunca la extension ni el mimetype declarado por el cliente)
// debe coincidir con una de estas claves. La extension controla el nombre
// fisico; disposition controla si el navegador debe mostrar el archivo
// inline o forzar la descarga.
export const ALLOWED_EVIDENCE_TYPES = {
  "image/jpeg": { extension: "jpg", disposition: "inline" },
  "image/png": { extension: "png", disposition: "inline" },
  "application/pdf": { extension: "pdf", disposition: "inline" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extension: "docx",
    disposition: "attachment",
  },
};

export const ALLOWED_DECLARED_MIME_TYPES = new Set(
  Object.keys(ALLOWED_EVIDENCE_TYPES),
);

function resolveUploadDir() {
  return path.resolve(env.uploadDir);
}

function resolveQuarantineDir() {
  return path.join(resolveUploadDir(), QUARANTINE_DIRNAME);
}

export function getEvidenceFilePath(fileName) {
  return path.join(resolveUploadDir(), fileName);
}

export function getQuarantineFilePath(fileName) {
  return path.join(resolveQuarantineDir(), fileName);
}

export async function ensureUploadDirectories() {
  await fs.mkdir(resolveUploadDir(), { recursive: true });
  await fs.mkdir(resolveQuarantineDir(), { recursive: true });
}

// Detecta el tipo real inspeccionando los bytes del archivo ya escrito en
// disco. Devuelve undefined si no reconoce ninguna firma (p. ej. un
// ejecutable renombrado), lo cual el llamador debe tratar como invalido.
export async function detectRealFileType(filePath) {
  return fileTypeFromFile(filePath);
}

// storedName se genera SIEMPRE en el servidor a partir de un identificador
// aleatorio no derivado del nombre original, con la extension controlada por
// el tipo real detectado (nunca por la extension que el cliente haya
// enviado).
export async function finalizeUploadedFile(temporaryFileName, extension) {
  const storedName = `${crypto.randomUUID()}.${extension}`;

  await fs.rename(
    getEvidenceFilePath(temporaryFileName),
    getEvidenceFilePath(storedName),
  );

  return storedName;
}

export async function deleteEvidenceFileIfExists(fileName) {
  try {
    await fs.unlink(getEvidenceFilePath(fileName));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

// Mueve el archivo a cuarentena mediante rename (misma unidad de
// almacenamiento, operacion atomica a nivel de filesystem). Si el archivo ya
// no existe (ENOENT) se relanza el mismo error para que el llamador decida
// continuar de forma controlada; cualquier otro error de filesystem se
// relanza tal cual para que el llamador aborte la operacion.
export async function moveEvidenceToQuarantine(fileName) {
  await fs.mkdir(resolveQuarantineDir(), { recursive: true });
  await fs.rename(getEvidenceFilePath(fileName), getQuarantineFilePath(fileName));
}

export async function restoreEvidenceFromQuarantine(fileName) {
  await fs.rename(getQuarantineFilePath(fileName), getEvidenceFilePath(fileName));
}

export async function deleteEvidenceFromQuarantine(fileName) {
  await fs.unlink(getQuarantineFilePath(fileName));
}

const CONTROL_CHARS_PATTERN = /[\x00-\x1f\x7f]/g;

// Construye un Content-Disposition seguro a partir de un originalName que no
// es de confianza (puede contener comillas, barras, secuencias ../, etc.).
// Nunca se usa para construir una ruta fisica; solo para el header que ve el
// navegador. Se envia una variante ASCII de respaldo (filename=) y una
// variante UTF-8 codificada (filename*=), tal como recomienda RFC 6266.
export function buildContentDisposition(disposition, originalName) {
  const baseName = path.basename(originalName || "").trim() || "evidence";

  const asciiFallback = baseName
    .replace(CONTROL_CHARS_PATTERN, "")
    .replace(/["\\]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_");

  const encodedName = encodeURIComponent(baseName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`;
}
