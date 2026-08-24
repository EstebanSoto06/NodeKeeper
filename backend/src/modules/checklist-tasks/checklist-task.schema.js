import { z } from "zod";

export const createChecklistTaskSchema = z
  .object({
    description: z
      .string({ required_error: "Description is required" })
      .trim()
      .min(1, "Description is required"),
    sortOrder: z.number().int("sortOrder must be an integer").optional(),
  })
  .strict();

export const updateChecklistTaskSchema = z
  .object({
    description: z
      .string({ required_error: "Description is required" })
      .trim()
      .min(1, "Description is required"),
    sortOrder: z
      .number({ required_error: "sortOrder is required" })
      .int("sortOrder must be an integer"),
  })
  .strict();

export const checklistTaskStatusSchema = z
  .object({
    isCompleted: z.boolean({
      required_error: "isCompleted is required",
      invalid_type_error: "isCompleted must be a boolean",
    }),
  })
  .strict();

// Body de POST .../checklist-tasks/apply-template. Solo viaja el id de la
// plantilla: las descripciones y su orden se leen SIEMPRE del servidor, para
// que un cliente no pueda inyectar tareas arbitrarias haciendolas pasar por
// el contenido de una plantilla.
export const applyChecklistTemplateSchema = z
  .object({
    templateId: z
      .string({ required_error: "templateId is required" })
      .trim()
      .min(1, "templateId is required"),
  })
  .strict();
