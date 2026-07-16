import { z } from "zod";

const EQUIPMENT_STATUSES = ["OPERATIONAL", "MAINTENANCE", "OUT_OF_SERVICE"];

export const equipmentSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required"),
  category: z
    .string({ required_error: "Category is required" })
    .trim()
    .min(1, "Category is required"),
  serialNumber: z.string().trim().min(1).optional().nullable(),
  status: z.enum(EQUIPMENT_STATUSES).optional(),
  networkNodeId: z
    .string({ required_error: "Network node is required" })
    .trim()
    .min(1, "Network node is required"),
  supportProviderId: z.string().trim().min(1).optional().nullable(),
});
