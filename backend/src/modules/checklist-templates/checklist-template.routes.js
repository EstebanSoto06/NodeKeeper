import { Router } from "express";

import { authenticate, authorizeRoles } from "../../middlewares/auth.middleware.js";
import { list, getById, create, update, remove } from "./checklist-template.controller.js";

// TODAS las rutas son ADMIN-only, incluidas las de lectura: una plantilla
// solo se usa desde flujos que ya requieren ADMIN (crear un mantenimiento y
// modificar la estructura de un checklist), de modo que un OPERATOR no tiene
// ningun uso para ellas y no hay razon para exponerselas. A diferencia de
// los catalogos (nodos, equipos, proveedores), que si son de consulta
// general para ambos roles.
const router = Router();

router.get("/", authenticate, authorizeRoles("ADMIN"), list);
router.get("/:id", authenticate, authorizeRoles("ADMIN"), getById);
router.post("/", authenticate, authorizeRoles("ADMIN"), create);
router.put("/:id", authenticate, authorizeRoles("ADMIN"), update);
router.delete("/:id", authenticate, authorizeRoles("ADMIN"), remove);

export default router;
