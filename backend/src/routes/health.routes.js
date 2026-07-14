import { Router } from "express";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

const router = Router();

router.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "ok",
    service: "NodeKeeper API",
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

router.get("/database", async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      success: true,
      status: "ok",
      service: "NodeKeeper Database",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
