/* Reglas de texto de las plantillas de checklist, compartidas por el modal de
   administración y por el diálogo de aplicación.

   Espejo EXACTO de backend/src/modules/checklist-templates/checklist-template
   .schema.js#normalizeForComparison: minúsculas y espacios colapsados. No se
   eliminan acentos a propósito — en español «revision» y «revisión» son
   palabras distintas, y el proyecto ya cuida los acentos de forma explícita
   (ver utils/evidenceFormat.js). El texto que se envía al backend es siempre
   el original con trim, nunca esta forma normalizada.

   Estas funciones son un ESPEJO de la validación real del servidor, para
   avisar antes de enviar; nunca la sustituyen. */

/** Forma canónica usada SOLO para comparar, nunca para persistir. */
export function normalizeTaskText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Índices de los elementos que repiten el texto de uno anterior dentro de la
 * MISMA plantilla. El backend rechaza esto con 400 (una plantilla no puede
 * tener dos tareas idénticas); esta función permite marcarlo en el formulario
 * antes de enviar.
 *
 * @param {{description: string}[]} items
 * @returns {number[]} índices duplicados, en orden ascendente
 */
export function findDuplicateItemIndexes(items) {
  const seen = new Set();
  const duplicates = [];

  (items ?? []).forEach((item, index) => {
    const key = normalizeTaskText(item?.description);
    if (key === '') return;

    if (seen.has(key)) {
      duplicates.push(index);
      return;
    }
    seen.add(key);
  });

  return duplicates;
}

/**
 * Descripciones de la plantilla que ya existen en el checklist del
 * mantenimiento. A diferencia del caso anterior, esto NO es un error: el
 * backend permite duplicados al aplicar una plantilla sobre un checklist que
 * ya tiene tareas. Se usa solo para advertir al usuario antes de confirmar.
 *
 * Devuelve los textos tal y como aparecen en la PLANTILLA (no normalizados),
 * para poder nombrarlos en el aviso.
 *
 * @param {{description: string}[]} existingTasks tareas ya en el checklist
 * @param {{description: string}[]} templateItems tareas de la plantilla
 * @returns {string[]}
 */
export function findOverlappingDescriptions(existingTasks, templateItems) {
  const existing = new Set(
    (existingTasks ?? []).map((task) => normalizeTaskText(task?.description)),
  );

  return (templateItems ?? [])
    .filter((item) => existing.has(normalizeTaskText(item?.description)))
    .map((item) => item.description);
}
