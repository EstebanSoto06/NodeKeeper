import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import authRoutes from "./modules/auth/auth.routes.js";
import supportProviderRoutes from "./modules/support-providers/support-provider.routes.js";
import networkNodeRoutes from "./modules/network-nodes/network-node.routes.js";
import equipmentRoutes from "./modules/equipment/equipment.routes.js";
import maintenanceRoutes from "./modules/maintenance/maintenance.routes.js";
import checklistTaskRoutes from "./modules/checklist-tasks/checklist-task.routes.js";
import healthRoutes from "./routes/health.routes.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

if (env.nodeEnv !== "test") {
  app.use(morgan("dev"));
}

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "NodeKeeper API",
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/support-providers", supportProviderRoutes);
app.use("/api/network-nodes", networkNodeRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/maintenances", maintenanceRoutes);
app.use(
  "/api/maintenances/:maintenanceId/checklist-tasks",
  checklistTaskRoutes,
);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
