/* Validacion de formularios en el frontend: solo evita llamadas a la API con
   datos obviamente incompletos y explica, en espanol, que falta. NUNCA
   reemplaza la validacion real del backend (ver *.schema.js en cada modulo) —
   los errores de negocio reales (409, 404, permisos, red) se siguen mostrando
   tal cual los devuelve la API. */

/** "Faltan datos obligatorios: A, B, C." a partir de las etiquetas de los
    campos faltantes, en el orden dado. Devuelve '' si no falta nada. */
export function buildRequiredFieldsError(missingLabels) {
  if (!missingLabels || missingLabels.length === 0) return '';
  return `Faltan datos obligatorios: ${missingLabels.join(', ')}.`;
}

/**
 * Valida una lista de campos requeridos ANTES de enviar el formulario.
 *
 * @param {{ key: string, label: string, value: unknown, message?: string }[]} fields
 *   `value` se considera presente si, convertido a string y sin espacios,
 *   no queda vacio (sirve igual para texto, selects y <input type="date">,
 *   que en este Design System siempre representan su valor como string).
 * @returns {{ isValid: boolean, fieldErrors: Record<string,string>, formError: string }}
 */
export function validateRequired(fields) {
  const missing = fields.filter((f) => !String(f.value ?? '').trim());
  const fieldErrors = {};
  missing.forEach((f) => {
    fieldErrors[f.key] = f.message || `${f.label} es obligatorio.`;
  });

  return {
    isValid: missing.length === 0,
    fieldErrors,
    formError: buildRequiredFieldsError(missing.map((f) => f.label)),
  };
}

/**
 * Convierte el `errors[]` de una respuesta 400 del backend (Zod) en un mapa
 * { path: mensaje } listo para pintar cada campo del formulario.
 *
 * Vivia duplicada, identica, en los seis modales de formulario; se centraliza
 * aqui porque todos consumen el MISMO contrato de error del backend (ver
 * errorHandler en backend/src/middlewares/error.middleware.js).
 *
 * @param {{errors?: {path?: string, message?: string}[]}} err error de apiClient
 * @returns {Record<string,string>}
 */
export function fieldErrorsFrom(err) {
  const out = {};
  (err?.errors || []).forEach((e) => {
    if (e.path) out[e.path] = e.message;
  });
  return out;
}
