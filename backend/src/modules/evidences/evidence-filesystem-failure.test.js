import fs from "node:fs/promises";
import path from "node:path";

import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import app from "../../app.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import * as serializableTransactionModule from "../../utils/serializable-transaction.js";
import { getEvidenceFilePath, getQuarantineFilePath } from "../../utils/evidence-file.js";
import { getMinimalJpegBuffer } from "../../tests/fixtures/file-fixtures.js";

async function listEvidenceDirFiles() {
  const entries = await fs.readdir(path.resolve(env.uploadDir), {
    withFileTypes: true,
  });

  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

// Estas pruebas simulan errores REALES de filesystem/DB (no alcanzables de
// forma determinista con carreras HTTP) mediante spies puntuales sobre
// fs/promises, prisma.maintenance.delete y runSerializableTransaction. El
// spy se restaura siempre en afterEach, incluso si una asercion falla antes
// de llegar al mockRestore() explicito de cada prueba.

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const adminPassword = getRequiredEnv("SEED_ADMIN_PASSWORD");
const ADMIN_EMAIL = "admin@nodekeeper.local";

async function loginAsAdmin() {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: ADMIN_EMAIL, password: adminPassword });

  return response.body.data.token;
}

const createdMaintenanceIds = [];
const createdNodeIds = [];

let adminToken;
let networkNodeId;

beforeAll(async () => {
  adminToken = await loginAsAdmin();

  const nodeResponse = await request(app)
    .post("/api/network-nodes")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: `ND-EVFAIL-QA-${Date.now()}`,
      name: "Nodo Fallos FS Evidencias",
      status: "AVAILABLE",
    });

  networkNodeId = nodeResponse.body.data.networkNode.id;
  createdNodeIds.push(networkNodeId);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  for (const maintenanceId of createdMaintenanceIds) {
    await request(app)
      .delete(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`);
  }

  if (createdNodeIds.length > 0) {
    await prisma.networkNode.deleteMany({
      where: { id: { in: createdNodeIds } },
    });
  }
});

async function createInProgressMaintenance() {
  const createResponse = await request(app)
    .post("/api/maintenances")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: `Mantenimiento Fallos FS QA ${Date.now()}-${Math.random()}`,
      type: "PREVENTIVE",
      networkNodeId,
    });

  const maintenanceId = createResponse.body.data.maintenance.id;
  createdMaintenanceIds.push(maintenanceId);

  await request(app)
    .post(`/api/maintenances/${maintenanceId}/start`)
    .set("Authorization", `Bearer ${adminToken}`);

  return maintenanceId;
}

async function uploadEvidence(maintenanceId) {
  const response = await request(app)
    .post(`/api/maintenances/${maintenanceId}/evidences`)
    .set("Authorization", `Bearer ${adminToken}`)
    .attach("file", getMinimalJpegBuffer(), {
      filename: "photo.jpg",
      contentType: "image/jpeg",
    });

  return response.body.data.evidence;
}

describe("Evidence filesystem/DB failure compensation", () => {
  it("a DB failure right after the file is written and validated removes the physical file", async () => {
    const maintenanceId = await createInProgressMaintenance();

    vi.spyOn(
      serializableTransactionModule,
      "runSerializableTransaction",
    ).mockRejectedValueOnce(new Error("Simulated DB failure"));

    const filesBefore = await listEvidenceDirFiles();

    const response = await request(app)
      .post(`/api/maintenances/${maintenanceId}/evidences`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", getMinimalJpegBuffer(), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);

    vi.restoreAllMocks();

    const persisted = await prisma.evidence.findMany({
      where: { maintenanceId },
    });
    expect(persisted.length).toBe(0);

    const filesAfter = await listEvidenceDirFiles();
    expect(filesAfter.length).toBe(filesBefore.length);
  });

  it("a real filesystem error moving to quarantine leaves the DB untouched (evidence)", async () => {
    const maintenanceId = await createInProgressMaintenance();
    const evidence = await uploadEvidence(maintenanceId);

    vi.spyOn(fs, "rename").mockRejectedValueOnce(
      Object.assign(new Error("Simulated EACCES"), { code: "EACCES" }),
    );

    const response = await request(app)
      .delete(`/api/maintenances/${maintenanceId}/evidences/${evidence.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body).not.toHaveProperty("stack");

    vi.restoreAllMocks();

    const persisted = await prisma.evidence.findUnique({
      where: { id: evidence.id },
    });
    expect(persisted).not.toBeNull();
    await expect(
      fs.access(getEvidenceFilePath(persisted.storedName)),
    ).resolves.toBeUndefined();
  });

  it("a DB failure after moving to quarantine restores the physical file (evidence)", async () => {
    const maintenanceId = await createInProgressMaintenance();
    const evidence = await uploadEvidence(maintenanceId);

    vi.spyOn(
      serializableTransactionModule,
      "runSerializableTransaction",
    ).mockRejectedValueOnce(new Error("Simulated DB failure"));

    const response = await request(app)
      .delete(`/api/maintenances/${maintenanceId}/evidences/${evidence.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);

    vi.restoreAllMocks();

    const persisted = await prisma.evidence.findUnique({
      where: { id: evidence.id },
    });
    expect(persisted).not.toBeNull();
    await expect(
      fs.access(getEvidenceFilePath(persisted.storedName)),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(getQuarantineFilePath(persisted.storedName)),
    ).rejects.toThrow();
  });

  it("a real filesystem error deleting a maintenance aborts before touching the DB", async () => {
    const maintenanceId = await createInProgressMaintenance();
    await uploadEvidence(maintenanceId);

    vi.spyOn(fs, "rename").mockRejectedValueOnce(
      Object.assign(new Error("Simulated EACCES"), { code: "EACCES" }),
    );

    const response = await request(app)
      .delete(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);

    vi.restoreAllMocks();

    const persisted = await prisma.maintenance.findUnique({
      where: { id: maintenanceId },
    });
    expect(persisted).not.toBeNull();

    const evidences = await prisma.evidence.findMany({
      where: { maintenanceId },
    });
    expect(evidences.length).toBe(1);
    await expect(
      fs.access(getEvidenceFilePath(evidences[0].storedName)),
    ).resolves.toBeUndefined();
  });

  it("a DB failure deleting a maintenance restores every moved evidence file", async () => {
    const maintenanceId = await createInProgressMaintenance();
    await uploadEvidence(maintenanceId);
    await uploadEvidence(maintenanceId);

    vi.spyOn(prisma.maintenance, "delete").mockRejectedValueOnce(
      new Error("Simulated DB failure"),
    );

    const response = await request(app)
      .delete(`/api/maintenances/${maintenanceId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(500);

    vi.restoreAllMocks();

    const persisted = await prisma.maintenance.findUnique({
      where: { id: maintenanceId },
    });
    expect(persisted).not.toBeNull();

    const evidences = await prisma.evidence.findMany({
      where: { maintenanceId },
    });
    expect(evidences.length).toBe(2);

    for (const evidence of evidences) {
      await expect(
        fs.access(getEvidenceFilePath(evidence.storedName)),
      ).resolves.toBeUndefined();
      await expect(
        fs.access(getQuarantineFilePath(evidence.storedName)),
      ).rejects.toThrow();
    }
  });
});
