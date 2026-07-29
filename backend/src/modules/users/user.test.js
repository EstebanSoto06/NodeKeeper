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

// Aisla el conteo de administradores activos a exactamente los ids dados,
// desactivando temporalmente (via Prisma, fuera de la API) a cualquier otro
// admin activo preexistente (p. ej. el admin sembrado), y restaurandolos al
// terminar. Necesario para que las aserciones de las pruebas de
// concurrencia ("debe quedar exactamente 1 admin activo") sean
// deterministas sin depender de cuantos administradores existan ya en la
// base de datos.
async function withExactlyTheseAdminsActive(keepIds, fn) {
  const others = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true, id: { notIn: keepIds } },
    select: { id: true },
  });
  const otherIds = others.map((u) => u.id);

  if (otherIds.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: otherIds } },
      data: { isActive: false },
    });
  }

  try {
    return await fn();
  } finally {
    if (otherIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: otherIds } },
        data: { isActive: true },
      });
    }
  }
}

describe("Active admin invariant under concurrency", () => {
  it("allows only one of two concurrent mutual role-demotions to succeed, and never leaves zero active admins", async () => {
    // CASO 1: dos administradores activos (y solo ellos dos, mientras dura
    // la prueba) intentan degradarse mutuamente de ADMIN a OPERATOR al mismo
    // tiempo. Sin Serializable, cada peticion podria ver "queda el otro
    // admin activo" y ambas completar, dejando cero administradores; con
    // Serializable, PostgreSQL detecta la dependencia cruzada (write skew) y
    // aborta una de las dos, que runSerializableTransaction reintenta y que
    // en el reintento ve el estado ya actualizado por la otra.
    //
    // La peticion rechazada puede llegar como 409 (bloqueada por la regla de
    // negocio o por reintentos de serializacion agotados) O como 403: si la
    // OTRA peticion ya confirmo y le quito el rol ADMIN al actor de esta,
    // el middleware authenticate() -que relee el usuario en cada peticion-
    // la rechaza como Forbidden antes de llegar a la logica de negocio. Es
    // una capa de defensa adicional legitima, no una falla: en ambos casos
    // la operacion se rechaza y el invariante se conserva.
    const adminToken = await loginAs("admin@nodekeeper.local", adminPassword);
    const createdA = await createTestUser(adminToken, { role: "ADMIN" });
    const createdB = await createTestUser(adminToken, { role: "ADMIN" });
    const a = createdA.body.data.user;
    const b = createdB.body.data.user;

    await withExactlyTheseAdminsActive([a.id, b.id], async () => {
      const tokenA = await loginAs(a.email, "Password123!");
      const tokenB = await loginAs(b.email, "Password123!");

      const [respA, respB] = await Promise.all([
        request(app)
          .patch(`/api/users/${b.id}`)
          .set("Authorization", `Bearer ${tokenA}`)
          .send({ name: b.name, email: b.email, role: "OPERATOR" }),
        request(app)
          .patch(`/api/users/${a.id}`)
          .set("Authorization", `Bearer ${tokenB}`)
          .send({ name: a.name, email: a.email, role: "OPERATOR" }),
      ]);

      const statuses = [respA.status, respB.status];
      const successCount = statuses.filter((s) => s === 200).length;
      const rejectedCount = statuses.filter((s) => s === 403 || s === 409).length;

      expect(successCount).toBe(1);
      expect(rejectedCount).toBe(1);
      statuses.forEach((s) => expect(s).not.toBe(500));

      const activeAdmins = await prisma.user.count({
        where: { role: "ADMIN", isActive: true, id: { in: [a.id, b.id] } },
      });
      expect(activeAdmins).toBe(1);
    });
  });

  it("allows only one of two concurrent operations (role-demote vs deactivate) to succeed when both would zero out active admins, and never returns 500", async () => {
    // CASO 2: un ADMIN intenta degradar al otro (PATCH /users/:id, cambio de
    // rol) mientras el segundo intenta desactivar al primero (PATCH
    // /users/:id/status) al mismo tiempo. Es la misma clase de write skew
    // que el CASO 1, pero cruzando dos operaciones distintas del servicio
    // (updateUser y setUserActive) que comparten la misma verificacion de
    // invariante. Igual que en el CASO 1, la peticion rechazada puede llegar
    // como 409 (negocio o reintentos agotados) o como 403 (si la otra ya le
    // quito el rol ADMIN al actor antes de que su propia peticion pase por
    // authenticate()) -- ambos son desenlaces seguros.
    const adminToken = await loginAs("admin@nodekeeper.local", adminPassword);
    const createdA = await createTestUser(adminToken, { role: "ADMIN" });
    const createdB = await createTestUser(adminToken, { role: "ADMIN" });
    const a = createdA.body.data.user;
    const b = createdB.body.data.user;

    await withExactlyTheseAdminsActive([a.id, b.id], async () => {
      const tokenA = await loginAs(a.email, "Password123!");
      const tokenB = await loginAs(b.email, "Password123!");

      const [demoteB, deactivateA] = await Promise.all([
        request(app)
          .patch(`/api/users/${b.id}`)
          .set("Authorization", `Bearer ${tokenA}`)
          .send({ name: b.name, email: b.email, role: "OPERATOR" }),
        request(app)
          .patch(`/api/users/${a.id}/status`)
          .set("Authorization", `Bearer ${tokenB}`)
          .send({ isActive: false }),
      ]);

      const statuses = [demoteB.status, deactivateA.status];
      const successCount = statuses.filter((s) => s === 200).length;
      const rejectedCount = statuses.filter((s) => s === 403 || s === 409).length;

      statuses.forEach((status) => expect(status).not.toBe(500));
      expect(successCount).toBe(1);
      expect(rejectedCount).toBe(1);

      const remainingActiveAdmins = await prisma.user.count({
        where: { role: "ADMIN", isActive: true, id: { in: [a.id, b.id] } },
      });
      expect(remainingActiveAdmins).toBeGreaterThanOrEqual(1);
    });
  });

  it("still allows two unrelated concurrent updates that do not threaten the invariant", async () => {
    // CASO 3: control negativo. Dos OPERATOR distintos editados al mismo
    // tiempo no tocan en absoluto el predicado role=ADMIN,isActive=true, por
    // lo que no deberian generar ningun conflicto de serializacion ni verse
    // afectados por el cambio de esta fase.
    const adminToken = await loginAs("admin@nodekeeper.local", adminPassword);
    const createdX = await createTestUser(adminToken, { role: "OPERATOR" });
    const createdY = await createTestUser(adminToken, { role: "OPERATOR" });
    const x = createdX.body.data.user;
    const y = createdY.body.data.user;

    const [respX, respY] = await Promise.all([
      request(app)
        .patch(`/api/users/${x.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Operator X Renamed", email: x.email, role: "OPERATOR" }),
      request(app)
        .patch(`/api/users/${y.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Operator Y Renamed", email: y.email, role: "OPERATOR" }),
    ]);

    expect(respX.status).toBe(200);
    expect(respY.status).toBe(200);
    expect(respX.body.data.user.name).toBe("Operator X Renamed");
    expect(respY.body.data.user.name).toBe("Operator Y Renamed");
  });
});
