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

async function loginAs(email, password) {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  return response.body.data.token;
}

const createdEquipmentIds = [];
const createdNodeIds = [];
const createdProviderIds = [];

let adminToken;
let networkNodeId;
let supportProviderId;

beforeAll(async () => {
  adminToken = await loginAs("admin@nodekeeper.local", adminPassword);

  const nodeResponse = await request(app)
    .post("/api/network-nodes")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: `ND-EQ-QA-${Date.now()}`,
      name: "Nodo para Pruebas de Equipo",
      status: "AVAILABLE",
    });

  networkNodeId = nodeResponse.body.data.networkNode.id;
  createdNodeIds.push(networkNodeId);

  const providerResponse = await request(app)
    .post("/api/support-providers")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      companyName: "Proveedor para Pruebas de Equipo",
      supportPhone: "8000-0004",
      supportEmail: "soporte@proveedorequipoqa.local",
      contactName: "Contacto Equipo",
      contactPhone: "8000-0005",
      contactEmail: "contacto@proveedorequipoqa.local",
    });

  supportProviderId = providerResponse.body.data.supportProvider.id;
  createdProviderIds.push(supportProviderId);
});

afterAll(async () => {
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

  if (createdProviderIds.length > 0) {
    await prisma.supportProvider.deleteMany({
      where: { id: { in: createdProviderIds } },
    });
  }
});

describe("Equipment routes", () => {
  it("lists equipment", async () => {
    const response = await request(app)
      .get("/api/equipment")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.equipment)).toBe(true);
    expect(response.body.data.equipment.length).toBeGreaterThan(0);
  });

  it("creates equipment with a support provider as ADMIN", async () => {
    const response = await request(app)
      .post("/api/equipment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Equipo de Prueba Con Proveedor",
        category: "Router",
        serialNumber: `EQ-QA-${Date.now()}`,
        status: "OPERATIONAL",
        networkNodeId,
        supportProviderId,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.equipment.supportProviderId).toBe(supportProviderId);
    expect(response.body.data.equipment.supportProvider).not.toBeNull();

    createdEquipmentIds.push(response.body.data.equipment.id);
  });

  it("creates equipment without a support provider as ADMIN", async () => {
    const response = await request(app)
      .post("/api/equipment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Equipo de Prueba Sin Proveedor",
        category: "Switch",
        serialNumber: `EQ-QA-NOPROV-${Date.now()}`,
        status: "OPERATIONAL",
        networkNodeId,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.equipment.supportProviderId).toBeNull();
    expect(response.body.data.equipment.supportProvider).toBeNull();

    createdEquipmentIds.push(response.body.data.equipment.id);
  });

  it("rejects creating equipment as OPERATOR", async () => {
    const operatorToken = await loginAs(
      "operador@nodekeeper.local",
      operatorPassword,
    );

    const response = await request(app)
      .post("/api/equipment")
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({
        name: "Equipo No Autorizado",
        category: "Router",
        networkNodeId,
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("gets equipment detail with networkNode and supportProvider", async () => {
    const createResponse = await request(app)
      .post("/api/equipment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Equipo de Prueba Detalle",
        category: "UPS",
        serialNumber: `EQ-QA-DETAIL-${Date.now()}`,
        status: "OPERATIONAL",
        networkNodeId,
        supportProviderId,
      });

    const equipmentId = createResponse.body.data.equipment.id;
    createdEquipmentIds.push(equipmentId);

    const response = await request(app)
      .get(`/api/equipment/${equipmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.equipment.id).toBe(equipmentId);
    expect(response.body.data.equipment.networkNode.id).toBe(networkNodeId);
    expect(response.body.data.equipment.supportProvider.id).toBe(
      supportProviderId,
    );
  });
});
