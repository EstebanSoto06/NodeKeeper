import { Router } from "express";

import { authenticate, authorizeRoles } from "../../middlewares/auth.middleware.js";
import { list, create, update, remove, setStatus } from "./checklist-task.controller.js";

// mergeParams: true es obligatorio porque este router se monta bajo
// /api/maintenances/:maintenanceId/checklist-tasks y necesita leer
// req.params.maintenanceId definido por el router padre.
const router = Router({ mergeParams: true });

router.get("/", authenticate, authorizeRoles("ADMIN", "OPERATOR"), list);
router.post("/", authenticate, authorizeRoles("ADMIN"), create);
router.put("/:taskId", authenticate, authorizeRoles("ADMIN"), update);
router.patch(
  "/:taskId/status",
  authenticate,
  authorizeRoles("ADMIN", "OPERATOR"),
  setStatus,
);
router.delete("/:taskId", authenticate, authorizeRoles("ADMIN"), remove);

export default router;
