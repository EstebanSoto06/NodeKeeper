import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../app.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import {
  getEvidenceFilePath,
  getQuarantineFilePath,
} from "../../utils/evidence-file.js";
import {
  getFakeExecutableBuffer,
  getGenericZipBuffer,
  getMinimalDocxBuffer,
  getMinimalJpegBuffer,
  getMinimalPdfBuffer,
  getMinimalPngBuffer,
} from "../../tests/fixtures/file-fixtures.js";

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

function evidencesUrl(maintenanceId) {
  return `/api/maintenances/${maintenanceId}/evidences`;
}

async function createScheduledMaintenance(overrides = {}) {
  const response = await request(app)
    .post("/api/maintenances")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: `Mantenimiento Evidencias QA ${Date.now()}-${Math.random()}`,
      description: "Prueba automatizada de evidencias",
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

async function startMaintenanceReq(maintenanceId, token = adminToken) {
  return request(app)
    .post(`/api/maintenances/${maintenanceId}/start`)
    .set("Authorization", `Bearer ${token}`);
}

async function completeMaintenanceReq(maintenanceId, token = adminToken) {
  return request(app)
    .post(`/api/maintenances/${maintenanceId}/complete`)
    .set("Authorization", `Bearer ${token}`);
}

async function createInProgressMaintenance(overrides = {}) {
  const id = await createScheduledMaintenance(overrides);
  await startMaintenanceReq(id);
  return id;
}

async function createCompletedMaintenance(overrides = {}) {
  const id = await createInProgressMaintenance(overrides);
  await completeMaintenanceReq(id);
  return id;
}

function uploadEvidenceReq(maintenanceId, token, buffer, filename, mimetype) {
  return request(app)
    .post(evidencesUrl(maintenanceId))
    .set("Authorization", `Bearer ${token}`)
    .attach("file", buffer, { filename, contentType: mimetype });
}

async function uploadValidJpeg(maintenanceId, token = adminToken) {
  return uploadEvidenceReq(
    maintenanceId,
    token,
    getMinimalJpegBuffer(),
    "photo.jpg",
    "image/jpeg",
  );
}

async function directlyCreateEvidence(maintenanceId, overrides = {}) {
  const storedName = overrides.storedName ?? `seed-${crypto.randomUUID()}.jpg`;

  return prisma.evidence.create({
    data: {
      maintenanceId,
      uploadedById: null,
      originalName: "seed.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 10,
      ...overrides,
      storedName,
      relativePath: storedName,
    },
  });
}

async function listEvidenceDirFiles() {
  const entries = await fs.readdir(path.resolve(env.uploadDir), {
    withFileTypes: true,
  });

  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

beforeAll(async () => {
  adminToken = await loginAs(ADMIN_EMAIL, adminPassword);
  operatorToken = await loginAs(OPERATOR_EMAIL, operatorPassword);

  const nodeResponse = await request(app)
    .post("/api/network-nodes")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: `ND-EVIDENCE-QA-${Date.now()}`,
      name: "Nodo para Pruebas de Evidencias",
      status: "AVAILABLE",
    });

  networkNodeId = nodeResponse.body.data.networkNode.id;
  createdNodeIds.push(networkNodeId);
});

afterAll(async () => {
  // Una orden IN_PROGRESS no puede eliminarse (ver deleteMaintenance): las
  // que quedaron en ejecucion se cancelan antes de limpiar.
  if (createdMaintenanceIds.length > 0) {
    await prisma.maintenance.updateMany({
      where: { id: { in: createdMaintenanceIds }, status: "IN_PROGRESS" },
      data: { status: "CANCELLED" },
    });
  }

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

describe("Evidence routes", () => {
  describe("autenticacion y roles", () => {
    it("rejects listing without a token", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const response = await request(app).get(evidencesUrl(maintenanceId));

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("rejects uploading without a token and persists no file", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const before = await listEvidenceDirFiles();

      const response = await request(app)
        .post(evidencesUrl(maintenanceId))
        .attach("file", getMinimalJpegBuffer(), {
          filename: "photo.jpg",
          contentType: "image/jpeg",
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      const after = await listEvidenceDirFiles();
      expect(after.length).toBe(before.length);

      const persisted = await prisma.evidence.findMany({
        where: { maintenanceId },
      });
      expect(persisted.length).toBe(0);
    });

    it("rejects deleting as OPERATOR", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceId);
      const evidenceId = uploadResponse.body.data.evidence.id;

      const response = await request(app)
        .delete(`${evidencesUrl(maintenanceId)}/${evidenceId}`)
        .set("Authorization", `Bearer ${operatorToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("allows ADMIN to upload", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const response = await uploadValidJpeg(maintenanceId, adminToken);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it("allows OPERATOR to upload", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const response = await uploadValidJpeg(maintenanceId, operatorToken);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it("allows ADMIN and OPERATOR to list and download", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceId);
      const evidenceId = uploadResponse.body.data.evidence.id;

      const adminList = await request(app)
        .get(evidencesUrl(maintenanceId))
        .set("Authorization", `Bearer ${adminToken}`);
      const operatorList = await request(app)
        .get(evidencesUrl(maintenanceId))
        .set("Authorization", `Bearer ${operatorToken}`);

      expect(adminList.status).toBe(200);
      expect(operatorList.status).toBe(200);

      const adminDownload = await request(app)
        .get(`${evidencesUrl(maintenanceId)}/${evidenceId}/file`)
        .set("Authorization", `Bearer ${adminToken}`);
      const operatorDownload = await request(app)
        .get(`${evidencesUrl(maintenanceId)}/${evidenceId}/file`)
        .set("Authorization", `Bearer ${operatorToken}`);

      expect(adminDownload.status).toBe(200);
      expect(operatorDownload.status).toBe(200);
    });
  });

  describe("subida", () => {
    it("accepts a real JPG", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const response = await uploadValidJpeg(maintenanceId);

      expect(response.status).toBe(201);
      expect(response.body.data.evidence.mimeType).toBe("image/jpeg");
    });

    it("accepts a real PNG", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const response = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getMinimalPngBuffer(),
        "photo.png",
        "image/png",
      );

      expect(response.status).toBe(201);
      expect(response.body.data.evidence.mimeType).toBe("image/png");
    });

    it("accepts a real PDF", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const response = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getMinimalPdfBuffer(),
        "document.pdf",
        "application/pdf",
      );

      expect(response.status).toBe(201);
      expect(response.body.data.evidence.mimeType).toBe("application/pdf");
    });

    it("accepts a real DOCX", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const response = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getMinimalDocxBuffer(),
        "report.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );

      expect(response.status).toBe(201);
      expect(response.body.data.evidence.mimeType).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
    });

    it("returns correct metadata for the uploaded evidence", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const buffer = getMinimalJpegBuffer();

      const response = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        buffer,
        "metadata-test.jpg",
        "image/jpeg",
      );

      const evidence = response.body.data.evidence;
      expect(evidence.originalName).toBe("metadata-test.jpg");
      expect(evidence.mimeType).toBe("image/jpeg");
      expect(evidence.sizeBytes).toBe(buffer.length);
      expect(evidence.maintenanceId).toBe(maintenanceId);
      expect(new Date(evidence.createdAt).toString()).not.toBe("Invalid Date");
      expect(evidence.uploadedBy.email).toBe(ADMIN_EMAIL);
    });

    it("preserves non-ASCII characters in originalName (UTF-8, not latin1)", async () => {
      // Multer decodifica el filename del multipart como latin1 por defecto:
      // sin defParamCharset "utf8" (ver upload.middleware.js), este nombre se
      // guardaba como "Diagrama sin tÃ­tulo-PÃ¡gina-1.png". Los nombres de
      // archivo en espanol llevan tildes y enes de forma habitual.
      const maintenanceId = await createInProgressMaintenance();
      const filename = "Diagrama sin título-Página-1-año-mañana.png";

      const response = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getMinimalPngBuffer(),
        filename,
        "image/png",
      );

      expect(response.status).toBe(201);
      expect(response.body.data.evidence.originalName).toBe(filename);
      expect(response.body.data.evidence.originalName).not.toContain("Ã");

      // Tambien debe quedar correcto en la base, no solo en la respuesta.
      const stored = await prisma.evidence.findUnique({
        where: { id: response.body.data.evidence.id },
        select: { originalName: true },
      });
      expect(stored.originalName).toBe(filename);

      // Y viajar intacto en el Content-Disposition de la descarga.
      const download = await request(app)
        .get(`${evidencesUrl(maintenanceId)}/${response.body.data.evidence.id}/file`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(download.status).toBe(200);
      expect(download.headers["content-disposition"]).toContain(
        encodeURIComponent(filename),
      );
    });

    it("never exposes storedName or relativePath in the JSON response", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const response = await uploadValidJpeg(maintenanceId);

      const evidence = response.body.data.evidence;
      expect(evidence).not.toHaveProperty("storedName");
      expect(evidence).not.toHaveProperty("relativePath");
    });

    it("returns 400 when the file field is missing", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const response = await request(app)
        .post(evidencesUrl(maintenanceId))
        .set("Authorization", `Bearer ${adminToken}`)
        .field("note", "no file attached");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("returns 400 for an unsupported declared mime type", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const before = await listEvidenceDirFiles();

      const response = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        Buffer.from("plain text content"),
        "note.txt",
        "text/plain",
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      const after = await listEvidenceDirFiles();
      expect(after.length).toBe(before.length);
    });

    it("returns 400 when the declared mime type does not match the real content", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const before = await listEvidenceDirFiles();

      // Contenido real: PNG. Mimetype declarado: PDF (ambos individualmente
      // permitidos, pero incompatibles entre si).
      const response = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getMinimalPngBuffer(),
        "fake.pdf",
        "application/pdf",
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      const after = await listEvidenceDirFiles();
      expect(after.length).toBe(before.length);
    });

    it("returns 400 for a generic ZIP declared as DOCX", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const before = await listEvidenceDirFiles();

      const response = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getGenericZipBuffer(),
        "fake.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      const after = await listEvidenceDirFiles();
      expect(after.length).toBe(before.length);
    });

    it("returns 400 when the file exceeds the maximum allowed size", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const before = await listEvidenceDirFiles();

      const oversizedBuffer = Buffer.concat([
        getMinimalJpegBuffer(),
        Buffer.alloc(env.maxFileSizeMb * 1024 * 1024),
      ]);

      const response = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        oversizedBuffer,
        "big.jpg",
        "image/jpeg",
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      const after = await listEvidenceDirFiles();
      expect(after.length).toBe(before.length);
    }, 20000);

    it("returns 400 when more than one file is sent", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const before = await listEvidenceDirFiles();

      const response = await request(app)
        .post(evidencesUrl(maintenanceId))
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", getMinimalJpegBuffer(), {
          filename: "one.jpg",
          contentType: "image/jpeg",
        })
        .attach("file", getMinimalJpegBuffer(), {
          filename: "two.jpg",
          contentType: "image/jpeg",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      const after = await listEvidenceDirFiles();
      expect(after.length).toBe(before.length);
    });

    it("returns 404 and leaves no physical file when the maintenance does not exist", async () => {
      const before = await listEvidenceDirFiles();

      const response = await uploadEvidenceReq(
        "nonexistent-maintenance-id",
        adminToken,
        getMinimalJpegBuffer(),
        "photo.jpg",
        "image/jpeg",
      );

      expect(response.status).toBe(404);

      const after = await listEvidenceDirFiles();
      expect(after.length).toBe(before.length);
    });

    it("returns 409 and leaves no physical file for a SCHEDULED maintenance", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const before = await listEvidenceDirFiles();

      const response = await uploadValidJpeg(maintenanceId);

      expect(response.status).toBe(409);

      const after = await listEvidenceDirFiles();
      expect(after.length).toBe(before.length);
    });

    it("returns 409 and leaves no physical file for a COMPLETED maintenance", async () => {
      const maintenanceId = await createCompletedMaintenance();
      const before = await listEvidenceDirFiles();

      const response = await uploadValidJpeg(maintenanceId);

      expect(response.status).toBe(409);

      const after = await listEvidenceDirFiles();
      expect(after.length).toBe(before.length);
    });

    it("returns 409 and leaves no physical file once the per-maintenance limit is reached", async () => {
      const maintenanceId = await createInProgressMaintenance();

      for (let i = 0; i < env.maxEvidencesPerMaintenance; i += 1) {
        await directlyCreateEvidence(maintenanceId);
      }

      const before = await listEvidenceDirFiles();

      const response = await uploadValidJpeg(maintenanceId);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);

      const after = await listEvidenceDirFiles();
      expect(after.length).toBe(before.length);
    });
  });

  describe("listado", () => {
    it("orders evidences by createdAt ascending", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const first = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getMinimalJpegBuffer(),
        "first.jpg",
        "image/jpeg",
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getMinimalPngBuffer(),
        "second.png",
        "image/png",
      );

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);

      const response = await request(app)
        .get(evidencesUrl(maintenanceId))
        .set("Authorization", `Bearer ${adminToken}`);

      const names = response.body.data.evidences.map((item) => item.originalName);
      expect(names).toEqual(["first.jpg", "second.png"]);
    });

    it("returns 404 when the maintenance does not exist", async () => {
      const response = await request(app)
        .get(evidencesUrl("nonexistent-maintenance-id"))
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("isolates evidences between maintenances", async () => {
      const maintenanceAId = await createInProgressMaintenance();
      await uploadValidJpeg(maintenanceAId);

      const maintenanceBId = await createInProgressMaintenance();

      const response = await request(app)
        .get(evidencesUrl(maintenanceBId))
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.evidences).toEqual([]);
    });

    it("does not expose passwordHash on uploadedBy", async () => {
      const maintenanceId = await createInProgressMaintenance();
      await uploadValidJpeg(maintenanceId);

      const response = await request(app)
        .get(evidencesUrl(maintenanceId))
        .set("Authorization", `Bearer ${adminToken}`);

      const evidence = response.body.data.evidences[0];
      expect(evidence.uploadedBy).not.toHaveProperty("passwordHash");
      expect(Object.keys(evidence.uploadedBy).sort()).toEqual(
        ["email", "id", "name", "role"].sort(),
      );
    });
  });

  describe("descarga", () => {
    it("returns bytes identical to the uploaded file", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const buffer = getMinimalPdfBuffer();

      const uploadResponse = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        buffer,
        "identical.pdf",
        "application/pdf",
      );
      const evidenceId = uploadResponse.body.data.evidence.id;

      const response = await request(app)
        .get(`${evidencesUrl(maintenanceId)}/${evidenceId}/file`)
        .set("Authorization", `Bearer ${adminToken}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(Buffer.compare(response.body, buffer)).toBe(0);
    });

    it("returns the correct Content-Type", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getMinimalPngBuffer(),
        "photo.png",
        "image/png",
      );
      const evidenceId = uploadResponse.body.data.evidence.id;

      const response = await request(app)
        .get(`${evidencesUrl(maintenanceId)}/${evidenceId}/file`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.headers["content-type"]).toMatch(/^image\/png/);
    });

    it("returns the correct Content-Length", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const buffer = getMinimalDocxBuffer();

      const uploadResponse = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        buffer,
        "report.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      const evidenceId = uploadResponse.body.data.evidence.id;

      const response = await request(app)
        .get(`${evidencesUrl(maintenanceId)}/${evidenceId}/file`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(Number(response.headers["content-length"])).toBe(buffer.length);
    });

    it("uses inline Content-Disposition for JPG, PNG and PDF", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const cases = [
        { buffer: getMinimalJpegBuffer(), filename: "a.jpg", mimetype: "image/jpeg" },
        { buffer: getMinimalPngBuffer(), filename: "b.png", mimetype: "image/png" },
        { buffer: getMinimalPdfBuffer(), filename: "c.pdf", mimetype: "application/pdf" },
      ];

      for (const testCase of cases) {
        const uploadResponse = await uploadEvidenceReq(
          maintenanceId,
          adminToken,
          testCase.buffer,
          testCase.filename,
          testCase.mimetype,
        );
        const evidenceId = uploadResponse.body.data.evidence.id;

        const response = await request(app)
          .get(`${evidencesUrl(maintenanceId)}/${evidenceId}/file`)
          .set("Authorization", `Bearer ${adminToken}`);

        expect(response.headers["content-disposition"]).toMatch(/^inline;/);
      }
    });

    it("uses attachment Content-Disposition for DOCX", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getMinimalDocxBuffer(),
        "report.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      const evidenceId = uploadResponse.body.data.evidence.id;

      const response = await request(app)
        .get(`${evidencesUrl(maintenanceId)}/${evidenceId}/file`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.headers["content-disposition"]).toMatch(/^attachment;/);
    });

    it("returns 404 when the evidence does not exist", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const response = await request(app)
        .get(`${evidencesUrl(maintenanceId)}/nonexistent-evidence-id/file`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it("returns 404 when the evidence belongs to another maintenance", async () => {
      const maintenanceAId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceAId);
      const evidenceId = uploadResponse.body.data.evidence.id;

      const maintenanceBId = await createInProgressMaintenance();

      const response = await request(app)
        .get(`${evidencesUrl(maintenanceBId)}/${evidenceId}/file`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it("returns 404 when the physical file is missing", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const evidence = await directlyCreateEvidence(maintenanceId);

      const response = await request(app)
        .get(`${evidencesUrl(maintenanceId)}/${evidence.id}/file`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it("never exposes storedName as a directly reachable public URL", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceId);
      const evidenceId = uploadResponse.body.data.evidence.id;

      const persisted = await prisma.evidence.findUnique({
        where: { id: evidenceId },
      });

      const response = await request(app).get(
        `/uploads/evidences/${persisted.storedName}`,
      );

      expect(response.status).toBe(404);
    });
  });

  describe("eliminacion", () => {
    it("allows ADMIN to delete an evidence while IN_PROGRESS", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceId);
      const evidenceId = uploadResponse.body.data.evidence.id;

      const response = await request(app)
        .delete(`${evidencesUrl(maintenanceId)}/${evidenceId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });

    it("removes the DB row and the physical file, and purges the quarantine folder", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceId);
      const evidenceId = uploadResponse.body.data.evidence.id;

      const persistedBeforeDelete = await prisma.evidence.findUnique({
        where: { id: evidenceId },
      });
      const storedName = persistedBeforeDelete.storedName;

      await request(app)
        .delete(`${evidencesUrl(maintenanceId)}/${evidenceId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      const persistedAfterDelete = await prisma.evidence.findUnique({
        where: { id: evidenceId },
      });
      expect(persistedAfterDelete).toBeNull();

      await expect(fs.access(getEvidenceFilePath(storedName))).rejects.toThrow();
      await expect(fs.access(getQuarantineFilePath(storedName))).rejects.toThrow();
    });

    it("rejects deleting as OPERATOR without touching the file", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceId);
      const evidenceId = uploadResponse.body.data.evidence.id;

      const response = await request(app)
        .delete(`${evidencesUrl(maintenanceId)}/${evidenceId}`)
        .set("Authorization", `Bearer ${operatorToken}`);

      expect(response.status).toBe(403);

      const persisted = await prisma.evidence.findUnique({
        where: { id: evidenceId },
      });
      expect(persisted).not.toBeNull();
    });

    it("returns 409 when deleting on a SCHEDULED maintenance", async () => {
      const maintenanceId = await createScheduledMaintenance();
      const evidence = await directlyCreateEvidence(maintenanceId);

      const response = await request(app)
        .delete(`${evidencesUrl(maintenanceId)}/${evidence.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(409);

      const persisted = await prisma.evidence.findUnique({
        where: { id: evidence.id },
      });
      expect(persisted).not.toBeNull();
    });

    it("returns 409 when deleting on a COMPLETED maintenance", async () => {
      const maintenanceId = await createCompletedMaintenance();
      const evidence = await directlyCreateEvidence(maintenanceId);

      const response = await request(app)
        .delete(`${evidencesUrl(maintenanceId)}/${evidence.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(409);

      const persisted = await prisma.evidence.findUnique({
        where: { id: evidence.id },
      });
      expect(persisted).not.toBeNull();
    });

    it("returns 404 when the evidence does not exist", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const response = await request(app)
        .delete(`${evidencesUrl(maintenanceId)}/nonexistent-evidence-id`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it("returns 404 when the evidence belongs to another maintenance", async () => {
      const maintenanceAId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceAId);
      const evidenceId = uploadResponse.body.data.evidence.id;

      const maintenanceBId = await createInProgressMaintenance();

      const response = await request(app)
        .delete(`${evidencesUrl(maintenanceBId)}/${evidenceId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);

      const persisted = await prisma.evidence.findUnique({
        where: { id: evidenceId },
      });
      expect(persisted).not.toBeNull();
    });

    it("idempotently removes the row when the physical file is already missing", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const evidence = await directlyCreateEvidence(maintenanceId);

      const response = await request(app)
        .delete(`${evidencesUrl(maintenanceId)}/${evidence.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const persisted = await prisma.evidence.findUnique({
        where: { id: evidence.id },
      });
      expect(persisted).toBeNull();
    });
  });

  describe("eliminacion de mantenimiento", () => {
    it("keeps the current behavior when there are no evidences", async () => {
      const maintenanceId = await createScheduledMaintenance();

      const response = await request(app)
        .delete(`/api/maintenances/${maintenanceId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("deletes the DB row and the physical file with one evidence", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceId);
      const evidenceId = uploadResponse.body.data.evidence.id;
      const persisted = await prisma.evidence.findUnique({
        where: { id: evidenceId },
      });
      const storedName = persisted.storedName;

      // Las evidencias solo se suben con la orden IN_PROGRESS, y una orden
      // IN_PROGRESS ya no puede eliminarse (dejaria su nodo/equipos en
      // MAINTENANCE sin nadie que los liberase, ver deleteMaintenance). El
      // flujo real es cerrarla primero; lo que la prueba verifica -que el
      // borrado arrastra la fila y el archivo fisico- no cambia.
      await completeMaintenanceReq(maintenanceId);

      const response = await request(app)
        .delete(`/api/maintenances/${maintenanceId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      const evidenceAfterDelete = await prisma.evidence.findUnique({
        where: { id: evidenceId },
      });
      expect(evidenceAfterDelete).toBeNull();

      await expect(fs.access(getEvidenceFilePath(storedName))).rejects.toThrow();
      await expect(fs.access(getQuarantineFilePath(storedName))).rejects.toThrow();
    });

    it("deletes every evidence file when there are multiple", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const uploads = await Promise.all([
        uploadEvidenceReq(maintenanceId, adminToken, getMinimalJpegBuffer(), "a.jpg", "image/jpeg"),
        uploadEvidenceReq(maintenanceId, adminToken, getMinimalPngBuffer(), "b.png", "image/png"),
        uploadEvidenceReq(maintenanceId, adminToken, getMinimalPdfBuffer(), "c.pdf", "application/pdf"),
      ]);

      const storedNames = [];
      for (const uploadResponse of uploads) {
        const evidenceId = uploadResponse.body.data.evidence.id;
        const persisted = await prisma.evidence.findUnique({ where: { id: evidenceId } });
        storedNames.push(persisted.storedName);
      }

      await completeMaintenanceReq(maintenanceId);

      const response = await request(app)
        .delete(`/api/maintenances/${maintenanceId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      const remainingEvidences = await prisma.evidence.findMany({
        where: { maintenanceId },
      });
      expect(remainingEvidences.length).toBe(0);

      for (const storedName of storedNames) {
        await expect(fs.access(getEvidenceFilePath(storedName))).rejects.toThrow();
        await expect(fs.access(getQuarantineFilePath(storedName))).rejects.toThrow();
      }
    });

    it("deletes the maintenance even if a physical file is already missing", async () => {
      const maintenanceId = await createInProgressMaintenance();
      await directlyCreateEvidence(maintenanceId);
      await completeMaintenanceReq(maintenanceId);

      const response = await request(app)
        .delete(`/api/maintenances/${maintenanceId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      const persisted = await prisma.maintenance.findUnique({
        where: { id: maintenanceId },
      });
      expect(persisted).toBeNull();
    });

    it("does not leave orphaned files behind in the evidences directory", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceId);
      const evidenceId = uploadResponse.body.data.evidence.id;
      const persisted = await prisma.evidence.findUnique({
        where: { id: evidenceId },
      });
      const storedName = persisted.storedName;

      const filesBefore = await listEvidenceDirFiles();
      expect(filesBefore).toContain(storedName);

      await completeMaintenanceReq(maintenanceId);

      await request(app)
        .delete(`/api/maintenances/${maintenanceId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      const filesAfter = await listEvidenceDirFiles();
      expect(filesAfter).not.toContain(storedName);
    });
  });

  describe("concurrencia", () => {
    it("uploading concurrently with complete never leaves an evidence persisted once COMPLETED", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const [uploadResponse, completeResponse] = await Promise.all([
        uploadValidJpeg(maintenanceId),
        completeMaintenanceReq(maintenanceId),
      ]);

      expect(uploadResponse.status).not.toBe(500);
      expect(completeResponse.status).not.toBe(500);
      // Bajo contencion real de Postgres, "complete" tambien puede perder la
      // carrera de serializacion (reintentos agotados -> 409), igual que ya
      // se acepta en checklist-task.test.js: no se asume cual lado gana, se
      // verifica el invariante sobre el estado final persistido.
      expect([200, 409]).toContain(completeResponse.status);
      expect([201, 409]).toContain(uploadResponse.status);

      const persistedMaintenance = await prisma.maintenance.findUnique({
        where: { id: maintenanceId },
      });
      const persistedEvidences = await prisma.evidence.findMany({
        where: { maintenanceId },
      });

      if (persistedMaintenance.status === "COMPLETED") {
        expect(persistedEvidences.length).toBe(
          uploadResponse.status === 201 ? 1 : 0,
        );
      }
    });

    // completeMaintenance y deleteEvidence comparten la misma dependencia de
    // escritura sobre Maintenance (ambos hacen un UPDATE condicionado por
    // status="IN_PROGRESS", ver los comentarios en maintenance.service.js y
    // evidence.service.js), por lo que Postgres Serializable linealiza esta
    // carrera en exactamente uno de dos ordenes validos — nunca deja un
    // resultado no serializable:
    //
    //   Orden A (delete se linealiza antes que complete): el delete ve
    //   IN_PROGRESS, borra la evidencia; complete corre despues, ve
    //   IN_PROGRESS todavia (el delete no cambio el status) y completa sin
    //   problema. Resultado: delete=200, complete=200, Maintenance
    //   COMPLETED, evidencia AUSENTE. Esto es valido: "COMPLETED" no implica
    //   que la evidencia deba seguir existiendo, solo que ninguna
    //   eliminacion ocurrio DESPUES de COMPLETED.
    //
    //   Orden B (complete se linealiza antes que delete): complete pasa a
    //   COMPLETED primero; el delete corre despues, ya no encuentra el
    //   status IN_PROGRESS y se rechaza con 409. Resultado: delete=409,
    //   complete=200, Maintenance COMPLETED, evidencia PRESENTE.
    //
    // La prueba anterior asumia que "Maintenance COMPLETED" por si solo
    // implicaba "evidencia debe existir", lo cual es incorrecto para el
    // Orden A. La invariante real se verifica por el status de la propia
    // respuesta de delete, no por el estado final de Maintenance.
    it("a delete that loses the race to completion never removes the evidence (and one that wins never leaves it after COMPLETED)", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceId);
      const evidenceId = uploadResponse.body.data.evidence.id;
      const storedName = (
        await prisma.evidence.findUnique({ where: { id: evidenceId } })
      ).storedName;

      const [deleteResponse, completeResponse] = await Promise.all([
        request(app)
          .delete(`${evidencesUrl(maintenanceId)}/${evidenceId}`)
          .set("Authorization", `Bearer ${adminToken}`),
        completeMaintenanceReq(maintenanceId),
      ]);

      expect(deleteResponse.status).not.toBe(500);
      expect(completeResponse.status).not.toBe(500);
      expect([200, 404, 409]).toContain(deleteResponse.status);

      const persistedEvidence = await prisma.evidence.findUnique({
        where: { id: evidenceId },
      });

      if (deleteResponse.status === 200) {
        // Orden A: el delete gano la carrera (se linealizo antes que
        // complete, o complete aun no habia corrido). La evidencia y su
        // archivo fisico deben estar ausentes, sin importar en que estado
        // haya quedado Maintenance.
        expect(persistedEvidence).toBeNull();
        await expect(
          fs.access(getEvidenceFilePath(storedName)),
        ).rejects.toThrow();
        await expect(
          fs.access(getQuarantineFilePath(storedName)),
        ).rejects.toThrow();
      } else if (deleteResponse.status === 409) {
        // Orden B: complete gano la carrera. La evidencia y su archivo
        // deben conservarse intactos y fuera de cuarentena (el intento de
        // borrado se rechazo antes de tocar el filesystem, o lo restauro).
        expect(persistedEvidence).not.toBeNull();
        await expect(
          fs.access(getEvidenceFilePath(storedName)),
        ).resolves.not.toThrow();
        await expect(
          fs.access(getQuarantineFilePath(storedName)),
        ).rejects.toThrow();
      }
    });

    it("deterministico: complete gana primero, el DELETE posterior se rechaza y la evidencia se conserva", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceId);
      const evidenceId = uploadResponse.body.data.evidence.id;
      const storedName = (
        await prisma.evidence.findUnique({ where: { id: evidenceId } })
      ).storedName;

      const completeResponse = await completeMaintenanceReq(maintenanceId);
      expect(completeResponse.status).toBe(200);

      const deleteResponse = await request(app)
        .delete(`${evidencesUrl(maintenanceId)}/${evidenceId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(deleteResponse.status).toBe(409);

      const persistedMaintenance = await prisma.maintenance.findUnique({
        where: { id: maintenanceId },
      });
      expect(persistedMaintenance.status).toBe("COMPLETED");

      const persistedEvidence = await prisma.evidence.findUnique({
        where: { id: evidenceId },
      });
      expect(persistedEvidence).not.toBeNull();
      await expect(
        fs.access(getEvidenceFilePath(storedName)),
      ).resolves.not.toThrow();
      await expect(
        fs.access(getQuarantineFilePath(storedName)),
      ).rejects.toThrow();
    });

    it("deterministico: delete gana primero, ambas operaciones tienen exito y la evidencia queda ausente", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceId);
      const evidenceId = uploadResponse.body.data.evidence.id;
      const storedName = (
        await prisma.evidence.findUnique({ where: { id: evidenceId } })
      ).storedName;

      const deleteResponse = await request(app)
        .delete(`${evidencesUrl(maintenanceId)}/${evidenceId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(deleteResponse.status).toBe(200);

      const completeResponse = await completeMaintenanceReq(maintenanceId);
      expect(completeResponse.status).toBe(200);

      const persistedMaintenance = await prisma.maintenance.findUnique({
        where: { id: maintenanceId },
      });
      expect(persistedMaintenance.status).toBe("COMPLETED");

      const persistedEvidence = await prisma.evidence.findUnique({
        where: { id: evidenceId },
      });
      expect(persistedEvidence).toBeNull();
      await expect(
        fs.access(getEvidenceFilePath(storedName)),
      ).rejects.toThrow();
      await expect(
        fs.access(getQuarantineFilePath(storedName)),
      ).rejects.toThrow();
    });

    it("at most one of two concurrent uploads persists when only one slot remains", async () => {
      const maintenanceId = await createInProgressMaintenance();

      for (let i = 0; i < env.maxEvidencesPerMaintenance - 1; i += 1) {
        await directlyCreateEvidence(maintenanceId);
      }

      const [first, second] = await Promise.all([
        uploadValidJpeg(maintenanceId),
        uploadValidJpeg(maintenanceId),
      ]);

      expect(first.status).not.toBe(500);
      expect(second.status).not.toBe(500);

      const statuses = [first.status, second.status];
      const successCount = statuses.filter((status) => status === 201).length;
      expect(successCount).toBeLessThanOrEqual(1);

      const persistedCount = await prisma.evidence.count({
        where: { maintenanceId },
      });
      expect(persistedCount).toBeLessThanOrEqual(env.maxEvidencesPerMaintenance);
    });
  });

  describe("seguridad", () => {
    it("does not let a traversal-style originalName affect the physical path", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const response = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getMinimalJpegBuffer(),
        "../../../etc/evil.jpg",
        "image/jpeg",
      );

      expect(response.status).toBe(201);

      const persisted = await prisma.evidence.findUnique({
        where: { id: response.body.data.evidence.id },
      });

      expect(persisted.storedName).not.toMatch(/\.\./);
      expect(persisted.storedName).not.toMatch(/[\\/]/);

      const filesBefore = await listEvidenceDirFiles();
      expect(filesBefore).toContain(persisted.storedName);
    });

    it("does not let an absolute-path originalName affect the physical path", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const response = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getMinimalJpegBuffer(),
        "C:\\Windows\\System32\\evil.jpg",
        "image/jpeg",
      );

      expect(response.status).toBe(201);

      const persisted = await prisma.evidence.findUnique({
        where: { id: response.body.data.evidence.id },
      });

      expect(persisted.storedName).not.toMatch(/[\\/]/);
    });

    it("never derives storedName from special characters in the original name", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const response = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getMinimalJpegBuffer(),
        'weird "name"; <script>.jpg',
        "image/jpeg",
      );

      expect(response.status).toBe(201);

      const persisted = await prisma.evidence.findUnique({
        where: { id: response.body.data.evidence.id },
      });

      expect(persisted.storedName).toMatch(/^[0-9a-f-]{36}\.jpg$/i);
    });

    it("rejects an executable renamed as a JPG", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const before = await listEvidenceDirFiles();

      const response = await uploadEvidenceReq(
        maintenanceId,
        adminToken,
        getFakeExecutableBuffer(),
        "totally-a-photo.jpg",
        "image/jpeg",
      );

      expect(response.status).toBe(400);

      const after = await listEvidenceDirFiles();
      expect(after.length).toBe(before.length);
    });

    it("never exposes a physical path in any evidence response", async () => {
      const maintenanceId = await createInProgressMaintenance();
      const uploadResponse = await uploadValidJpeg(maintenanceId);

      const uploadDirAbsolutePath = path.resolve(env.uploadDir);
      const serializedResponse = JSON.stringify(uploadResponse.body);

      expect(serializedResponse).not.toContain(uploadDirAbsolutePath);
      expect(serializedResponse).not.toContain("storedName");
      expect(serializedResponse).not.toContain("relativePath");
    });

    it("does not make the quarantine folder publicly reachable through the download route", async () => {
      const maintenanceId = await createInProgressMaintenance();

      const response = await request(app)
        .get(
          `${evidencesUrl(maintenanceId)}/${encodeURIComponent(
            "../.quarantine/anything",
          )}/file`,
        )
        .set("Authorization", `Bearer ${adminToken}`);

      expect([400, 404]).toContain(response.status);
    });
  });
});
