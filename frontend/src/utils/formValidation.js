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

/* ---------------------------------------------------------------------------
   Conflictos de negocio (409)
   ---------------------------------------------------------------------------

   Un 409 ya NO significa "valor duplicado". El backend lo devuelve tambien
   cuando una regla de mantenimiento bloquea la operacion (estado automatico
   MAINTENANCE, liberar un recurso con orden activa, mover un equipo de nodo
   durante una orden, conflicto de serializacion...). Atribuirlos todos al
   campo Codigo o Numero de serie mostraba el mensaje bajo un campo que no
   tenia nada que ver.

   Para repartirlos hay que distinguirlos, y el unico dato disponible es el
   mensaje: el envelope de error del backend (ver errorHandler en
   backend/src/middlewares/error.middleware.js) solo lleva `errors[]` con
   `path` en los 400 de Zod; los 409 viajan como { success, message } sin
   codigo de negocio.

   Esa comparacion es fiable porque los dos mensajes de duplicidad son
   constantes literales fijas en el backend (network-node.service.js y
   equipment.service.js), no textos compuestos ni traducidos, y son unicos
   entre todos los 409 que esas rutas pueden devolver. El criterio ademas es
   CONSERVADOR: solo un mensaje conocido se atribuye al campo; cualquier otro
   -incluido uno que no reconozcamos- cae en el error general del formulario,
   que siempre es visible. Un mensaje nuevo en el backend nunca puede acabar
   escondido bajo un campo equivocado. */

// Copias EXACTAS de los mensajes del backend. Si alguno cambia alli, el
// conflicto pasa a mostrarse como error general (visible y correcto), nunca
// bajo el campo equivocado.
export const DUPLICATE_NODE_CODE_MESSAGE = 'Network node code already exists';
export const DUPLICATE_EQUIPMENT_SERIAL_MESSAGE = 'Equipment serial number already exists';

const GENERIC_CONFLICT_MESSAGE =
  'No se pudo guardar por un conflicto con el estado actual del registro.';

/**
 * Reparte un error 409 entre "error de este campo" y "error general".
 *
 * @param {{message?: string}} err error de apiClient con status 409.
 * @param {{ field: string, duplicateMessage: string }} options campo al que
 *   pertenece la duplicidad y mensaje exacto que la identifica.
 * @returns {{ fieldErrors: Record<string,string>, formError: string }} listo
 *   para pasar a setFieldErrors/setFormError.
 */
export function conflictErrorsFrom(err, { field, duplicateMessage }) {
  const message = (err?.message || '').trim();

  if (message === duplicateMessage) {
    return { fieldErrors: { [field]: message }, formError: '' };
  }

  return { fieldErrors: {}, formError: message || GENERIC_CONFLICT_MESSAGE };
}
