import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

const ADMIN_EMAIL = "admin@nodekeeper.local";
const OPERATOR_EMAIL = "operador@nodekeeper.local";

async function loginAs(email, password) {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  return response.body.data.token;
}

const createdMaintenanceIds = [];
const createdEquipmentIds = [];
const createdNodeIds = [];
const createdTemplateIds = [];

let adminToken;
let operatorToken;
let networkNodeId;
let equipmentId;

async function createPreventiveMaintenance(overrides = {}) {
  const response = await request(app)
    .post("/api/maintenances")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: `Mantenimiento QA ${Date.now()}`,
      description: "Prueba automatizada de mantenimiento",
      type: "PREVENTIVE",
      networkNodeId,
      ...overrides,
    });

  const id = response.body?.data?.maintenance?.id;

  if (id) {
    createdMaintenanceIds.push(id);
  }

  return response;
}

async function createTemplateFixture(descriptions) {
  const response = await request(app)
    .post("/api/checklist-templates")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `Plantilla Mantenimiento QA ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      items: descriptions.map((description) => ({ description })),
    });

  const id = response.body?.data?.checklistTemplate?.id;

  if (id) {
    createdTemplateIds.push(id);
  }

  return id;
}

beforeAll(async () => {
  adminToken = await loginAs(ADMIN_EMAIL, adminPassword);
  operatorToken = await loginAs(OPERATOR_EMAIL, operatorPassword);

  const nodeResponse = await request(app)
    .post("/api/network-nodes")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: `ND-MTO-QA-${Date.now()}`,
      name: "Nodo para Pruebas de Mantenimiento",
      status: "AVAILABLE",
    });

  networkNodeId = nodeResponse.body.data.networkNode.id;
  createdNodeIds.push(networkNodeId);

  const equipmentResponse = await request(app)
    .post("/api/equipment")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "Equipo para Pruebas de Mantenimiento",
      category: "Router",
      serialNumber: `EQ-MTO-QA-${Date.now()}`,
      status: "OPERATIONAL",
      networkNodeId,
    });

  equipmentId = equipmentResponse.body.data.equipment.id;
  createdEquipmentIds.push(equipmentId);
});

afterAll(async () => {
  if (createdMaintenanceIds.length > 0) {
    await prisma.maintenance.deleteMany({
      where: { id: { in: createdMaintenanceIds } },
    });
  }

  if (createdEquipmentIds.length > 0) {
    await prisma.equipment.deleteMany({
      where: { id: { in: createdEquipmentIds } },
    });
  }

  if (createdNodeIds.length > 0) {
    await prisma.networkNode.deleteMany({
      where: { id: { in: createdNodeIds } },
    });
  }

  if (createdTemplateIds.length > 0) {
    await prisma.checklistTemplate.deleteMany({
      where: { id: { in: createdTemplateIds } },
    });
  }
});

describe("Maintenance routes", () => {
  it("lists maintenances as ADMIN", async () => {
    await createPreventiveMaintenance();

    const response = await request(app)
      .get("/api/maintenances")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.maintenances)).toBe(true);
    expect(response.body.data.maintenances.length).toBeGreaterThan(0);
  });

  it("creates a preventive maintenance as ADMIN", async () => {
    const response = await createPreventiveMaintenance();

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.maintenance.type).toBe("PREVENTIVE");
    expect(response.body.data.maintenance.status).toBe("SCHEDULED");
    expect(response.body.data.maintenance.networkNodeId).toBe(networkNodeId);
    expect(response.body.data.maintenance.equipmentId).toBeNull();
    expect(response.body.data.maintenance.createdBy.email).toBe(ADMIN_EMAIL);
  });

  it("creates a corrective maintenance linked to equipment as ADMIN", async () => {
    const response = await request(app)
      .post("/api/maintenances")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: `Mantenimiento Correctivo QA ${Date.now()}`,
        type: "CORRECTIVE",
        equipmentId,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.maintenance.type).toBe("CORRECTIVE");
    expect(response.body.data.maintenance.equipmentId).toBe(equipmentId);
    expect(response.body.data.maintenance.networkNodeId).toBeNull();

    createdMaintenanceIds.push(response.body.data.maintenance.id);
  });

  it("rejects a preventive maintenance without a network node", async () => {
    const response = await request(app)
      .post("/api/maintenances")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: `Mantenimiento Sin Nodo ${Date.now()}`,
        type: "PREVENTIVE",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("returns a maintenance with all related information", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    const response = await request(app)
      .get(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const maintenance = response.body.data.maintenance;
    expect(maintenance.id).toBe(maintenanceId);
    expect(maintenance).toHaveProperty("networkNode");
    expect(maintenance).toHaveProperty("equipment");
    expect(maintenance).toHaveProperty("createdBy");
    expect(maintenance).toHaveProperty("startedBy");
    expect(maintenance).toHaveProperty("closedBy");
    expect(maintenance).toHaveProperty("checklistTasks");
    expect(maintenance).toHaveProperty("evidences");
    expect(Array.isArray(maintenance.checklistTasks)).toBe(true);
    expect(Array.isArray(maintenance.evidences)).toBe(true);
    expect(maintenance.createdBy).not.toHaveProperty("passwordHash");
  });

  it("updates a maintenance as ADMIN", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    const response = await request(app)
      .put(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Mantenimiento QA Actualizado",
        description: "Descripcion actualizada",
        type: "PREVENTIVE",
        networkNodeId,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.maintenance.title).toBe(
      "Mantenimiento QA Actualizado",
    );
  });

  it("deletes a maintenance as ADMIN", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    const deleteResponse = await request(app)
      .delete(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);

    const getResponse = await request(app)
      .get(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(getResponse.status).toBe(404);
  });

  it("starts a maintenance as ADMIN", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    const response = await request(app)
      .post(`/api/maintenances/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.maintenance.status).toBe("IN_PROGRESS");
    expect(response.body.data.maintenance.startedAt).not.toBeNull();
    expect(response.body.data.maintenance.startedBy.email).toBe(ADMIN_EMAIL);
  });

  it("completes a maintenance when the checklist is complete", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    await prisma.checklistTask.create({
      data: {
        maintenanceId,
        description: "Tarea completada",
        isCompleted: true,
        completedAt: new Date(),
        sortOrder: 1,
      },
    });

    await request(app)
      .post(`/api/maintenances/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${adminToken}`);

    const response = await request(app)
      .post(`/api/maintenances/${maintenanceId}/complete`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.maintenance.status).toBe("COMPLETED");
    expect(response.body.data.maintenance.completedAt).not.toBeNull();
    expect(response.body.data.maintenance.closedBy.email).toBe(ADMIN_EMAIL);
    expect(response.body.data.maintenance.checklistTasks.length).toBe(1);
  });

  it("prevents completing a maintenance with an incomplete checklist", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    await prisma.checklistTask.create({
      data: {
        maintenanceId,
        description: "Tarea pendiente",
        isCompleted: false,
        sortOrder: 1,
      },
    });

    await request(app)
      .post(`/api/maintenances/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${adminToken}`);

    const response = await request(app)
      .post(`/api/maintenances/${maintenanceId}/complete`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("allows OPERATOR to list and view maintenances", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    const listResponse = await request(app)
      .get("/api/maintenances")
      .set("Authorization", `Bearer ${operatorToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);

    const detailResponse = await request(app)
      .get(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${operatorToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.maintenance.id).toBe(maintenanceId);
  });

  it("allows OPERATOR to start and complete a maintenance", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    const startResponse = await request(app)
      .post(`/api/maintenances/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${operatorToken}`);

    expect(startResponse.status).toBe(200);
    expect(startResponse.body.data.maintenance.status).toBe("IN_PROGRESS");
    expect(startResponse.body.data.maintenance.startedBy.email).toBe(
      OPERATOR_EMAIL,
    );

    const completeResponse = await request(app)
      .post(`/api/maintenances/${maintenanceId}/complete`)
      .set("Authorization", `Bearer ${operatorToken}`);

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.data.maintenance.status).toBe("COMPLETED");
    expect(completeResponse.body.data.maintenance.closedBy.email).toBe(
      OPERATOR_EMAIL,
    );
  });

  it("rejects creating a maintenance as OPERATOR", async () => {
    const response = await request(app)
      .post("/api/maintenances")
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({
        title: "Mantenimiento No Autorizado",
        type: "PREVENTIVE",
        networkNodeId,
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("rejects updating a maintenance as OPERATOR", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    const response = await request(app)
      .put(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({
        title: "Intento No Autorizado",
        type: "PREVENTIVE",
        networkNodeId,
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("rejects deleting a maintenance as OPERATOR", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    const response = await request(app)
      .delete(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${operatorToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("returns 400 (not 500) when creating a maintenance with an invalid body", async () => {
    const response = await request(app)
      .post("/api/maintenances")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "", type: "INVALID_TYPE" });

    expect(response.status).toBe(400);
    expect(response.status).not.toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body).not.toHaveProperty("stack");
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  it("returns 400 (not 500) when updating a maintenance with an invalid body", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    const response = await request(app)
      .put(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "" });

    expect(response.status).toBe(400);
    expect(response.status).not.toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body).not.toHaveProperty("stack");
  });

  it("rejects starting a maintenance that is already in progress", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    const firstStart = await request(app)
      .post(`/api/maintenances/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(firstStart.status).toBe(200);
    expect(firstStart.body.data.maintenance.status).toBe("IN_PROGRESS");

    const secondStart = await request(app)
      .post(`/api/maintenances/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(secondStart.status).toBe(409);
    expect(secondStart.body.success).toBe(false);
  });

  it("rejects completing a scheduled maintenance that was never started", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    const response = await request(app)
      .post(`/api/maintenances/${maintenanceId}/complete`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);

    const persisted = await prisma.maintenance.findUnique({
      where: { id: maintenanceId },
    });
    expect(persisted.status).toBe("SCHEDULED");
    expect(persisted.completedAt).toBeNull();
    expect(persisted.closedById).toBeNull();
  });

  it("rejects completing the same maintenance twice", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    await request(app)
      .post(`/api/maintenances/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${adminToken}`);

    const firstComplete = await request(app)
      .post(`/api/maintenances/${maintenanceId}/complete`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(firstComplete.status).toBe(200);
    expect(firstComplete.body.data.maintenance.status).toBe("COMPLETED");

    const secondComplete = await request(app)
      .post(`/api/maintenances/${maintenanceId}/complete`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(secondComplete.status).toBe(409);
    expect(secondComplete.body.success).toBe(false);
  });

  it("allows only one of two concurrent start requests to succeed", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/maintenances/${maintenanceId}/start`)
        .set("Authorization", `Bearer ${adminToken}`),
      request(app)
        .post(`/api/maintenances/${maintenanceId}/start`)
        .set("Authorization", `Bearer ${adminToken}`),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const persisted = await prisma.maintenance.findUnique({
      where: { id: maintenanceId },
    });
    expect(persisted.status).toBe("IN_PROGRESS");
    expect(persisted.startedById).not.toBeNull();
  });

  it("allows only one of two concurrent complete requests to succeed", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    await prisma.checklistTask.create({
      data: {
        maintenanceId,
        description: "Tarea completada",
        isCompleted: true,
        completedAt: new Date(),
        sortOrder: 1,
      },
    });

    await request(app)
      .post(`/api/maintenances/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${adminToken}`);

    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/maintenances/${maintenanceId}/complete`)
        .set("Authorization", `Bearer ${adminToken}`),
      request(app)
        .post(`/api/maintenances/${maintenanceId}/complete`)
        .set("Authorization", `Bearer ${adminToken}`),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const persisted = await prisma.maintenance.findUnique({
      where: { id: maintenanceId },
    });
    expect(persisted.status).toBe("COMPLETED");
    expect(persisted.completedAt).not.toBeNull();
    expect(persisted.closedById).not.toBeNull();
  });

  it("switches a maintenance from PREVENTIVE to CORRECTIVE clearing the node association", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    expect(createResponse.body.data.maintenance.networkNodeId).toBe(networkNodeId);
    expect(createResponse.body.data.maintenance.equipmentId).toBeNull();

    const response = await request(app)
      .put(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Mantenimiento Convertido A Correctivo",
        type: "CORRECTIVE",
        equipmentId,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.maintenance.type).toBe("CORRECTIVE");
    expect(response.body.data.maintenance.equipmentId).toBe(equipmentId);
    expect(response.body.data.maintenance.networkNodeId).toBeNull();
  });

  /* ---------- Ordenes cerradas: PUT bloqueado en la capa de servicio ----------
     El caso SCHEDULED ya lo cubre "updates a maintenance as ADMIN" mas
     arriba (una orden recien creada nace SCHEDULED), por lo que aqui solo se
     agregan los casos que faltaban: IN_PROGRESS, COMPLETED y CANCELLED. */

  const CLOSED_UPDATE_MESSAGE =
    "Only scheduled or in-progress maintenances can be updated";

  // Lleva una orden hasta COMPLETED por el flujo real de la API
  // (checklist completa -> start -> complete), no escribiendo el estado a mano.
  async function createCompletedMaintenance() {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    await prisma.checklistTask.create({
      data: {
        maintenanceId,
        description: "Tarea completada",
        isCompleted: true,
        completedAt: new Date(),
        sortOrder: 1,
      },
    });

    await request(app)
      .post(`/api/maintenances/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${adminToken}`);

    await request(app)
      .post(`/api/maintenances/${maintenanceId}/complete`)
      .set("Authorization", `Bearer ${adminToken}`);

    return maintenanceId;
  }

  // CANCELLED existe en el enum pero no tiene endpoint de transicion (ver
  // maintenance.routes.js), asi que la unica forma de producir ese estado
  // real es escribirlo directamente en la base de datos.
  async function createCancelledMaintenance() {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    await prisma.maintenance.update({
      where: { id: maintenanceId },
      data: { status: "CANCELLED" },
    });

    return maintenanceId;
  }

  function readMaintenance(maintenanceId) {
    return request(app)
      .get(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`);
  }

  it("updates an IN_PROGRESS maintenance as ADMIN", async () => {
    const createResponse = await createPreventiveMaintenance();
    const maintenanceId = createResponse.body.data.maintenance.id;

    await request(app)
      .post(`/api/maintenances/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${adminToken}`);

    const response = await request(app)
      .put(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Mantenimiento QA En Progreso Editado",
        type: "PREVENTIVE",
        networkNodeId,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.maintenance.title).toBe(
      "Mantenimiento QA En Progreso Editado",
    );
    // Editar no altera el estado ni la trazabilidad del inicio.
    expect(response.body.data.maintenance.status).toBe("IN_PROGRESS");
    expect(response.body.data.maintenance.startedAt).not.toBeNull();
  });

  it("rejects updating a COMPLETED maintenance with 409 and leaves it unchanged", async () => {
    const maintenanceId = await createCompletedMaintenance();
    const before = await readMaintenance(maintenanceId);

    const response = await request(app)
      .put(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Intento De Edicion Sobre Orden Cerrada",
        description: "No debe persistir",
        type: "PREVENTIVE",
        networkNodeId,
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(CLOSED_UPDATE_MESSAGE);

    const after = await readMaintenance(maintenanceId);
    expect(after.body.data.maintenance.title).toBe(
      before.body.data.maintenance.title,
    );
    expect(after.body.data.maintenance.description).toBe(
      before.body.data.maintenance.description,
    );
    expect(after.body.data.maintenance.status).toBe("COMPLETED");
    expect(after.body.data.maintenance.completedAt).not.toBeNull();
  });

  it("rejects updating a CANCELLED maintenance with 409 and leaves it unchanged", async () => {
    const maintenanceId = await createCancelledMaintenance();
    const before = await readMaintenance(maintenanceId);

    const response = await request(app)
      .put(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Intento De Edicion Sobre Orden Cancelada",
        type: "PREVENTIVE",
        networkNodeId,
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(CLOSED_UPDATE_MESSAGE);

    const after = await readMaintenance(maintenanceId);
    expect(after.body.data.maintenance.title).toBe(
      before.body.data.maintenance.title,
    );
    expect(after.body.data.maintenance.status).toBe("CANCELLED");
  });

  it("blocks the update of a closed maintenance even for ADMIN, the only role authorized to update", async () => {
    const maintenanceId = await createCompletedMaintenance();
    const body = {
      title: "Edicion No Permitida",
      type: "PREVENTIVE",
      networkNodeId,
    };

    const operatorResponse = await request(app)
      .put(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .send(body);

    const adminResponse = await request(app)
      .put(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(body);

    // OPERATOR ni siquiera pasa la autorizacion de la ruta; ADMIN si la pasa
    // y aun asi la regla de estado lo detiene en la capa de servicio.
    expect(operatorResponse.status).toBe(403);
    expect(adminResponse.status).toBe(409);
    expect(adminResponse.body.message).toBe(CLOSED_UPDATE_MESSAGE);
  });

  it("keeps a closed maintenance intact when the update body is otherwise valid and changes the type", async () => {
    // Cambiar de tipo es la edicion mas destructiva (reasigna nodo/equipo):
    // debe quedar bloqueada igual sobre una orden cerrada.
    const maintenanceId = await createCompletedMaintenance();

    const response = await request(app)
      .put(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Conversion No Permitida",
        type: "CORRECTIVE",
        equipmentId,
      });

    expect(response.status).toBe(409);

    const after = await readMaintenance(maintenanceId);
    expect(after.body.data.maintenance.type).toBe("PREVENTIVE");
    expect(after.body.data.maintenance.networkNodeId).toBe(networkNodeId);
    expect(after.body.data.maintenance.equipmentId).toBeNull();
  });
});

describe("Maintenance creation with a checklist template", () => {
  it("sin checklistTemplateId crea la orden sin tareas (comportamiento actual)", async () => {
    const response = await createPreventiveMaintenance();

    expect(response.status).toBe(201);
    expect(response.body.data.maintenance.checklistTasks).toEqual([]);
  });

  it("con checklistTemplateId null se comporta igual que sin el campo", async () => {
    const response = await createPreventiveMaintenance({ checklistTemplateId: null });

    expect(response.status).toBe(201);
    expect(response.body.data.maintenance.checklistTasks).toEqual([]);
  });

  it("con una plantilla valida devuelve la orden ya con sus tareas copiadas", async () => {
    const templateId = await createTemplateFixture([
      "Revisar voltaje de entrada",
      "Revisar baterias",
      "Registrar lectura final",
    ]);

    const response = await createPreventiveMaintenance({
      checklistTemplateId: templateId,
    });

    expect(response.status).toBe(201);

    const tasks = response.body.data.maintenance.checklistTasks;
    expect(tasks).toHaveLength(3);
    expect(tasks.map((task) => task.description)).toEqual([
      "Revisar voltaje de entrada",
      "Revisar baterias",
      "Registrar lectura final",
    ]);
    expect(tasks.map((task) => task.sortOrder)).toEqual([0, 1, 2]);
    tasks.forEach((task) => expect(task.isCompleted).toBe(false));
  });

  it("funciona igual en un mantenimiento CORRECTIVO: la plantilla es agnostica al tipo", async () => {
    const templateId = await createTemplateFixture(["Diagnosticar falla"]);

    const response = await createPreventiveMaintenance({
      type: "CORRECTIVE",
      networkNodeId: null,
      equipmentId,
      checklistTemplateId: templateId,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.maintenance.checklistTasks).toHaveLength(1);
  });

  it("las tareas copiadas son independientes: editar la plantilla no las cambia", async () => {
    const templateId = await createTemplateFixture(["Texto original"]);
    const created = await createPreventiveMaintenance({
      checklistTemplateId: templateId,
    });
    const maintenanceId = created.body.data.maintenance.id;

    await request(app)
      .put(`/api/checklist-templates/${templateId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Renombrada ${Date.now()}-${Math.random()}`,
        items: [{ description: "Texto MODIFICADO" }],
      });

    const tasks = await prisma.checklistTask.findMany({ where: { maintenanceId } });
    expect(tasks[0].description).toBe("Texto original");
  });

  describe("atomicidad", () => {
    it("con una plantilla inexistente devuelve 404 y NO crea el mantenimiento", async () => {
      const title = `Rollback Plantilla QA ${Date.now()}-${Math.random()}`;

      const response = await request(app)
        .post("/api/maintenances")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title,
          type: "PREVENTIVE",
          networkNodeId,
          checklistTemplateId: "plantilla-inexistente",
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toMatch(/checklist template not found/i);

      // Rollback verificado directamente en base de datos.
      const orphan = await prisma.maintenance.findFirst({ where: { title } });
      expect(orphan).toBeNull();
    });

    it("con un nodo inexistente devuelve 404 y no deja ni orden ni tareas", async () => {
      const title = `Rollback Nodo QA ${Date.now()}-${Math.random()}`;
      const templateId = await createTemplateFixture(["Tarea A", "Tarea B"]);

      const response = await request(app)
        .post("/api/maintenances")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title,
          type: "PREVENTIVE",
          networkNodeId: "nodo-inexistente",
          checklistTemplateId: templateId,
        });

      expect(response.status).toBe(404);

      const orphan = await prisma.maintenance.findFirst({ where: { title } });
      expect(orphan).toBeNull();
    });
  });

  describe("autorizacion y validacion", () => {
    it("un OPERATOR no puede crear un mantenimiento ni con plantilla ni sin ella", async () => {
      const templateId = await createTemplateFixture(["Tarea"]);
      const title = `Operator Plantilla QA ${Date.now()}-${Math.random()}`;

      const response = await request(app)
        .post("/api/maintenances")
        .set("Authorization", `Bearer ${operatorToken}`)
        .send({
          title,
          type: "PREVENTIVE",
          networkNodeId,
          checklistTemplateId: templateId,
        });

      expect(response.status).toBe(403);

      const orphan = await prisma.maintenance.findFirst({ where: { title } });
      expect(orphan).toBeNull();
    });

    it("PUT /maintenances/:id NO aplica plantillas aunque se envie checklistTemplateId", async () => {
      const templateId = await createTemplateFixture(["Tarea que no debe aparecer"]);
      const created = await createPreventiveMaintenance();
      const maintenanceId = created.body.data.maintenance.id;

      const response = await request(app)
        .put(`/api/maintenances/${maintenanceId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Titulo actualizado",
          type: "PREVENTIVE",
          networkNodeId,
          checklistTemplateId: templateId,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.maintenance.checklistTasks).toEqual([]);

      const count = await prisma.checklistTask.count({ where: { maintenanceId } });
      expect(count).toBe(0);
    });
  });

  describe("recurrencia", () => {
    it("cada orden de una serie recibe su PROPIA copia independiente", async () => {
      // La recurrencia del frontend son N POST /maintenances independientes
      // con el mismo payload base (ver utils/recurrence.js): aqui se
      // reproduce ese comportamiento contra la API real.
      const templateId = await createTemplateFixture(["Tarea A", "Tarea B"]);
      const dates = ["2026-09-01", "2026-10-01", "2026-11-01"];

      const responses = [];
      for (const scheduledDate of dates) {
        // eslint-disable-next-line no-await-in-loop
        const response = await createPreventiveMaintenance({
          title: `Serie QA ${Date.now()}-${Math.random()} ${scheduledDate}`,
          scheduledDate,
          checklistTemplateId: templateId,
        });
        responses.push(response);
      }

      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.data.maintenance.checklistTasks).toHaveLength(2);
      });

      // Las tareas de cada orden son filas distintas: ningun id se repite
      // entre ordenes, y ninguna apunta a la plantilla.
      const allTaskIds = responses.flatMap((response) =>
        response.body.data.maintenance.checklistTasks.map((task) => task.id),
      );
      expect(new Set(allTaskIds).size).toBe(6);

      // Eliminar la plantilla no afecta a ninguna de las tres ordenes.
      await request(app)
        .delete(`/api/checklist-templates/${templateId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      const survivingTasks = await prisma.checklistTask.findMany({
        where: { id: { in: allTaskIds } },
      });
      expect(survivingTasks).toHaveLength(6);
    });
  });
});
