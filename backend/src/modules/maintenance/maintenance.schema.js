import { z } from "zod";

const MAINTENANCE_TYPES = ["PREVENTIVE", "CORRECTIVE"];

export const maintenanceSchema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .trim()
    .min(1, "Title is required"),
  description: z.string().trim().min(1).optional().nullable(),
  type: z.enum(MAINTENANCE_TYPES),
  scheduledDate: z.coerce.date().optional().nullable(),
  networkNodeId: z.string().trim().min(1).optional().nullable(),
  equipmentId: z.string().trim().min(1).optional().nullable(),
});
