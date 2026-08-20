import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import multer from "multer";

import { env } from "../config/env.js";
import { createHttpError } from "../utils/http-error.js";
import { ALLOWED_DECLARED_MIME_TYPES } from "../utils/evidence-file.js";

const uploadDir = path.resolve(env.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });

// El nombre fisico definitivo (cuid/uuid + extension controlada por el tipo
// real detectado) se calcula despues, en evidence.service.js, una vez que el
// contenido ya fue verificado. Aqui solo se necesita un nombre temporal que
// no exponga el nombre original ni nada adivinable por el cliente.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `tmp-${crypto.randomUUID()}`),
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_DECLARED_MIME_TYPES.has(file.mimetype)) {
    return cb(createHttpError(400, "Unsupported declared file type"));
  }

  return cb(null, true);
}

const evidenceUpload = multer({
  storage,
  fileFilter,
  // Los navegadores envian el filename del multipart codificado en UTF-8,
  // pero multer lo decodifica como latin1 salvo que se le indique otra cosa
  // (multer/index.js: `options.defParamCharset || 'latin1'`). Sin esta linea,
  // subir "Diagrama sin titulo.png" con tildes guardaba
  // "Diagrama sin tÃ­tulo.png" en Evidence.originalName, porque los bytes
  // UTF-8 de cada acento se leian como dos caracteres latin1.
  //
  // Se corrige en el origen y no re-decodificando el string mas adelante
  // (Buffer.from(name, "latin1").toString("utf8")): ese arreglo tardio
  // corrompe los nombres que SI llegaron bien y hay que repetirlo en cada
  // punto que lea originalname. Solo afecta al nombre declarado; el archivo
  // fisico se guarda con un UUID (storedName) y nunca dependio de esto.
  defParamCharset: "utf8",
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024,
    files: 1,
  },
}).single("file");

const MULTER_ERROR_MESSAGES = {
  LIMIT_FILE_SIZE: "File exceeds the maximum allowed size",
  LIMIT_FILE_COUNT: "Only one file is allowed per request",
  LIMIT_UNEXPECTED_FILE: "Only one file is allowed per request",
};

export function handleEvidenceUpload(req, res, next) {
  evidenceUpload(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        return next(
          createHttpError(
            400,
            MULTER_ERROR_MESSAGES[error.code] || "Invalid file upload",
          ),
        );
      }

      if (error.statusCode) {
        return next(error);
      }

      // Cualquier otro error de bajo nivel (p. ej. multipart mal formado) no
      // debe escapar como 500: es un error esperable de una carga invalida.
      return next(createHttpError(400, "Invalid file upload"));
    }

    if (!req.file) {
      return next(createHttpError(400, "File is required"));
    }

    return next();
  });
}
