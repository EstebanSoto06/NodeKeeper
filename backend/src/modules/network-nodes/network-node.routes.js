import { Router } from "express";

import { authenticate, authorizeRoles } from "../../middlewares/auth.middleware.js";
import { list, map, getById, create, update, remove } from "./network-node.controller.js";

const router = Router();

router.get("/", authenticate, authorizeRoles("ADMIN", "OPERATOR"), list);
router.get("/map", authenticate, authorizeRoles("ADMIN", "OPERATOR"), map);
router.get("/:id", authenticate, authorizeRoles("ADMIN", "OPERATOR"), getById);
router.post("/", authenticate, authorizeRoles("ADMIN"), create);
router.put("/:id", authenticate, authorizeRoles("ADMIN"), update);
router.delete("/:id", authenticate, authorizeRoles("ADMIN"), remove);

export default router;
