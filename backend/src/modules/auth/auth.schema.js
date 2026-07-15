import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
    })
    .trim()
    .email("Invalid email format")
    .toLowerCase(),
  password: z
    .string({
      required_error: "Password is required",
    })
    .min(1, "Password is required"),
});
