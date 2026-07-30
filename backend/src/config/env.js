import dotenv from "dotenv";

dotenv.config();

const requiredVariables = ["DATABASE_URL", "JWT_SECRET"];

for (const variableName of requiredVariables) {
  if (!process.env[variableName]) {
    throw new Error(`Missing required environment variable: ${variableName}`);
  }
}

// Parsea una variable de entorno numerica opcional como entero positivo. Si
// no esta definida, usa defaultValue sin validar (permite que el limitador
// quede deshabilitado en la practica en test, ver mas abajo). Si SI esta
// definida pero no es un entero positivo, falla rapido con un mensaje claro
// en vez de dejar pasar un valor sin sentido (0, negativo, o no numerico) a
// una libreria de terceros.
function parsePositiveIntEnv(name, defaultValue) {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return defaultValue;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid environment variable ${name}: expected a positive integer, got "${raw}"`,
    );
  }

  return parsed;
}

const nodeEnv = process.env.NODE_ENV || "development";

// En pruebas (Vitest/Supertest contra la app real), cientos de solicitudes
// legitimas pueden ocurrir dentro de la misma ventana sin que exista ningun
// abuso real: los defaults de test son deliberadamente altos para no
// bloquear la suite por accidente. Los defaults de desarrollo/produccion son
// los solicitados (general 300/15min, login 10 intentos fallidos/15min). Una
// variable de entorno explicita siempre gana sobre estos defaults,
// independientemente del entorno.
const isTestEnv = nodeEnv === "test";

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  uploadDir: process.env.UPLOAD_DIR || "uploads/evidences",
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 10),
  maxEvidencesPerMaintenance: Number(
    process.env.MAX_EVIDENCES_PER_MAINTENANCE || 20,
  ),
  rateLimitWindowMs: parsePositiveIntEnv(
    "RATE_LIMIT_WINDOW_MS",
    15 * 60 * 1000,
  ),
  rateLimitMax: parsePositiveIntEnv(
    "RATE_LIMIT_MAX",
    isTestEnv ? 100000 : 300,
  ),
  authRateLimitWindowMs: parsePositiveIntEnv(
    "AUTH_RATE_LIMIT_WINDOW_MS",
    15 * 60 * 1000,
  ),
  authRateLimitMax: parsePositiveIntEnv(
    "AUTH_RATE_LIMIT_MAX",
    isTestEnv ? 100000 : 10,
  ),
};
