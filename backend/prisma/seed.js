import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const adminPassword = getRequiredEnv("SEED_ADMIN_PASSWORD");
  const operatorPassword = getRequiredEnv("SEED_OPERATOR_PASSWORD");

  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const operatorPasswordHash = await bcrypt.hash(operatorPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@nodekeeper.local" },
    update: {
      name: "Administrador NodeKeeper",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      isActive: true,
    },
    create: {
      name: "Administrador NodeKeeper",
      email: "admin@nodekeeper.local",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  const operator = await prisma.user.upsert({
    where: { email: "operador@nodekeeper.local" },
    update: {
      name: "Operador NodeKeeper",
      passwordHash: operatorPasswordHash,
      role: "OPERATOR",
      isActive: true,
    },
    create: {
      name: "Operador NodeKeeper",
      email: "operador@nodekeeper.local",
      passwordHash: operatorPasswordHash,
      role: "OPERATOR",
      isActive: true,
    },
  });

  await prisma.evidence.deleteMany();
  await prisma.checklistTask.deleteMany();
  await prisma.maintenance.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.networkNode.deleteMany();
  await prisma.supportProvider.deleteMany();

  const providerA = await prisma.supportProvider.create({
    data: {
      companyName: "Soporte Tecnico del Norte",
      supportPhone: "800-555-0101",
      supportEmail: "soporte@stnorte.local",
      contactName: "Carlos Rodriguez",
      contactPhone: "8888-1111",
      contactEmail: "carlos.rodriguez@stnorte.local",
    },
  });

  const providerB = await prisma.supportProvider.create({
    data: {
      companyName: "Infraestructura Digital CR",
      supportPhone: "800-555-0202",
      supportEmail: "mesa@idcr.local",
      contactName: "Mariana Solis",
      contactPhone: "8888-2222",
      contactEmail: "mariana.solis@idcr.local",
    },
  });

  const nodeA = await prisma.networkNode.create({
    data: {
      code: "ND-001",
      name: "Nodo San Carlos Centro",
      location: "San Carlos, Alajuela",
      latitude: 10.327,
      longitude: -84.431,
      status: "AVAILABLE",
    },
  });

  const nodeB = await prisma.networkNode.create({
    data: {
      code: "ND-002",
      name: "Nodo Ciudad Quesada",
      location: "Ciudad Quesada, Alajuela",
      latitude: 10.323,
      longitude: -84.427,
      status: "MAINTENANCE",
    },
  });

  const nodeC = await prisma.networkNode.create({
    data: {
      code: "ND-003",
      name: "Nodo La Fortuna",
      location: "La Fortuna, Alajuela",
      latitude: 10.471,
      longitude: -84.645,
      status: "OUT_OF_SERVICE",
    },
  });

  const routerCore = await prisma.equipment.create({
    data: {
      name: "Router Core Cisco",
      category: "Router",
      serialNumber: "EQ-ROU-001",
      status: "OPERATIONAL",
      networkNodeId: nodeA.id,
      supportProviderId: providerA.id,
    },
  });

  const switchAccess = await prisma.equipment.create({
    data: {
      name: "Switch de Acceso",
      category: "Switch",
      serialNumber: "EQ-SWI-001",
      status: "MAINTENANCE",
      networkNodeId: nodeB.id,
      supportProviderId: providerB.id,
    },
  });

  const powerUnit = await prisma.equipment.create({
    data: {
      name: "Unidad de Respaldo Electrico",
      category: "Energia",
      serialNumber: "EQ-UPS-001",
      status: "OPERATIONAL",
      networkNodeId: nodeC.id,
      supportProviderId: null,
    },
  });

  const maintenance = await prisma.maintenance.create({
    data: {
      title: "Revision preventiva inicial",
      description: "Mantenimiento preventivo de prueba para validar el flujo base.",
      type: "PREVENTIVE",
      status: "SCHEDULED",
      scheduledDate: new Date(),
      networkNodeId: nodeA.id,
      createdById: admin.id,
      checklistTasks: {
        create: [
          {
            description: "Verificar estado general del nodo",
            sortOrder: 1,
          },
          {
            description: "Revisar conectividad principal",
            sortOrder: 2,
          },
          {
            description: "Registrar evidencia fotografica",
            sortOrder: 3,
          },
        ],
      },
    },
  });

  await prisma.maintenance.create({
    data: {
      title: "Revision correctiva de switch",
      description: "Mantenimiento correctivo de prueba asociado a un equipo.",
      type: "CORRECTIVE",
      status: "IN_PROGRESS",
      startedAt: new Date(),
      equipmentId: switchAccess.id,
      createdById: operator.id,
      startedById: operator.id,
      checklistTasks: {
        create: [
          {
            description: "Diagnosticar falla reportada",
            isCompleted: true,
            completedAt: new Date(),
            completedById: operator.id,
            sortOrder: 1,
          },
          {
            description: "Aplicar correccion tecnica",
            sortOrder: 2,
          },
        ],
      },
    },
  });

  console.log("Seed completed successfully.");
  console.log("");
  console.log("Test users:");
  console.log("- admin@nodekeeper.local / configured in SEED_ADMIN_PASSWORD");
  console.log("- operador@nodekeeper.local / configured in SEED_OPERATOR_PASSWORD");
  console.log("");
  console.log("Created records:");
  console.log(`- Users: ${admin.email}, ${operator.email}`);
  console.log(`- Providers: ${providerA.companyName}, ${providerB.companyName}`);
  console.log(`- Nodes: ${nodeA.code}, ${nodeB.code}, ${nodeC.code}`);
  console.log(`- Equipment: ${routerCore.name}, ${switchAccess.name}, ${powerUnit.name}`);
  console.log(`- Maintenance sample: ${maintenance.title}`);
}

main()
  .catch((error) => {
    console.error("Seed failed.");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
