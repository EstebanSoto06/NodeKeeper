export function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
}

export function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
    }),
  });
}
