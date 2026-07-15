import { prisma } from "../config/prisma.js";
import { verifyToken } from "../utils/jwt.js";

function createAuthError() {
  const error = new Error("Unauthorized");
  error.statusCode = 401;
  return error;
}

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw createAuthError();
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw createAuthError();
    }

    const decodedToken = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decodedToken.sub },
    });

    if (!user || !user.isActive) {
      throw createAuthError();
    }

    req.user = user;

    return next();
  } catch (error) {
    return next(createAuthError());
  }
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(createAuthError());
    }

    if (!allowedRoles.includes(req.user.role)) {
      const error = new Error("Forbidden");
      error.statusCode = 403;
      return next(error);
    }

    return next();
  };
}
