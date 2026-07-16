import { z } from "zod";

const NODE_STATUSES = ["AVAILABLE", "MAINTENANCE", "OUT_OF_SERVICE"];

export const networkNodeSchema = z.object({
  code: z
    .string({ required_error: "Code is required" })
    .trim()
    .min(1, "Code is required"),
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required"),
  location: z.string().trim().min(1).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  status: z.enum(NODE_STATUSES).optional(),
});
