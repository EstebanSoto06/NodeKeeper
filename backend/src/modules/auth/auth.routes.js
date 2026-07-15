import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware.js";
import { login, me } from "./auth.controller.js";

const router = Router();

router.post("/login", login);
router.get("/me", authenticate, me);

export default router;
