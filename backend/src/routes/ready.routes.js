import { Router } from "express";

import { prisma } from "../config/prisma.js";

// Distinto de /api/health: liveness (¿el proceso responde?) siempre 200 sin
// tocar nada externo. Readiness (¿puede atender tráfico real?) sí depende de
// PostgreSQL: 200 cuando la conexión funciona, 503 cuando no. Nunca expone
// host, usuario, contraseña, cadena de conexión ni el error real del driver
// — solo el estado binario, apto para un orquestador o balanceador.
const router = Router();

router.get("/", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      success: true,
      status: "ready",
    });
  } catch {
    return res.status(503).json({
      success: false,
      status: "not_ready",
    });
  }
});

export default router;
