import { Router } from "express";

import { authenticate, authorizeRoles } from "../../middlewares/auth.middleware.js";
import {
  list,
  create,
  update,
  remove,
  setStatus,
  applyTemplate,
} from "./checklist-task.controller.js";

// mergeParams: true es obligatorio porque este router se monta bajo
// /api/maintenances/:maintenanceId/checklist-tasks y necesita leer
// req.params.maintenanceId definido por el router padre.
const router = Router({ mergeParams: true });

router.get("/", authenticate, authorizeRoles("ADMIN", "OPERATOR"), list);
router.post("/", authenticate, authorizeRoles("ADMIN"), create);
// Se declara antes que cualquier ruta con parametro para que un segmento
// literal nunca pueda quedar capturado por un :taskId. Solo ADMIN: aplicar
// una plantilla crea tareas, y crear tareas ya era exclusivo de ADMIN.
router.post(
  "/apply-template",
  authenticate,
  authorizeRoles("ADMIN"),
  applyTemplate,
);
router.put("/:taskId", authenticate, authorizeRoles("ADMIN"), update);
router.patch(
  "/:taskId/status",
  authenticate,
  authorizeRoles("ADMIN", "OPERATOR"),
  setStatus,
);
router.delete("/:taskId", authenticate, authorizeRoles("ADMIN"), remove);

export default router;
