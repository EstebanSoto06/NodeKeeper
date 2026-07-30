import fs from "node:fs/promises";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../app.js";
import { prisma } from "../../config/prisma.js";
import { getEvidenceFilePath } from "../../utils/evidence-file.js";
import { getMinimalJpegBuffer } from "../../tests/fixtures/file-fixtures.js";

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
const createdMaintenanceIds = [];

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
  // Los mantenimientos creados en las pruebas de preservacion de historial
  // deben eliminarse ANTES que su equipo/nodo: con la foreign key ahora en
  // ON DELETE RESTRICT, el equipo/nodo no puede eliminarse mientras el
  // mantenimiento exista. Se elimina via la API (no prisma directo) para que
  // tambien se limpien los archivos fisicos de evidencia asociados.
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

describe("Preservacion de historial al eliminar equipos", () => {
  async function createEquipmentForHistoryTests() {
    const response = await request(app)
      .post("/api/equipment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Equipo para Historial de Mantenimiento",
        category: "Router",
        serialNumber: `EQ-HIST-QA-${Date.now()}-${Math.random()}`,
        status: "OPERATIONAL",
        networkNodeId,
      });

    const id = response.body.data.equipment.id;
    createdEquipmentIds.push(id);
    return id;
  }

  async function createCorrectiveMaintenance(equipmentId) {
    const response = await request(app)
      .post("/api/maintenances")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: `Mantenimiento Correctivo Historial QA ${Date.now()}`,
        description: "Prueba de preservacion de historial",
        type: "CORRECTIVE",
        equipmentId,
      });

    const id = response.body.data.maintenance.id;
    createdMaintenanceIds.push(id);
    return id;
  }

  it("rejects deleting equipment with maintenance history and preserves the maintenance, checklist, evidence and physical file", async () => {
    const equipmentId = await createEquipmentForHistoryTests();
    const maintenanceId = await createCorrectiveMaintenance(equipmentId);

    // El checklist solo puede crearse mientras el mantenimiento esta
    // SCHEDULED; recien despues se inicia (IN_PROGRESS) para poder subir la
    // evidencia, que exige ese estado.
    const checklistResponse = await request(app)
      .post(`/api/maintenances/${maintenanceId}/checklist-tasks`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ description: "Tarea de prueba", sortOrder: 1 });

    await request(app)
      .post(`/api/maintenances/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${adminToken}`);

    const uploadResponse = await request(app)
      .post(`/api/maintenances/${maintenanceId}/evidences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", getMinimalJpegBuffer(), {
        filename: "historial.jpg",
        contentType: "image/jpeg",
      });
    const evidenceId = uploadResponse.body.data.evidence.id;
    const storedName = (
      await prisma.evidence.findUnique({ where: { id: evidenceId } })
    ).storedName;

    const deleteResponse = await request(app)
      .delete(`/api/equipment/${equipmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteResponse.status).toBe(409);
    expect(deleteResponse.body.success).toBe(false);

    const equipmentStillExists = await prisma.equipment.findUnique({
      where: { id: equipmentId },
    });
    expect(equipmentStillExists).not.toBeNull();

    const maintenanceStillExists = await prisma.maintenance.findUnique({
      where: { id: maintenanceId },
    });
    expect(maintenanceStillExists).not.toBeNull();

    const checklistTaskStillExists = await prisma.checklistTask.findUnique({
      where: { id: checklistResponse.body.data.checklistTask.id },
    });
    expect(checklistTaskStillExists).not.toBeNull();

    const evidenceStillExists = await prisma.evidence.findUnique({
      where: { id: evidenceId },
    });
    expect(evidenceStillExists).not.toBeNull();

    await expect(fs.access(getEvidenceFilePath(storedName))).resolves.not.toThrow();
  });

  it("allows deleting equipment that has no maintenance history", async () => {
    const equipmentId = await createEquipmentForHistoryTests();

    const response = await request(app)
      .delete(`/api/equipment/${equipmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const stillExists = await prisma.equipment.findUnique({
      where: { id: equipmentId },
    });
    expect(stillExists).toBeNull();
  });

  it("rejects a direct database deletion of equipment with maintenance history at the foreign key level", async () => {
    const equipmentId = await createEquipmentForHistoryTests();
    await createCorrectiveMaintenance(equipmentId);

    // Se prueba la restriccion en si misma, sin pasar por el service: la
    // comprobacion previa del service mejora el mensaje, pero la defensa
    // definitiva contra una carrera es esta foreign key ON DELETE RESTRICT.
    await expect(
      prisma.equipment.delete({ where: { id: equipmentId } }),
    ).rejects.toMatchObject({ code: "P2003" });

    const stillExists = await prisma.equipment.findUnique({
      where: { id: equipmentId },
    });
    expect(stillExists).not.toBeNull();
  });

  it("never returns 500 when a maintenance is created concurrently with an equipment deletion", async () => {
    const equipmentId = await createEquipmentForHistoryTests();

    const [createResponse, deleteResponse] = await Promise.all([
      request(app)
        .post("/api/maintenances")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: `Mantenimiento Concurrente QA ${Date.now()}`,
          type: "CORRECTIVE",
          equipmentId,
        }),
      request(app)
        .delete(`/api/equipment/${equipmentId}`)
        .set("Authorization", `Bearer ${adminToken}`),
    ]);

    if (createResponse.body?.data?.maintenance?.id) {
      createdMaintenanceIds.push(createResponse.body.data.maintenance.id);
    }

    expect(createResponse.status).not.toBe(500);
    expect(deleteResponse.status).not.toBe(500);

    const equipmentStillExists = await prisma.equipment.findUnique({
      where: { id: equipmentId },
    });

    if (createResponse.status === 201) {
      // La creacion gano la carrera: el equipo debe conservarse y el
      // mantenimiento debe apuntar a un equipo que realmente existe.
      expect(equipmentStillExists).not.toBeNull();
      expect(deleteResponse.status).toBe(409);
    } else if (deleteResponse.status === 200) {
      // La eliminacion gano la carrera: el equipo ya no existe y la
      // creacion del mantenimiento debio rechazarse (404, el equipo ya no
      // estaba disponible) en vez de crear un mantenimiento huerfano.
      expect(equipmentStillExists).toBeNull();
      expect(createResponse.status).not.toBe(201);
    }
  });
});
