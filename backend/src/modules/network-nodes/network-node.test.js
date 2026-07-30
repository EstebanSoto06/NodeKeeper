import fs from "node:fs/promises";

import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../../app.js";
import { prisma } from "../../config/prisma.js";
import { getEvidenceFilePath } from "../../utils/evidence-file.js";
import { getMinimalJpegBuffer } from "../../tests/fixtures/file-fixtures.js";
import { isForeignKeyConstraintError } from "../../utils/foreign-key-error.js";

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

const createdNodeIds = [];
const createdEquipmentIds = [];
const createdMaintenanceIds = [];

afterAll(async () => {
  const adminToken = await loginAs("admin@nodekeeper.local", adminPassword);

  // Orden de limpieza: mantenimientos (via API, para tambien liberar
  // archivos de evidencia) -> equipos -> nodos. Con la foreign key ahora en
  // ON DELETE RESTRICT, un nodo/equipo con mantenimiento asociado no puede
  // eliminarse mientras el mantenimiento siga existiendo.
  for (const maintenanceId of createdMaintenanceIds) {
    await request(app)
      .delete(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`);
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
});

describe("Network node routes", () => {
  it("lists network nodes", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);

    const response = await request(app)
      .get("/api/network-nodes")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.networkNodes)).toBe(true);
    expect(response.body.data.networkNodes.length).toBeGreaterThan(0);
  });

  it("creates a network node as ADMIN", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);
    const code = `ND-QA-${Date.now()}`;

    const response = await request(app)
      .post("/api/network-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        code,
        name: "Nodo de Prueba QA",
        location: "Zona de Prueba",
        latitude: 10.5,
        longitude: -84.5,
        status: "AVAILABLE",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.networkNode.code).toBe(code);

    createdNodeIds.push(response.body.data.networkNode.id);
  });

  it("rejects creating a network node as OPERATOR", async () => {
    const token = await loginAs("operador@nodekeeper.local", operatorPassword);
    const code = `ND-QA-REJECT-${Date.now()}`;

    const response = await request(app)
      .post("/api/network-nodes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        code,
        name: "Nodo No Autorizado",
        status: "AVAILABLE",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("gets network node map data with only georeferenced nodes", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);

    const response = await request(app)
      .get("/api/network-nodes/map")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.networkNodes)).toBe(true);
    expect(response.body.data.networkNodes.length).toBeGreaterThan(0);

    for (const node of response.body.data.networkNodes) {
      expect(node.latitude).not.toBeNull();
      expect(node.longitude).not.toBeNull();
      expect(node).toHaveProperty("id");
      expect(node).toHaveProperty("code");
      expect(node).toHaveProperty("name");
      expect(node).toHaveProperty("location");
      expect(node).toHaveProperty("status");
    }
  });
});

describe("Preservacion de historial al eliminar nodos", () => {
  async function createNodeForHistoryTests() {
    const adminToken = await loginAs("admin@nodekeeper.local", adminPassword);

    const response = await request(app)
      .post("/api/network-nodes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `ND-HIST-QA-${Date.now()}-${Math.random()}`,
        name: "Nodo para Historial de Mantenimiento",
        status: "AVAILABLE",
      });

    const id = response.body.data.networkNode.id;
    createdNodeIds.push(id);
    return { id, adminToken };
  }

  async function createEquipmentFor(networkNodeId, adminToken) {
    const response = await request(app)
      .post("/api/equipment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Equipo para Historial de Nodo",
        category: "Switch",
        serialNumber: `EQ-NODE-HIST-QA-${Date.now()}-${Math.random()}`,
        status: "OPERATIONAL",
        networkNodeId,
      });

    const id = response.body.data.equipment.id;
    createdEquipmentIds.push(id);
    return id;
  }

  async function createPreventiveMaintenance(networkNodeId, adminToken) {
    const response = await request(app)
      .post("/api/maintenances")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: `Mantenimiento Preventivo Historial QA ${Date.now()}`,
        type: "PREVENTIVE",
        networkNodeId,
      });

    const id = response.body.data.maintenance.id;
    createdMaintenanceIds.push(id);
    return id;
  }

  async function createCorrectiveMaintenance(equipmentId, adminToken) {
    const response = await request(app)
      .post("/api/maintenances")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: `Mantenimiento Correctivo Historial QA ${Date.now()}`,
        type: "CORRECTIVE",
        equipmentId,
      });

    const id = response.body.data.maintenance.id;
    createdMaintenanceIds.push(id);
    return id;
  }

  it("rejects deleting a node with a direct preventive maintenance, preserving node, maintenance, evidence and physical file", async () => {
    const { id: networkNodeId, adminToken } = await createNodeForHistoryTests();
    const maintenanceId = await createPreventiveMaintenance(networkNodeId, adminToken);

    await request(app)
      .post(`/api/maintenances/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${adminToken}`);

    const uploadResponse = await request(app)
      .post(`/api/maintenances/${maintenanceId}/evidences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", getMinimalJpegBuffer(), {
        filename: "nodo-directo.jpg",
        contentType: "image/jpeg",
      });
    const evidenceId = uploadResponse.body.data.evidence.id;
    const storedName = (
      await prisma.evidence.findUnique({ where: { id: evidenceId } })
    ).storedName;

    const deleteResponse = await request(app)
      .delete(`/api/network-nodes/${networkNodeId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteResponse.status).toBe(409);
    expect(deleteResponse.body.success).toBe(false);

    expect(
      await prisma.networkNode.findUnique({ where: { id: networkNodeId } }),
    ).not.toBeNull();
    expect(
      await prisma.maintenance.findUnique({ where: { id: maintenanceId } }),
    ).not.toBeNull();
    expect(
      await prisma.evidence.findUnique({ where: { id: evidenceId } }),
    ).not.toBeNull();
    await expect(fs.access(getEvidenceFilePath(storedName))).resolves.not.toThrow();
  });

  it("rejects deleting a node when one of its equipment has corrective maintenance history, preserving node, equipment, maintenance and evidence", async () => {
    const { id: networkNodeId, adminToken } = await createNodeForHistoryTests();
    const equipmentId = await createEquipmentFor(networkNodeId, adminToken);
    const maintenanceId = await createCorrectiveMaintenance(equipmentId, adminToken);

    await request(app)
      .post(`/api/maintenances/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${adminToken}`);

    const uploadResponse = await request(app)
      .post(`/api/maintenances/${maintenanceId}/evidences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", getMinimalJpegBuffer(), {
        filename: "nodo-indirecto.jpg",
        contentType: "image/jpeg",
      });
    const evidenceId = uploadResponse.body.data.evidence.id;

    const deleteResponse = await request(app)
      .delete(`/api/network-nodes/${networkNodeId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteResponse.status).toBe(409);
    expect(deleteResponse.body.success).toBe(false);

    expect(
      await prisma.networkNode.findUnique({ where: { id: networkNodeId } }),
    ).not.toBeNull();
    expect(
      await prisma.equipment.findUnique({ where: { id: equipmentId } }),
    ).not.toBeNull();
    expect(
      await prisma.maintenance.findUnique({ where: { id: maintenanceId } }),
    ).not.toBeNull();
    expect(
      await prisma.evidence.findUnique({ where: { id: evidenceId } }),
    ).not.toBeNull();
  });

  it("keeps deleting a node together with its equipment when none of them has maintenance history", async () => {
    const { id: networkNodeId, adminToken } = await createNodeForHistoryTests();
    const equipmentId = await createEquipmentFor(networkNodeId, adminToken);

    const response = await request(app)
      .delete(`/api/network-nodes/${networkNodeId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(
      await prisma.networkNode.findUnique({ where: { id: networkNodeId } }),
    ).toBeNull();
    expect(
      await prisma.equipment.findUnique({ where: { id: equipmentId } }),
    ).toBeNull();
  });

  it("rejects a direct database deletion of a node with maintenance history at the foreign key level", async () => {
    const { id: networkNodeId, adminToken } = await createNodeForHistoryTests();
    const maintenanceId = await createPreventiveMaintenance(networkNodeId, adminToken);

    // Asercion semantica (isForeignKeyConstraintError), no un codigo literal:
    // con @prisma/adapter-pg esta misma violacion puede llegar como P2003 o
    // como un DriverAdapterError con SQLSTATE 23001/23503.
    let deleteError;
    try {
      await prisma.networkNode.delete({ where: { id: networkNodeId } });
    } catch (error) {
      deleteError = error;
    }

    expect(deleteError).toBeDefined();
    expect(isForeignKeyConstraintError(deleteError)).toBe(true);

    expect(
      await prisma.networkNode.findUnique({ where: { id: networkNodeId } }),
    ).not.toBeNull();
    expect(
      await prisma.maintenance.findUnique({ where: { id: maintenanceId } }),
    ).not.toBeNull();
  });

  it("never returns 500 when a preventive maintenance is created concurrently with a node deletion", async () => {
    const { id: networkNodeId, adminToken } = await createNodeForHistoryTests();

    const [createResponse, deleteResponse] = await Promise.all([
      request(app)
        .post("/api/maintenances")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: `Mantenimiento Concurrente Nodo QA ${Date.now()}`,
          type: "PREVENTIVE",
          networkNodeId,
        }),
      request(app)
        .delete(`/api/network-nodes/${networkNodeId}`)
        .set("Authorization", `Bearer ${adminToken}`),
    ]);

    if (createResponse.body?.data?.maintenance?.id) {
      createdMaintenanceIds.push(createResponse.body.data.maintenance.id);
    }

    expect(createResponse.status).not.toBe(500);
    expect(deleteResponse.status).not.toBe(500);

    const nodeStillExists = await prisma.networkNode.findUnique({
      where: { id: networkNodeId },
    });

    if (createResponse.status === 201) {
      expect(nodeStillExists).not.toBeNull();
      expect(deleteResponse.status).toBe(409);
    } else if (deleteResponse.status === 200) {
      expect(nodeStillExists).toBeNull();
      expect(createResponse.status).not.toBe(201);
    }
  });
});
