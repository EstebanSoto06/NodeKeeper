import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../app.js";

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const adminPassword = getRequiredEnv("SEED_ADMIN_PASSWORD");
const operatorPassword = getRequiredEnv("SEED_OPERATOR_PASSWORD");

describe("Auth routes", () => {
  it("logs in with admin credentials", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin@nodekeeper.local",
        password: adminPassword,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Login successful");
    expect(response.body.data.user.email).toBe("admin@nodekeeper.local");
    expect(response.body.data.user.role).toBe("ADMIN");
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.token).toBeTruthy();
  });

  it("logs in with operator credentials", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "operador@nodekeeper.local",
        password: operatorPassword,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe("operador@nodekeeper.local");
    expect(response.body.data.user.role).toBe("OPERATOR");
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.token).toBeTruthy();
  });

  it("rejects login with wrong password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin@nodekeeper.local",
        password: "invalid-password",
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Invalid credentials");
  });

  it("rejects login with unknown user", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "unknown@nodekeeper.local",
        password: "invalid-password",
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Invalid credentials");
  });

  it("returns current user with valid token", async () => {
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin@nodekeeper.local",
        password: adminPassword,
      });

    const token = loginResponse.body.data.token;

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe("admin@nodekeeper.local");
    expect(response.body.data.user.role).toBe("ADMIN");
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  it("rejects /me without token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Unauthorized");
  });

  it("rejects /me with invalid token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Unauthorized");
  });
});
