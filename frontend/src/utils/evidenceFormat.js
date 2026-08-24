/* Formateo compartido de metadata de evidencias. Vive aparte porque lo usan
   tanto el panel dentro de un mantenimiento (components/EvidencePanel.jsx)
   como el listado global de /evidencias (pages/EvidencesInfo.jsx), y ambos
   deben mostrar el mismo tamano y el mismo icono para el mismo archivo.

   Los mimeType posibles son los que acepta el backend
   (backend/src/utils/evidence-file.js#ALLOWED_EVIDENCE_TYPES): JPEG, PNG,
   PDF y DOCX. */

/** 204800 -> "200.0 KB". Formato compacto para celdas de tabla. */
export function formatSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** true para los formatos de imagen que acepta el backend. */
export function isImageMimeType(mimeType) {
  return String(mimeType ?? '').startsWith('image/');
}

/** Nombre de icono del kit (components/Icon.jsx) para un mimeType dado. */
export function iconForMimeType(mimeType) {
  return isImageMimeType(mimeType) ? 'image' : 'file-text';
}

/** Etiqueta corta y legible del formato, para filtros y columnas. */
export function fileKindLabel(mimeType) {
  if (isImageMimeType(mimeType)) return 'Imagen';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'DOCX';
  return 'Documento';
}

/**
 * Fuerza la descarga de un blob ya recibido del backend con el nombre
 * sugerido. Vivia duplicada, identica, en EvidencePanel y EvidencesInfo.
 *
 * El objeto URL se revoca siempre tras el click para no filtrar memoria.
 *
 * @param {Blob} blob contenido devuelto por apiDownload
 * @param {string} filename nombre sugerido (Content-Disposition del backend)
 */
export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'evidencia';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
