import { Router } from "express";

import { authenticate, authorizeRoles } from "../../middlewares/auth.middleware.js";
import { handleEvidenceUpload } from "../../middlewares/upload.middleware.js";
import { list, upload, download, remove } from "./evidence.controller.js";

// mergeParams: true es obligatorio porque este router se monta bajo
// /api/maintenances/:maintenanceId/evidences y necesita leer
// req.params.maintenanceId definido por el router padre.
const router = Router({ mergeParams: true });

router.get("/", authenticate, authorizeRoles("ADMIN", "OPERATOR"), list);
router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "OPERATOR"),
  handleEvidenceUpload,
  upload,
);
router.get(
  "/:evidenceId/file",
  authenticate,
  authorizeRoles("ADMIN", "OPERATOR"),
  download,
);
router.delete("/:evidenceId", authenticate, authorizeRoles("ADMIN"), remove);

export default router;
