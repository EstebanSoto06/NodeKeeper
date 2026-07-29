import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../../app.js";
import { prisma } from "../../config/prisma.js";

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const adminPassword = getRequiredEnv("SEED_ADMIN_PASSWORD");
const operatorPassword = getRequiredEnv("SEED_OPERATOR_PASSWORD");

async function loginAs(email, password) {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  return response.body.data.token;
}

const createdUserIds = [];

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@nodekeeper.local`;
}

async function createTestUser(token, overrides = {}) {
  const response = await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Test User",
      email: uniqueEmail("user-mgmt-test"),
      password: "Password123!",
      role: "OPERATOR",
      ...overrides,
    });

  if (response.body?.data?.user?.id) {
    createdUserIds.push(response.body.data.user.id);
  }

  return response;
}

describe("User management routes", () => {
  it("rejects listing without a token", async () => {
    const response = await request(app).get("/api/users");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("rejects OPERATOR from listing users", async () => {
    const token = await loginAs("operador@nodekeeper.local", operatorPassword);

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("rejects OPERATOR from creating a user", async () => {
    const token = await loginAs("operador@nodekeeper.local", operatorPassword);

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X", email: uniqueEmail("blocked"), password: "Password123!" });

    expect(response.status).toBe(403);
  });

  it("lists users as ADMIN without exposing passwordHash", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.users)).toBe(true);
    expect(response.body.data.users.length).toBeGreaterThan(0);
    response.body.data.users.forEach((u) => {
      expect(u.passwordHash).toBeUndefined();
    });
  });

  it("creates a user as ADMIN and returns it without passwordHash", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);

    const response = await createTestUser(token);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.role).toBe("OPERATOR");
    expect(response.body.data.user.isActive).toBe(true);
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  it("retrieves a user by id", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);
    const created = await createTestUser(token);
    const id = created.body.data.user.id;

    const response = await request(app)
      .get(`/api/users/${id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe(id);
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  it("returns 404 for a non-existent user", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);

    const response = await request(app)
      .get("/api/users/does-not-exist")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it("rejects duplicate email on creation", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);
    const created = await createTestUser(token);

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Another Name",
        email: created.body.data.user.email,
        password: "Password123!",
      });

    expect(response.status).toBe(409);
  });

  it("rejects an invalid role on creation", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Bad Role",
        email: uniqueEmail("bad-role"),
        password: "Password123!",
        role: "SUPERADMIN",
      });

    expect(response.status).toBe(400);
    expect(response.body.errors?.length).toBeGreaterThan(0);
  });

  it("rejects a weak password on creation", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Weak Password",
        email: uniqueEmail("weak-pw"),
        password: "123",
      });

    expect(response.status).toBe(400);
  });

  it("edits a user's name, email and role", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);
    const created = await createTestUser(token);
    const id = created.body.data.user.id;

    const response = await request(app)
      .patch(`/api/users/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Edited Name", email: created.body.data.user.email, role: "ADMIN" });

    expect(response.status).toBe(200);
    expect(response.body.data.user.name).toBe("Edited Name");
    expect(response.body.data.user.role).toBe("ADMIN");
  });

  it("activates and deactivates a user", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);
    const created = await createTestUser(token);
    const id = created.body.data.user.id;

    const deactivate = await request(app)
      .patch(`/api/users/${id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.user.isActive).toBe(false);

    const reactivate = await request(app)
      .patch(`/api/users/${id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: true });

    expect(reactivate.status).toBe(200);
    expect(reactivate.body.data.user.isActive).toBe(true);
  });

  it("resets a user's password without exposing the hash", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);
    const created = await createTestUser(token);
    const id = created.body.data.user.id;
    const newEmail = created.body.data.user.email;

    const response = await request(app)
      .patch(`/api/users/${id}/password`)
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "BrandNewPassword123!" });

    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();

    const loginWithNewPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: newEmail, password: "BrandNewPassword123!" });

    expect(loginWithNewPassword.status).toBe(200);
  });

  it("prevents an admin from deactivating their own account", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    const selfId = me.body.data.user.id;

    const response = await request(app)
      .patch(`/api/users/${selfId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    expect(response.status).toBe(403);
  });

  it("prevents demoting the last active administrator (self-demotion)", async () => {
    // La regla del "ultimo administrador" solo puede dispararse de forma
    // alcanzable por la API en el caso de auto-degradacion: cualquier otra
    // ruta exige que quien ejecuta la peticion YA sea un admin activo, por
    // lo que ese propio actor siempre cuenta como "otro admin activo" al
    // modificar a alguien distinto de si mismo. Por eso esta prueba crea un
    // admin de prueba, desactiva (via Prisma, fuera de la API) a todos los
    // demas admins activos, inicia sesion COMO el admin de prueba, y
    // confirma que intentar quitarse a si mismo el rol ADMIN es rechazado.
    const adminToken = await loginAs("admin@nodekeeper.local", adminPassword);
    const created = await createTestUser(adminToken, { role: "ADMIN" });
    const testAdminId = created.body.data.user.id;
    const testAdminEmail = created.body.data.user.email;

    const otherActiveAdmins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true, id: { not: testAdminId } },
      select: { id: true },
    });
    await prisma.user.updateMany({
      where: { id: { in: otherActiveAdmins.map((u) => u.id) } },
      data: { isActive: false },
    });

    try {
      const testAdminToken = await loginAs(testAdminEmail, "Password123!");

      const response = await request(app)
        .patch(`/api/users/${testAdminId}`)
        .set("Authorization", `Bearer ${testAdminToken}`)
        .send({ name: "Test User", email: testAdminEmail, role: "OPERATOR" });

      expect(response.status).toBe(409);
    } finally {
      // Restaura los administradores originales para no afectar otras
      // pruebas de este archivo o de otros modulos que dependan de ellos.
      await prisma.user.updateMany({
        where: { id: { in: otherActiveAdmins.map((u) => u.id) } },
        data: { isActive: true },
      });
    }
  });
});
