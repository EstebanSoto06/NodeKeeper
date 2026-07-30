import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../app.js";
import { createApiRateLimiter, createAuthRateLimiter } from "./rate-limit.middleware.js";

// Cada prueba construye su propia app y su propia instancia del limitador
// (via las fabricas createApiRateLimiter/createAuthRateLimiter), con
// ventanas/maximos bajos exclusivos del test. Esto evita depender de
// PostgreSQL, credenciales reales o el estado del rate limiter global de la
// aplicacion, y garantiza aislamiento total entre pruebas (cada instancia
// tiene su propio MemoryStore, sin compartir contadores).

function buildAppWithApiLimiter(options) {
  const testApp = express();
  // Mismo orden que app.js: /api/health se registra ANTES del limitador y
  // responde sin llamar a next(), por lo que nunca lo atraviesa.
  testApp.get("/api/health", (req, res) => res.status(200).json({ success: true }));
  testApp.use("/api", createApiRateLimiter(options));
  testApp.get("/api/anything", (req, res) => res.status(200).json({ success: true, data: null }));
  return testApp;
}

function buildAppWithAuthLimiter(options) {
  const testApp = express();
  testApp.use(express.json());
  testApp.post("/login", createAuthRateLimiter(options), (req, res) => {
    if (req.body.password === "correct") {
      return res.status(200).json({ success: true, data: { token: "fixture-token" } });
    }
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  });
  return testApp;
}

describe("rate-limit middleware", () => {
  describe("limitador general de la API", () => {
    it("permite solicitudes dentro del limite y expone los headers estandar", async () => {
      const testApp = buildAppWithApiLimiter({ windowMs: 60000, max: 3 });

      const response = await request(testApp).get("/api/anything");

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty("ratelimit-limit");
      expect(response.headers).toHaveProperty("ratelimit-remaining");
    });

    it("responde 429 con el envelope estandar al superar el limite, sin stack ni detalles internos", async () => {
      const testApp = buildAppWithApiLimiter({ windowMs: 60000, max: 2 });

      await request(testApp).get("/api/anything");
      await request(testApp).get("/api/anything");
      const blocked = await request(testApp).get("/api/anything");

      expect(blocked.status).toBe(429);
      expect(blocked.body.success).toBe(false);
      expect(typeof blocked.body.message).toBe("string");
      expect(blocked.body).not.toHaveProperty("stack");
      expect(blocked.headers).toHaveProperty("retry-after");
    });

    it("nunca bloquea /api/health, incluso con el limite general ya agotado en otra ruta", async () => {
      const testApp = buildAppWithApiLimiter({ windowMs: 60000, max: 1 });

      await request(testApp).get("/api/anything");
      await request(testApp).get("/api/anything");

      const health = await request(testApp).get("/api/health");
      expect(health.status).toBe(200);
    });

    it("no limita el endpoint de salud de la aplicacion real ante multiples solicitudes", async () => {
      const responses = await Promise.all(
        Array.from({ length: 20 }, () => request(app).get("/api/health")),
      );

      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
  });

  describe("limitador estricto de login", () => {
    it("bloquea tras el numero configurado de intentos fallidos", async () => {
      const testApp = buildAppWithAuthLimiter({ windowMs: 60000, max: 2 });
      const attempt = () =>
        request(testApp).post("/login").send({ email: "a@test.local", password: "wrong" });

      expect((await attempt()).status).toBe(401);
      expect((await attempt()).status).toBe(401);
      expect((await attempt()).status).toBe(429);
    });

    it("no cuenta logins exitosos contra el limite (skipSuccessfulRequests)", async () => {
      const testApp = buildAppWithAuthLimiter({ windowMs: 60000, max: 2 });

      for (let i = 0; i < 5; i += 1) {
        const response = await request(testApp)
          .post("/login")
          .send({ email: "a@test.local", password: "correct" });

        expect(response.status).toBe(200);
      }
    });

    it("el 429 nunca revela si la cuenta existe, ni expone passwordHash o stack", async () => {
      const existingAccountApp = buildAppWithAuthLimiter({ windowMs: 60000, max: 1 });
      await request(existingAccountApp)
        .post("/login")
        .send({ email: "existe@test.local", password: "wrong" });
      const blockedExisting = await request(existingAccountApp)
        .post("/login")
        .send({ email: "existe@test.local", password: "wrong" });

      const missingAccountApp = buildAppWithAuthLimiter({ windowMs: 60000, max: 1 });
      await request(missingAccountApp)
        .post("/login")
        .send({ email: "no-existe@test.local", password: "wrong" });
      const blockedMissing = await request(missingAccountApp)
        .post("/login")
        .send({ email: "no-existe@test.local", password: "wrong" });

      expect(blockedExisting.status).toBe(429);
      expect(blockedMissing.status).toBe(429);
      expect(blockedExisting.body.message).toBe(blockedMissing.body.message);
      expect(blockedExisting.body).not.toHaveProperty("stack");

      const serialized = `${JSON.stringify(blockedExisting.body)} ${JSON.stringify(blockedMissing.body)}`;
      expect(serialized).not.toMatch(/passwordHash/i);
      expect(serialized).not.toMatch(/existe@test\.local|no-existe@test\.local/);
    });
  });

  describe("aislamiento entre pruebas", () => {
    it("cada instancia del limitador tiene su propio conteo, sin heredar el de otra", async () => {
      const firstApp = buildAppWithApiLimiter({ windowMs: 60000, max: 1 });
      await request(firstApp).get("/api/anything");
      const blockedOnFirst = await request(firstApp).get("/api/anything");
      expect(blockedOnFirst.status).toBe(429);

      const secondApp = buildAppWithApiLimiter({ windowMs: 60000, max: 1 });
      const allowedOnSecond = await request(secondApp).get("/api/anything");
      expect(allowedOnSecond.status).toBe(200);
    });
  });
});
