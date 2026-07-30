import { ZodError } from "zod";

export function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
}

export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const statusCode = error.statusCode || 500;

  // Solo se registran errores inesperados (5xx) en el log del servidor, con
  // el request id para correlacionar; los 4xx de negocio (validacion,
  // permisos, conflicto) no ensucian el log. Nunca se registra el body de la
  // solicitud, el header Authorization ni ninguna contraseña.
  if (statusCode >= 500) {
    console.error(
      `[${req.id || "-"}] ${req.method} ${req.originalUrl} -> ${statusCode}: ${error.message}`,
    );
  }

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
    }),
  });
}
