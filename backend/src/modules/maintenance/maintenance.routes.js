import { Router } from "express";

import { authenticate, authorizeRoles } from "../../middlewares/auth.middleware.js";
import {
  list,
  getById,
  create,
  update,
  remove,
  start,
  complete,
} from "./maintenance.controller.js";

const router = Router();

router.get("/", authenticate, authorizeRoles("ADMIN", "OPERATOR"), list);
router.get("/:id", authenticate, authorizeRoles("ADMIN", "OPERATOR"), getById);
router.post("/", authenticate, authorizeRoles("ADMIN"), create);
router.put("/:id", authenticate, authorizeRoles("ADMIN"), update);
router.delete("/:id", authenticate, authorizeRoles("ADMIN"), remove);
router.post("/:id/start", authenticate, authorizeRoles("ADMIN", "OPERATOR"), start);
router.post(
  "/:id/complete",
  authenticate,
  authorizeRoles("ADMIN", "OPERATOR"),
  complete,
);

export default router;
