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

const createdNodeIds = [];

afterAll(async () => {
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
