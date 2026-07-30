import crypto from "node:crypto";

// Correlaciona logs de una misma solicitud (util para runbooks/depuracion):
// respeta un X-Request-Id entrante (p. ej. de un proxy) o genera uno nuevo.
// No expone nada sensible: es solo un identificador opaco.
export function requestId(req, res, next) {
  req.id = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}
