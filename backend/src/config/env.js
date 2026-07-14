import dotenv from "dotenv";

dotenv.config();

const requiredVariables = ["DATABASE_URL", "JWT_SECRET"];

for (const variableName of requiredVariables) {
  if (!process.env[variableName]) {
    throw new Error(`Missing required environment variable: ${variableName}`);
  }
}

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  uploadDir: process.env.UPLOAD_DIR || "uploads/evidences",
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 10),
};
