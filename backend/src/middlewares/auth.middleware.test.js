import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "./error.middleware.js";
import { authenticate, authorizeRoles } from "./auth.middleware.js";
import { loginUser } from "../modules/auth/auth.service.js";

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const adminPassword = getRequiredEnv("SEED_ADMIN_PASSWORD");
const operatorPassword = getRequiredEnv("SEED_OPERATOR_PASSWORD");

function createRoleTestApp() {
  const app = express();

  app.get(
    "/admin-only",
    authenticate,
    authorizeRoles("ADMIN"),
    (req, res) => {
      return res.status(200).json({
        success: true,
        message: "Admin access granted",
        role: req.user.role,
      });
    },
  );

  app.get(
    "/admin-or-operator",
    authenticate,
    authorizeRoles("ADMIN", "OPERATOR"),
    (req, res) => {
      return res.status(200).json({
        success: true,
        message: "Shared access granted",
        role: req.user.role,
      });
    },
  );

  app.use(errorHandler);

  return app;
}

describe("Auth role middleware", () => {
  it("allows ADMIN users to access ADMIN routes", async () => {
    const app = createRoleTestApp();

    const login = await loginUser({
      email: "admin@nodekeeper.local",
      password: adminPassword,
    });

    const response = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${login.token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.role).toBe("ADMIN");
  });

  it("rejects OPERATOR users from ADMIN routes", async () => {
    const app = createRoleTestApp();

    const login = await loginUser({
      email: "operador@nodekeeper.local",
      password: operatorPassword,
    });

    const response = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${login.token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Forbidden");
  });

  it("allows OPERATOR users to access shared routes", async () => {
    const app = createRoleTestApp();

    const login = await loginUser({
      email: "operador@nodekeeper.local",
      password: operatorPassword,
    });

    const response = await request(app)
      .get("/admin-or-operator")
      .set("Authorization", `Bearer ${login.token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.role).toBe("OPERATOR");
  });
});
