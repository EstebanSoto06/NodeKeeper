import { Router } from "express";

import { authenticate, authorizeRoles } from "../../middlewares/auth.middleware.js";
import {
  list,
  getById,
  create,
  update,
  setActive,
  resetPassword,
} from "./user.controller.js";

// La administracion de usuarios es exclusiva de ADMIN: a diferencia de los
// demas modulos (donde OPERATOR conserva acceso de lectura), aqui OPERATOR
// no tiene ningun acceso, ni siquiera de consulta.
const router = Router();

router.get("/", authenticate, authorizeRoles("ADMIN"), list);
router.get("/:id", authenticate, authorizeRoles("ADMIN"), getById);
router.post("/", authenticate, authorizeRoles("ADMIN"), create);
router.patch("/:id", authenticate, authorizeRoles("ADMIN"), update);
router.patch("/:id/status", authenticate, authorizeRoles("ADMIN"), setActive);
router.patch(
  "/:id/password",
  authenticate,
  authorizeRoles("ADMIN"),
  resetPassword,
);

export default router;
