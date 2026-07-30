import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

// Se mockea Prisma para poder probar el caso "no listo" (503) de forma
// deterministica, sin depender de una base de datos real caida a proposito.
vi.mock("../config/prisma.js", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import app from "../app.js";
import { prisma } from "../config/prisma.js";

describe("Readiness route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("responde 200 y ready cuando la base de datos responde", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await request(app).get("/api/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, status: "ready" });
  });

  it("responde 503 y not_ready cuando la base de datos falla, sin exponer detalles internos", async () => {
    prisma.$queryRaw.mockRejectedValueOnce(
      new Error("connection refused to some-internal-host:5432"),
    );

    const response = await request(app).get("/api/ready");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ success: false, status: "not_ready" });

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/some-internal-host|5432|connection refused/i);
  });

  it("no incluye host, usuario, contraseña ni cadena de conexion en ninguna respuesta", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const ready = await request(app).get("/api/ready");
    expect(JSON.stringify(ready.body)).not.toMatch(/postgresql:\/\/|password|DATABASE_URL/i);

    prisma.$queryRaw.mockRejectedValueOnce(new Error("auth failed"));
    const notReady = await request(app).get("/api/ready");
    expect(JSON.stringify(notReady.body)).not.toMatch(/postgresql:\/\/|password|DATABASE_URL/i);
  });
});
