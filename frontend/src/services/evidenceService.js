/* Servicio de Evidencias. Endpoints anidados bajo un mantenimiento:
   /maintenances/:maintenanceId/evidences (ver
   backend/src/modules/evidences/evidence.routes.js). Cubre listar, subir
   (multipart), descargar (blob autenticado) y eliminar.

   El backend NO expone una galeria global de evidencias: siempre se opera en
   el contexto de un mantenimiento, por eso todas las funciones reciben
   maintenanceId. Nunca se manejan ni exponen rutas fisicas del servidor: la
   descarga llega como blob y el nombre sugerido proviene de la cabecera
   Content-Disposition (resuelta dentro del apiClient). */
import { apiGet, apiUpload, apiDelete, apiDownload } from './apiClient.js';

function base(maintenanceId) {
  return `/maintenances/${maintenanceId}/evidences`;
}

/** GET .../evidences -> metadata publica (sin storedName ni relativePath) */
export function list(maintenanceId) {
  return apiGet(base(maintenanceId));
}

/**
 * POST .../evidences (multipart). Recibe un File del input y arma el FormData
 * con el campo "file" que espera el middleware de carga del backend.
 */
export function upload(maintenanceId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload(base(maintenanceId), formData);
}

/**
 * GET .../evidences/:evidenceId/file -> descarga binaria autenticada.
 * Devuelve { blob, filename, contentType } para que la UI genere el enlace de
 * descarga sin exponer la ruta fisica del archivo.
 */
export function download(maintenanceId, evidenceId) {
  return apiDownload(`${base(maintenanceId)}/${evidenceId}/file`);
}

/** DELETE .../evidences/:evidenceId (solo ADMIN, mantenimiento IN_PROGRESS) */
export function remove(maintenanceId, evidenceId) {
  return apiDelete(`${base(maintenanceId)}/${evidenceId}`);
}
