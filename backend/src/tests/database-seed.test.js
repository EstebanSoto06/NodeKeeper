import { describe, expect, it } from "vitest";

import { prisma } from "../config/prisma.js";

describe("Database seed", () => {
  it("has initial users, providers, nodes, equipment and maintenances", async () => {
    const users = await prisma.user.count();
    const providers = await prisma.supportProvider.count();
    const nodes = await prisma.networkNode.count();
    const equipment = await prisma.equipment.count();
    const maintenances = await prisma.maintenance.count();
    const checklistTasks = await prisma.checklistTask.count();

    expect(users).toBeGreaterThanOrEqual(2);
    expect(providers).toBeGreaterThanOrEqual(2);
    expect(nodes).toBeGreaterThanOrEqual(3);
    expect(equipment).toBeGreaterThanOrEqual(3);
    expect(maintenances).toBeGreaterThanOrEqual(2);
    expect(checklistTasks).toBeGreaterThanOrEqual(5);
  });

  it("has the default admin and operator users", async () => {
    const admin = await prisma.user.findUnique({
      where: { email: "admin@nodekeeper.local" },
    });

    const operator = await prisma.user.findUnique({
      where: { email: "operador@nodekeeper.local" },
    });

    expect(admin).toBeTruthy();
    expect(admin.role).toBe("ADMIN");
    expect(admin.isActive).toBe(true);

    expect(operator).toBeTruthy();
    expect(operator.role).toBe("OPERATOR");
    expect(operator.isActive).toBe(true);
  });

  it("has support providers with support and contact emails", async () => {
    const providers = await prisma.supportProvider.findMany();

    expect(providers.length).toBeGreaterThanOrEqual(2);

    for (const provider of providers) {
      expect(provider.companyName).toBeTruthy();
      expect(provider.supportEmail).toContain("@");
      expect(provider.contactEmail).toContain("@");
    }
  });
});
