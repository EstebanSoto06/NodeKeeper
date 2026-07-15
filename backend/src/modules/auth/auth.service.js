import { prisma } from "../../config/prisma.js";
import { comparePassword } from "../../utils/password.js";
import { signToken } from "../../utils/jwt.js";

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  const token = signToken({
    sub: user.id,
    role: user.role,
  });

  return {
    user: sanitizeUser(user),
    token,
  };
}

export function toAuthUser(user) {
  return sanitizeUser(user);
}
