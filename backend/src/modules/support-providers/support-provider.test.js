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

const createdProviderIds = [];

afterAll(async () => {
  if (createdProviderIds.length > 0) {
    await prisma.supportProvider.deleteMany({
      where: { id: { in: createdProviderIds } },
    });
  }
});

describe("Support provider routes", () => {
  it("lists support providers as ADMIN", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);

    const response = await request(app)
      .get("/api/support-providers")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.supportProviders)).toBe(true);
    expect(response.body.data.supportProviders.length).toBeGreaterThan(0);
  });

  it("lists support providers as OPERATOR", async () => {
    const token = await loginAs("operador@nodekeeper.local", operatorPassword);

    const response = await request(app)
      .get("/api/support-providers")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.supportProviders)).toBe(true);
  });

  it("creates a support provider as ADMIN", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);

    const response = await request(app)
      .post("/api/support-providers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        companyName: "Proveedor de Prueba QA",
        supportPhone: "8000-0000",
        supportEmail: "soporte@proveedorqa.local",
        contactName: "Persona de Contacto",
        contactPhone: "8000-0001",
        contactEmail: "contacto@proveedorqa.local",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.supportProvider.companyName).toBe(
      "Proveedor de Prueba QA",
    );

    createdProviderIds.push(response.body.data.supportProvider.id);
  });

  it("rejects creating a support provider as OPERATOR", async () => {
    const token = await loginAs("operador@nodekeeper.local", operatorPassword);

    const response = await request(app)
      .post("/api/support-providers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        companyName: "Proveedor No Autorizado",
        supportPhone: "8000-0000",
        supportEmail: "soporte@noautorizado.local",
        contactName: "Persona de Contacto",
        contactPhone: "8000-0001",
        contactEmail: "contacto@noautorizado.local",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("gets a support provider detail", async () => {
    const token = await loginAs("admin@nodekeeper.local", adminPassword);

    const createResponse = await request(app)
      .post("/api/support-providers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        companyName: "Proveedor Detalle QA",
        supportPhone: "8000-0002",
        supportEmail: "soporte@detalleqa.local",
        contactName: "Contacto Detalle",
        contactPhone: "8000-0003",
        contactEmail: "contacto@detalleqa.local",
      });

    const providerId = createResponse.body.data.supportProvider.id;
    createdProviderIds.push(providerId);

    const response = await request(app)
      .get(`/api/support-providers/${providerId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.supportProvider.id).toBe(providerId);
    expect(response.body.data.supportProvider.companyName).toBe(
      "Proveedor Detalle QA",
    );
  });
});
