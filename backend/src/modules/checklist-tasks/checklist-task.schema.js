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
