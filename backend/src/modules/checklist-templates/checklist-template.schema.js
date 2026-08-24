import { z } from "zod";

// Limites defensivos: una plantilla es una lista operativa, no un documento.
// ChecklistTask.description no tiene tope en base de datos, asi que este
// limite acota lo que se puede GUARDAR en una plantilla, sin restringir las
// tareas que el ADMIN escribe a mano en un checklist.
const MAX_ITEMS_PER_TEMPLATE = 50;
const MAX_DESCRIPTION_LENGTH = 200;

// Normalizacion usada UNICAMENTE para detectar duplicados: minusculas y
// espacios colapsados. Deliberadamente NO elimina acentos: en español
// "revision" y "revisión" son palabras distintas, y el proyecto ya cuida los
// acentos de forma explicita (ver utils/evidence-file.js). El texto que se
// persiste es siempre el original con trim, nunca esta forma normalizada.
export function normalizeForComparison(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

const templateItemSchema = z
  .object({
    description: z
      .string({ required_error: "Description is required" })
      .trim()
      .min(1, "Description is required")
      .max(
        MAX_DESCRIPTION_LENGTH,
        `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
      ),
  })
  .strict();

// Dos items con el mismo texto dentro de UNA misma plantilla no aportan nada
// y solo confunden al aplicarla, asi que se rechazan aqui. El error se marca
// sobre el segundo item (el que colisiona), de modo que errors[].path apunte
// al campo concreto del formulario -- "items.3.description" -- y el frontend
// pueda resaltarlo. Ojo: esta regla aplica DENTRO de la plantilla; los
// duplicados CONTRA un checklist ya existente si estan permitidos al aplicar
// (ver checklist-task.service.js#applyChecklistTemplate).
function rejectDuplicateItems(items, ctx) {
  const seen = new Map();

  items.forEach((item, index) => {
    const key = normalizeForComparison(item.description);
    const firstIndex = seen.get(key);

    if (firstIndex === undefined) {
      seen.set(key, index);
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["items", index, "description"],
      message: `Duplicate task: this text repeats task ${firstIndex + 1}`,
    });
  });
}

const itemsSchema = z
  .array(templateItemSchema, { required_error: "Items are required" })
  .min(1, "The template must have at least one task")
  .max(
    MAX_ITEMS_PER_TEMPLATE,
    `The template must have at most ${MAX_ITEMS_PER_TEMPLATE} tasks`,
  );

const baseTemplateShape = {
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(120, "Name must be at most 120 characters"),
  description: z.string().trim().min(1).max(500).optional().nullable(),
  items: itemsSchema,
};

export const createChecklistTemplateSchema = z
  .object(baseTemplateShape)
  .strict()
  .superRefine((value, ctx) => rejectDuplicateItems(value.items, ctx));

// Mismo contrato que create: el PUT es declarativo (el array enviado es el
// estado final de los items), igual que el resto de los PUT del proyecto.
export const updateChecklistTemplateSchema = z
  .object(baseTemplateShape)
  .strict()
  .superRefine((value, ctx) => rejectDuplicateItems(value.items, ctx));

