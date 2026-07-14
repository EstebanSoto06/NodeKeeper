import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../app.js";

describe("Health routes", () => {
  it("returns API health status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("NodeKeeper API");
  });

  it("returns database health status", async () => {
    const response = await request(app).get("/api/health/database");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("NodeKeeper Database");
    expect(response.body.database).toBe("connected");
  });
});
