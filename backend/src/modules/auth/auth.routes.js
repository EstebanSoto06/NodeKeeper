import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware.js";
import { authRateLimiter } from "../../middlewares/rate-limit.middleware.js";
import { login, me } from "./auth.controller.js";

const router = Router();

// Limite estricto solo en login (ademas del limite general de /api ya
// aplicado en app.js): protege contra fuerza bruta sin afectar /auth/me.
router.post("/login", authRateLimiter, login);
router.get("/me", authenticate, me);

export default router;
