import { z } from "zod";

const USER_ROLES = ["ADMIN", "OPERATOR"];

// No existia ninguna politica de fortaleza de contrasena reutilizable en el
// backend (loginSchema solo exige no-vacio, para no romper el login de
// cuentas ya sembradas). Se define aqui un minimo razonable para
// contrasenas NUEVAS (creacion y restablecimiento administrativo).
const passwordField = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters long");

export const createUserSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required"),
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email format")
    .toLowerCase(),
  password: passwordField,
  role: z.enum(USER_ROLES).optional(),
});

export const updateUserSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required"),
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email format")
    .toLowerCase(),
  role: z.enum(USER_ROLES, { required_error: "Role is required" }),
});

export const userStatusSchema = z
  .object({
    isActive: z.boolean({
      required_error: "isActive is required",
      invalid_type_error: "isActive must be a boolean",
    }),
  })
  .strict();

export const userPasswordSchema = z
  .object({
    newPassword: passwordField,
  })
  .strict();
