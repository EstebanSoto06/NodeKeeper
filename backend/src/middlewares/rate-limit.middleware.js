import rateLimit from "express-rate-limit";

import { env } from "../config/env.js";

// Respuesta segura y generica: nunca revela si el limite se supero por
// intentos de login invalidos contra un correo real, ni expone detalles
// internos (stack, nombres de configuracion). express-rate-limit ya agrega
// el header Retry-After por su cuenta cuando el limite se excede.
function sendTooManyRequests(req, res) {
  return res.status(429).json({
    success: false,
    message: "Demasiadas solicitudes. Intenta nuevamente más tarde.",
  });
}

// Fabricas (no instancias fijas): permiten que las pruebas del propio
// limitador construyan instancias independientes con ventanas/maximos bajos,
// sin compartir estado con la instancia real que usa la aplicacion (ver
// rate-limit.middleware.test.js). No se implementa un keyGenerator manual:
// express-rate-limit ya normaliza IPv4/IPv6 de forma correcta a partir de
// req.ip, que a su vez depende de la configuracion de "trust proxy" de
// Express (ver nota en app.js: no se activa a ciegas).
export function createApiRateLimiter(options = {}) {
  return rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: sendTooManyRequests,
    ...options,
  });
}

export function createAuthRateLimiter(options = {}) {
  return rateLimit({
    windowMs: env.authRateLimitWindowMs,
    max: env.authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    // Un login exitoso no debe consumir para siempre el cupo de intentos
    // fallidos: solo las respuestas de error (credenciales invalidas) cuentan
    // contra este limite.
    skipSuccessfulRequests: true,
    handler: sendTooManyRequests,
    ...options,
  });
}

// Instancias reales que usa la aplicacion (ver app.js / auth.routes.js).
export const apiRateLimiter = createApiRateLimiter();
export const authRateLimiter = createAuthRateLimiter();
