import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../app.js";
import { prisma } from "../../config/prisma.js";

// Estas pruebas dependen de los usuarios creados por el seed del proyecto
// (prisma/seed.js) y de las variables de entorno SEED_ADMIN_PASSWORD /
// SEED_OPERATOR_PASSWORD, igual que maintenance.test.js.
function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const adminPassword = getRequiredEnv("SEED_ADMIN_PASSWORD");
const operatorPassword = getRequiredEnv("SEED_OPERATOR_PASSWORD");

const ADMIN_EMAIL = "admin@nodekeeper.local";
const OPERATOR_EMAIL = "operador@nodekeeper.local";

async function loginAs(email, password) {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  return response.body.data.token;
}

const createdMaintenanceIds = [];
const createdNodeIds = [];

let adminToken;
let operatorToken;
let networkNodeId;

function checklistUrl(maintenanceId) {
  return `/api/maintenances/${maintenanceId}/checklist-tasks`;
}

async function createScheduledMaintenance(overrides = {}) {
  const response = await request(app)
    .post("/api/maintenances")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: `Mantenimiento Checklist QA ${Date.now()}-${Math.random()}`,
      description: "Prueba automatizada de checklist",
      type: "PREVENTIVE",
      networkNodeId,
      ...overrides,
    });

  const id = response.body?.data?.maintenance?.id;

  if (id) {
    createdMaintenanceIds.push(id);
  }

  return id;
}

async function startMaintenance(maintenanceId, token = adminToken) {
  return request(app)
    .post(`/api/maintenances/${maintenanceId}/start`)
    .set("Authorization", `Bearer ${token}`);
}

async function completeMaintenance(maintenanceId, token = adminToken) {
  return request(app)
    .post(`/api/maintenances/${maintenanceId}/complete`)
    .set("Authorization", `Bearer ${token}`);
}

async function createInProgressMaintenance(overrides = {}) {
  const maintenanceId = await createScheduledMaintenance(overrides);
  await startMaintenance(maintenanceId);
  return maintenanceId;
}

async function createCompletedMaintenanceWithTask() {
  const maintenanceId = await createScheduledMaintenance();

  const task = await prisma.checklistTask.create({
    data: {
      maintenanceId,
      description: "Tarea ya completada",
      isCompleted: true,
      completedAt: new Date(),
      sortOrder: 0,
    },
  });

  await startMaintenance(maintenanceId);
  await completeMaintenance(maintenanceId);

  return { maintenanceId, taskId: task.id };
}

async function createTaskViaApi(maintenanceId, overrides = {}) {
  const response = await request(app)
    .post(checklistUrl(maintenanceId))
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ description: "Verificar alimentacion electrica", ...overrides });

  return response;
}

beforeAll(async () => {
  adminToken = await loginAs(ADMIN_EMAIL, adminPassword);
  operatorToken = await loginAs(OPERATOR_EMAIL, operatorPassword);

  const nodeResponse = await request(app)
    .post("/api/network-nodes")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: `ND-CHK-QA-${Date.now()}`,
      name: "Nodo para Pruebas de Checklist",
      status: "AVAILABLE",
    });

  networkNodeId = nodeResponse.body.data.networkNode.id;
  createdNodeIds.push(networkNodeId);
});

afterAll(async () => {
  // Los ChecklistTask se eliminan en cascada al borrar el Maintenance.
  if (createdMaintenanceIds.length > 0) {
    await prisma.maintenance.deleteMany({
      where: { id: { in: createdMaintenanceIds } },
    });
  }

  if (createdNodeIds.length > 0) {
    await prisma.networkNode.deleteMany({
      where: { id: { in: createdNodeIds } },
    });
  }
});

describe("Checklist task routes", () => {
  describe("autenticacion y roles", () => {
    it("rejects listing without a token", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const response = await request(app).get(checklistUrl(maintenanceId));

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("rejects creating a task as OPERATOR", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const response = await request(app)
        .post(checklistUrl(maintenanceId))
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ description: "Tarea no autorizada" });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("rejects updating a task as OPERATOR", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      const response = await request(app)
        .put(`${checklistUrl(maintenanceId)}/${taskId}`)
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ description: "Intento no autorizado", sortOrder: 0 });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("rejects deleting a task as OPERATOR", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      const response = await request(app)
        .delete(`${checklistUrl(maintenanceId)}/${taskId}`)
        .set("Authorization", `Bearer ${operatorToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("allows OPERATOR to change task status while the maintenance is in progress", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ isCompleted: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("listado", () => {
    it("allows ADMIN to list checklist tasks", async () => {
      const maintenanceId = await createScheduledMaintenance();
      await createTaskViaApi(maintenanceId);

      const response = await request(app)
        .get(checklistUrl(maintenanceId))
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.checklistTasks)).toBe(true);
      expect(response.body.data.checklistTasks.length).toBe(1);
    });

    it("allows OPERATOR to list checklist tasks", async () => {
      const maintenanceId = await createScheduledMaintenance();
      await createTaskViaApi(maintenanceId);

      const response = await request(app)
        .get(checklistUrl(maintenanceId))
        .set("Authorization", `Bearer ${operatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("returns 404 when the maintenance does not exist", async () => {
      const response = await request(app)
        .get(checklistUrl("nonexistent-maintenance-id"))
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("orders checklist tasks by sortOrder ascending", async () => {
      const maintenanceId = await createScheduledMaintenance();
      await createTaskViaApi(maintenanceId, {
        description: "Tarea con orden 2",
        sortOrder: 2,
      });
      await createTaskViaApi(maintenanceId, {
        description: "Tarea con orden 1",
        sortOrder: 1,
      });

      const response = await request(app)
        .get(checklistUrl(maintenanceId))
        .set("Authorization", `Bearer ${adminToken}`);

      const descriptions = response.body.data.checklistTasks.map(
        (task) => task.description,
      );
      expect(descriptions).toEqual(["Tarea con orden 1", "Tarea con orden 2"]);
    });

    it("breaks sortOrder ties by createdAt ascending", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const first = await createTaskViaApi(maintenanceId, {
        description: "Primera tarea creada",
        sortOrder: 5,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = await createTaskViaApi(maintenanceId, {
        description: "Segunda tarea creada",
        sortOrder: 5,
      });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);

      const response = await request(app)
        .get(checklistUrl(maintenanceId))
        .set("Authorization", `Bearer ${adminToken}`);

      const descriptions = response.body.data.checklistTasks.map(
        (task) => task.description,
      );
      expect(descriptions).toEqual([
        "Primera tarea creada",
        "Segunda tarea creada",
      ]);
    });

    it("does not expose passwordHash on completedBy", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);
      await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: true });

      const response = await request(app)
        .get(checklistUrl(maintenanceId))
        .set("Authorization", `Bearer ${adminToken}`);

      const task = response.body.data.checklistTasks.find(
        (item) => item.id === taskId,
      );
      expect(task.completedBy).not.toBeNull();
      expect(task.completedBy).not.toHaveProperty("passwordHash");
      expect(Object.keys(task.completedBy).sort()).toEqual(
        ["email", "id", "name", "role"].sort(),
      );
    });
  });

  describe("creacion", () => {
    it("creates a task as ADMIN while SCHEDULED", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const response = await createTaskViaApi(maintenanceId, {
        description: "Verificar alimentacion electrica",
        sortOrder: 3,
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.checklistTask.description).toBe(
        "Verificar alimentacion electrica",
      );
      expect(response.body.data.checklistTask.sortOrder).toBe(3);
    });

    it("initializes a new task with isCompleted false, completedAt null and completedById null", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const response = await createTaskViaApi(maintenanceId);

      expect(response.status).toBe(201);
      expect(response.body.data.checklistTask.isCompleted).toBe(false);
      expect(response.body.data.checklistTask.completedAt).toBeNull();
      expect(response.body.data.checklistTask.completedById).toBeNull();
      expect(response.body.data.checklistTask.completedBy).toBeNull();
    });

    it("returns 400 (not 500) when description is empty", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const response = await createTaskViaApi(maintenanceId, {
        description: "",
      });

      expect(response.status).toBe(400);
      expect(response.status).not.toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body).not.toHaveProperty("stack");
    });

    it("returns 400 when sortOrder is a decimal", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const response = await createTaskViaApi(maintenanceId, {
        sortOrder: 1.5,
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("returns 400 when sortOrder is a string", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const response = await createTaskViaApi(maintenanceId, {
        sortOrder: "1",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("returns 404 when the maintenance does not exist", async () => {
      const response = await createTaskViaApi("nonexistent-maintenance-id");

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 409 when creating a task on an IN_PROGRESS maintenance", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const response = await createTaskViaApi(maintenanceId);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("returns 409 when creating a task on a COMPLETED maintenance", async () => {
      const { maintenanceId } = await createCompletedMaintenanceWithTask();

      const response = await createTaskViaApi(maintenanceId);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });

  describe("edicion", () => {
    it("allows ADMIN to edit description and sortOrder while SCHEDULED", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      const response = await request(app)
        .put(`${checklistUrl(maintenanceId)}/${taskId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ description: "Descripcion actualizada", sortOrder: 7 });

      expect(response.status).toBe(200);
      expect(response.body.data.checklistTask.description).toBe(
        "Descripcion actualizada",
      );
      expect(response.body.data.checklistTask.sortOrder).toBe(7);
    });

    it("returns 404 when the task does not exist", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const response = await request(app)
        .put(`${checklistUrl(maintenanceId)}/nonexistent-task-id`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ description: "Descripcion", sortOrder: 0 });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 404 when the task belongs to another maintenance", async () => {
      const maintenanceAId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceAId);
      const taskId = createResponse.body.data.checklistTask.id;

      const maintenanceBId = await createScheduledMaintenance();

      const response = await request(app)
        .put(`${checklistUrl(maintenanceBId)}/${taskId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ description: "Descripcion", sortOrder: 0 });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 409 when editing a task on an IN_PROGRESS maintenance", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);

      const response = await request(app)
        .put(`${checklistUrl(maintenanceId)}/${taskId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ description: "Descripcion", sortOrder: 0 });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("returns 409 when editing a task on a COMPLETED maintenance", async () => {
      const { maintenanceId, taskId } = await createCompletedMaintenanceWithTask();

      const response = await request(app)
        .put(`${checklistUrl(maintenanceId)}/${taskId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ description: "Descripcion", sortOrder: 0 });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });

  describe("estado", () => {
    it("returns 409 when changing status on a SCHEDULED maintenance", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: true });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("marks a task as completed while IN_PROGRESS", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: true });

      expect(response.status).toBe(200);
      expect(response.body.data.checklistTask.isCompleted).toBe(true);
      expect(response.body.data.checklistTask.completedAt).not.toBeNull();
      expect(response.body.data.checklistTask.completedBy.email).toBe(
        ADMIN_EMAIL,
      );
    });

    it("records the OPERATOR as completedBy when marking a task as completed", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ isCompleted: true });

      expect(response.status).toBe(200);
      expect(response.body.data.checklistTask.completedBy.email).toBe(
        OPERATOR_EMAIL,
      );
    });

    it("clears completedAt and completedById when marking a task as pending", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);
      await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: true });

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: false });

      expect(response.status).toBe(200);
      expect(response.body.data.checklistTask.isCompleted).toBe(false);
      expect(response.body.data.checklistTask.completedAt).toBeNull();
      expect(response.body.data.checklistTask.completedById).toBeNull();
    });

    it("is idempotent when repeating isCompleted true and preserves the original completedAt/completedById", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);

      const firstResponse = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: true });

      const originalCompletedAt = firstResponse.body.data.checklistTask.completedAt;
      const originalCompletedById =
        firstResponse.body.data.checklistTask.completedById;

      const secondResponse = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({ isCompleted: true });

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.data.checklistTask.isCompleted).toBe(true);
      expect(secondResponse.body.data.checklistTask.completedAt).toBe(
        originalCompletedAt,
      );
      expect(secondResponse.body.data.checklistTask.completedById).toBe(
        originalCompletedById,
      );
    });

    it("is idempotent when repeating isCompleted false on a pending task", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: false });

      expect(response.status).toBe(200);
      expect(response.body.data.checklistTask.isCompleted).toBe(false);
      expect(response.body.data.checklistTask.completedAt).toBeNull();
      expect(response.body.data.checklistTask.completedById).toBeNull();
    });

    it("returns 404 when the task does not exist", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/nonexistent-task-id/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: true });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 404 when the task belongs to another maintenance", async () => {
      const maintenanceAId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceAId);
      const taskId = createResponse.body.data.checklistTask.id;

      const maintenanceBId = await createInProgressMaintenance();

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceBId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: true });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 409 when changing status on a COMPLETED maintenance", async () => {
      const { maintenanceId, taskId } = await createCompletedMaintenanceWithTask();

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: false });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("returns 400 when isCompleted is missing", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("returns 400 when isCompleted is the string \"true\"", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: "true" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("eliminacion", () => {
    it("allows ADMIN to delete a task while SCHEDULED", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      const response = await request(app)
        .delete(`${checklistUrl(maintenanceId)}/${taskId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();

      const persisted = await prisma.checklistTask.findUnique({
        where: { id: taskId },
      });
      expect(persisted).toBeNull();
    });

    it("returns 404 when the task does not exist", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const response = await request(app)
        .delete(`${checklistUrl(maintenanceId)}/nonexistent-task-id`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 404 when the task belongs to another maintenance", async () => {
      const maintenanceAId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceAId);
      const taskId = createResponse.body.data.checklistTask.id;

      const maintenanceBId = await createScheduledMaintenance();

      const response = await request(app)
        .delete(`${checklistUrl(maintenanceBId)}/${taskId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 409 when deleting a task on an IN_PROGRESS maintenance", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);

      const response = await request(app)
        .delete(`${checklistUrl(maintenanceId)}/${taskId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("returns 409 when deleting a task on a COMPLETED maintenance", async () => {
      const { maintenanceId, taskId } = await createCompletedMaintenanceWithTask();

      const response = await request(app)
        .delete(`${checklistUrl(maintenanceId)}/${taskId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });

  describe("integracion con maintenance", () => {
    it("prevents completing an IN_PROGRESS maintenance with a pending task", async () => {
      const maintenanceId = await createScheduledMaintenance();
      await createTaskViaApi(maintenanceId);

      await startMaintenance(maintenanceId);

      const response = await completeMaintenance(maintenanceId);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("allows completing the maintenance after the task is completed", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);
      await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: true });

      const response = await completeMaintenance(maintenanceId);

      expect(response.status).toBe(200);
      expect(response.body.data.maintenance.status).toBe("COMPLETED");
    });

    it("does not allow reopening a task once the maintenance is COMPLETED", async () => {
      const { maintenanceId, taskId } = await createCompletedMaintenanceWithTask();

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: false });

      expect(response.status).toBe(409);

      const persisted = await prisma.checklistTask.findUnique({
        where: { id: taskId },
      });
      expect(persisted.isCompleted).toBe(true);
    });

    it("deletes ChecklistTask records by cascade when the Maintenance is deleted", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await request(app)
        .delete(`/api/maintenances/${maintenanceId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      const persisted = await prisma.checklistTask.findUnique({
        where: { id: taskId },
      });
      expect(persisted).toBeNull();
    });
  });

  describe("aislamiento entre mantenimientos", () => {
    it("does not include tasks from maintenance A when listing maintenance B", async () => {
      const maintenanceAId = await createScheduledMaintenance();
      await createTaskViaApi(maintenanceAId, { description: "Tarea de A" });

      const maintenanceBId = await createScheduledMaintenance();

      const response = await request(app)
        .get(checklistUrl(maintenanceBId))
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.checklistTasks).toEqual([]);
    });

    it("cannot update a task from A using maintenance B in the route", async () => {
      const maintenanceAId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceAId);
      const taskId = createResponse.body.data.checklistTask.id;

      const maintenanceBId = await createScheduledMaintenance();

      const response = await request(app)
        .put(`${checklistUrl(maintenanceBId)}/${taskId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ description: "Intento cruzado", sortOrder: 0 });

      expect(response.status).toBe(404);
    });

    it("cannot delete a task from A using maintenance B in the route", async () => {
      const maintenanceAId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceAId);
      const taskId = createResponse.body.data.checklistTask.id;

      const maintenanceBId = await createScheduledMaintenance();

      const response = await request(app)
        .delete(`${checklistUrl(maintenanceBId)}/${taskId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it("cannot change the status of a task from A using maintenance B in the route", async () => {
      const maintenanceAId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceAId);
      const taskId = createResponse.body.data.checklistTask.id;

      const maintenanceBId = await createInProgressMaintenance();

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceBId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: true });

      expect(response.status).toBe(404);
    });
  });

  describe("idempotencia y concurrencia", () => {
    it("resolves two concurrent isCompleted true requests into a single coherent completed state", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);

      const [first, second] = await Promise.all([
        request(app)
          .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ isCompleted: true }),
        request(app)
          .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
          .set("Authorization", `Bearer ${operatorToken}`)
          .send({ isCompleted: true }),
      ]);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const persisted = await prisma.checklistTask.findUnique({
        where: { id: taskId },
      });
      expect(persisted.isCompleted).toBe(true);
      expect(persisted.completedAt).not.toBeNull();
      expect(persisted.completedById).not.toBeNull();
    });
  });

  describe("atomicidad bajo concurrencia (TOCTOU)", () => {
    it("create concurrente con start: nunca 500, y el resultado persistido es coherente con la respuesta", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const [createResponse, startResponse] = await Promise.all([
        createTaskViaApi(maintenanceId),
        startMaintenance(maintenanceId),
      ]);

      expect(createResponse.status).not.toBe(500);
      expect(startResponse.status).not.toBe(500);
      expect(startResponse.status).toBe(200);
      expect([201, 409]).toContain(createResponse.status);

      const persistedTasks = await prisma.checklistTask.findMany({
        where: { maintenanceId },
      });

      // Nunca debe quedar una tarea creada sin que la respuesta lo refleje:
      // si create gano (201) debe existir exactamente 1 tarea persistida; si
      // perdio (409) no debe existir ninguna.
      expect(persistedTasks.length).toBe(
        createResponse.status === 201 ? 1 : 0,
      );
    });

    it("update concurrente con start: si start gana, update responde 409 y la estructura no cambia", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId, {
        description: "Descripcion original",
        sortOrder: 1,
      });
      const taskId = createResponse.body.data.checklistTask.id;

      const [updateResponse, startResponse] = await Promise.all([
        request(app)
          .put(`${checklistUrl(maintenanceId)}/${taskId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ description: "Descripcion concurrente", sortOrder: 9 }),
        startMaintenance(maintenanceId),
      ]);

      expect(updateResponse.status).not.toBe(500);
      expect(startResponse.status).not.toBe(500);
      expect(startResponse.status).toBe(200);
      expect([200, 409]).toContain(updateResponse.status);

      const persisted = await prisma.checklistTask.findUnique({
        where: { id: taskId },
      });

      if (updateResponse.status === 200) {
        expect(persisted.description).toBe("Descripcion concurrente");
        expect(persisted.sortOrder).toBe(9);
      } else {
        // start gano: la tarea nunca debe haberse modificado despues del
        // inicio del mantenimiento.
        expect(persisted.description).toBe("Descripcion original");
        expect(persisted.sortOrder).toBe(1);
      }
    });

    it("delete concurrente con start: si start gana, delete responde 409 y la tarea sigue existiendo", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      const [deleteResponse, startResponse] = await Promise.all([
        request(app)
          .delete(`${checklistUrl(maintenanceId)}/${taskId}`)
          .set("Authorization", `Bearer ${adminToken}`),
        startMaintenance(maintenanceId),
      ]);

      expect(deleteResponse.status).not.toBe(500);
      expect(startResponse.status).not.toBe(500);
      expect(startResponse.status).toBe(200);
      expect([200, 409]).toContain(deleteResponse.status);

      const persisted = await prisma.checklistTask.findUnique({
        where: { id: taskId },
      });

      if (deleteResponse.status === 200) {
        expect(persisted).toBeNull();
      } else {
        // start gano: la tarea nunca debe haberse eliminado despues del
        // inicio del mantenimiento.
        expect(persisted).not.toBeNull();
      }
    });

    it("PATCH status concurrente con complete: la tarea nunca cambia despues de que el mantenimiento queda COMPLETED", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);
      await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: true });

      // Con el checklist completo (0 pendientes), complete() puede cerrar el
      // mantenimiento. Concurrentemente, se intenta reabrir la unica tarea.
      const [statusResponse, completeResponse] = await Promise.all([
        request(app)
          .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ isCompleted: false }),
        completeMaintenance(maintenanceId),
      ]);

      expect(statusResponse.status).not.toBe(500);
      expect(completeResponse.status).not.toBe(500);
      expect([200, 409]).toContain(statusResponse.status);
      expect([200, 409]).toContain(completeResponse.status);

      const persistedMaintenance = await prisma.maintenance.findUnique({
        where: { id: maintenanceId },
      });
      const persistedTask = await prisma.checklistTask.findUnique({
        where: { id: taskId },
      });

      if (persistedMaintenance.status === "COMPLETED") {
        // Invariante critica: si el mantenimiento quedo COMPLETED, la tarea
        // debe seguir completada. Nunca debe quedar COMPLETED con una tarea
        // reabierta por una carrera.
        expect(persistedTask.isCompleted).toBe(true);
        expect(persistedTask.completedAt).not.toBeNull();
        expect(persistedTask.completedById).not.toBeNull();
      } else {
        // La reapertura gano: el mantenimiento no debe haberse podido
        // completar con la tarea pendiente.
        expect(persistedMaintenance.status).toBe("IN_PROGRESS");
        expect(persistedTask.isCompleted).toBe(false);
      }
    });
  });

  describe("campos prohibidos (Zod estricto)", () => {
    it("returns 400 when POST includes isCompleted", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const response = await createTaskViaApi(maintenanceId, {
        isCompleted: true,
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      const persistedTasks = await prisma.checklistTask.findMany({
        where: { maintenanceId },
      });
      expect(persistedTasks.length).toBe(0);
    });

    it("returns 400 when POST includes completedAt", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const response = await createTaskViaApi(maintenanceId, {
        completedAt: "2020-01-01T00:00:00.000Z",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("returns 400 when PUT includes completedById", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      const response = await request(app)
        .put(`${checklistUrl(maintenanceId)}/${taskId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          description: "Descripcion",
          sortOrder: 0,
          completedById: "someone-else",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      const persisted = await prisma.checklistTask.findUnique({
        where: { id: taskId },
      });
      expect(persisted.completedById).toBeNull();
    });

    it("returns 400 when PATCH status includes additional fields", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const createResponse = await createTaskViaApi(maintenanceId);
      const taskId = createResponse.body.data.checklistTask.id;

      await startMaintenance(maintenanceId);

      const response = await request(app)
        .patch(`${checklistUrl(maintenanceId)}/${taskId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isCompleted: true, completedById: "someone-else" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      const persisted = await prisma.checklistTask.findUnique({
        where: { id: taskId },
      });
      expect(persisted.isCompleted).toBe(false);
    });
  });
});
