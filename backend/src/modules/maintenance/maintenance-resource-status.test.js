/* Sincronizacion del estado de NetworkNode / Equipment con el ciclo de vida
   de un Maintenance (ver el bloque "Sincronizacion del estado de
   NetworkNode / Equipment" en maintenance.service.js).

   Vive en su propio archivo, y no dentro de maintenance.test.js, por dos
   razones: cada prueba necesita un nodo y unos equipos RECIEN creados (el
   nodo compartido de maintenance.test.js acumula ordenes IN_PROGRESS que
   nunca se cierran, y la regla de "no restaurar mientras quede otra activa"
   haria que esos residuos decidieran el resultado), y la ultima seccion
   simula fallos de base de datos con spies, igual que
   evidence-filesystem-failure.test.js. */
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import app from "../../app.js";
import { prisma } from "../../config/prisma.js";
import * as serializableTransactionModule from "../../utils/serializable-transaction.js";

// Se captura la implementacion REAL antes de que ninguna prueba la espie:
// las pruebas de rollback la necesitan para ejecutar la transaccion de
// verdad y fallar dentro de ella, no para reemplazarla.
const realRunSerializableTransaction =
  serializableTransactionModule.runSerializableTransaction;

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const adminPassword = getRequiredEnv("SEED_ADMIN_PASSWORD");
const ADMIN_EMAIL = "admin@nodekeeper.local";

const createdMaintenanceIds = [];
const createdEquipmentIds = [];
const createdNodeIds = [];

let adminToken;

function uniqueSuffix(label) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createNodeFixture(label, status = "AVAILABLE") {
  const response = await request(app)
    .post("/api/network-nodes")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: `ND-SYNC-${uniqueSuffix(label)}`,
      name: `Nodo Sincronizacion ${label}`,
      status,
    });

  const id = response.body.data.networkNode.id;
  createdNodeIds.push(id);

  return id;
}

async function createEquipmentFixture(networkNodeId, label, status = "OPERATIONAL") {
  const response = await request(app)
    .post("/api/equipment")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `Equipo Sincronizacion ${label}`,
      category: "Router",
      serialNumber: `EQ-SYNC-${uniqueSuffix(label)}`,
      status,
      networkNodeId,
    });

  const id = response.body.data.equipment.id;
  createdEquipmentIds.push(id);

  return id;
}

async function createMaintenanceFixture(payload) {
  const response = await request(app)
    .post("/api/maintenances")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: `Mantenimiento Sync QA ${uniqueSuffix("MT")}`,
      ...payload,
    });

  const id = response.body.data.maintenance.id;
  createdMaintenanceIds.push(id);

  return id;
}

function startMaintenance(maintenanceId) {
  return request(app)
    .post(`/api/maintenances/${maintenanceId}/start`)
    .set("Authorization", `Bearer ${adminToken}`);
}

function completeMaintenance(maintenanceId) {
  return request(app)
    .post(`/api/maintenances/${maintenanceId}/complete`)
    .set("Authorization", `Bearer ${adminToken}`);
}

function updateMaintenance(maintenanceId, payload) {
  return request(app)
    .put(`/api/maintenances/${maintenanceId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send(payload);
}

function deleteMaintenance(maintenanceId) {
  return request(app)
    .delete(`/api/maintenances/${maintenanceId}`)
    .set("Authorization", `Bearer ${adminToken}`);
}

/* Los PUT de nodo y equipo reenvian la entidad COMPLETA, igual que hacen los
   formularios reales (NodeFormModal/EquipmentFormModal): `changes` solo
   sobrescribe los campos que la prueba quiere tocar. Asi las pruebas de
   estado no dependen de recordar el resto del payload obligatorio. */
async function putNode(id, changes) {
  const node = await prisma.networkNode.findUnique({ where: { id } });

  return request(app)
    .put(`/api/network-nodes/${id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      code: node.code,
      name: node.name,
      location: node.location,
      status: node.status,
      ...changes,
    });
}

async function putEquipment(id, changes) {
  const equipment = await prisma.equipment.findUnique({ where: { id } });

  return request(app)
    .put(`/api/equipment/${id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: equipment.name,
      category: equipment.category,
      serialNumber: equipment.serialNumber,
      status: equipment.status,
      networkNodeId: equipment.networkNodeId,
      supportProviderId: equipment.supportProviderId,
      ...changes,
    });
}

// Crea una tarea (solo posible mientras la orden esta SCHEDULED) y devuelve
// una funcion que la marca completada, ya con la orden IN_PROGRESS. Recorre
// el flujo real de la API en vez de escribir isCompleted en base de datos,
// para que la regla del checklist quede ejercitada de punta a punta.
async function addChecklistTask(maintenanceId, description) {
  const response = await request(app)
    .post(`/api/maintenances/${maintenanceId}/checklist-tasks`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ description });

  const taskId = response.body.data.checklistTask.id;

  return () =>
    request(app)
      .patch(`/api/maintenances/${maintenanceId}/checklist-tasks/${taskId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isCompleted: true });
}

async function readNodeStatus(id) {
  const node = await prisma.networkNode.findUnique({
    where: { id },
    select: { status: true },
  });

  return node.status;
}

async function readEquipmentStatus(id) {
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    select: { status: true },
  });

  return equipment.status;
}

async function readMaintenanceStatus(id) {
  const maintenance = await prisma.maintenance.findUnique({
    where: { id },
    select: { status: true },
  });

  return maintenance.status;
}

beforeAll(async () => {
  const loginResponse = await request(app)
    .post("/api/auth/login")
    .send({ email: ADMIN_EMAIL, password: adminPassword });

  adminToken = loginResponse.body.data.token;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  // Orden obligatorio: Maintenance referencia a Equipment/NetworkNode con
  // onDelete: Restrict, y Equipment referencia al nodo.
  if (createdMaintenanceIds.length > 0) {
    await prisma.maintenance.deleteMany({
      where: { id: { in: createdMaintenanceIds } },
    });
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

describe("A. Inicio de un mantenimiento PREVENTIVO", () => {
  it("pone el nodo en MAINTENANCE y TODOS sus equipos en MAINTENANCE", async () => {
    const networkNodeId = await createNodeFixture("A");
    const equipment1 = await createEquipmentFixture(networkNodeId, "A1");
    const equipment2 = await createEquipmentFixture(networkNodeId, "A2");
    const equipment3 = await createEquipmentFixture(networkNodeId, "A3");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    expect(await readNodeStatus(networkNodeId)).toBe("AVAILABLE");

    const response = await startMaintenance(maintenanceId);

    expect(response.status).toBe(200);
    expect(response.body.data.maintenance.status).toBe("IN_PROGRESS");

    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(equipment1)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(equipment2)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(equipment3)).toBe("MAINTENANCE");
  });

  it("devuelve el estado ya sincronizado en la propia respuesta de start", async () => {
    // El frontend no necesita logica especial: la respuesta de /start ya
    // trae el nodo con su estado nuevo, y cualquier pantalla que recargue
    // (todas usan useAsync al montar) lee el estado real del backend.
    const networkNodeId = await createNodeFixture("A-RESP");
    await createEquipmentFixture(networkNodeId, "A-RESP-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    const response = await startMaintenance(maintenanceId);

    expect(response.status).toBe(200);
    expect(response.body.data.maintenance.networkNode.status).toBe("MAINTENANCE");

    const nodeDetail = await request(app)
      .get(`/api/network-nodes/${networkNodeId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(nodeDetail.body.data.networkNode.status).toBe("MAINTENANCE");
  });
});

describe("B. Cierre de un mantenimiento PREVENTIVO", () => {
  it("devuelve el nodo a AVAILABLE y sus equipos a OPERATIONAL", async () => {
    const networkNodeId = await createNodeFixture("B");
    const equipment1 = await createEquipmentFixture(networkNodeId, "B1");
    const equipment2 = await createEquipmentFixture(networkNodeId, "B2");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    const completeTask = await addChecklistTask(maintenanceId, "Revisar tablero");

    await startMaintenance(maintenanceId);
    const taskResponse = await completeTask();
    expect(taskResponse.status).toBe(200);

    const response = await completeMaintenance(maintenanceId);

    expect(response.status).toBe(200);
    expect(response.body.data.maintenance.status).toBe("COMPLETED");

    expect(await readNodeStatus(networkNodeId)).toBe("AVAILABLE");
    expect(await readEquipmentStatus(equipment1)).toBe("OPERATIONAL");
    expect(await readEquipmentStatus(equipment2)).toBe("OPERATIONAL");
  });
});

describe("C. Inicio de un mantenimiento CORRECTIVO", () => {
  it("pone en MAINTENANCE solo el equipo intervenido y su nodo padre", async () => {
    const networkNodeId = await createNodeFixture("C");
    const equipment1 = await createEquipmentFixture(networkNodeId, "C1");
    const equipment2 = await createEquipmentFixture(networkNodeId, "C2");
    const equipment3 = await createEquipmentFixture(networkNodeId, "C3");

    const maintenanceId = await createMaintenanceFixture({
      type: "CORRECTIVE",
      equipmentId: equipment1,
    });

    const response = await startMaintenance(maintenanceId);

    expect(response.status).toBe(200);
    expect(response.body.data.maintenance.status).toBe("IN_PROGRESS");

    expect(await readEquipmentStatus(equipment1)).toBe("MAINTENANCE");
    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");

    // Los hermanos del equipo intervenido NO cambian por un correctivo.
    expect(await readEquipmentStatus(equipment2)).toBe("OPERATIONAL");
    expect(await readEquipmentStatus(equipment3)).toBe("OPERATIONAL");
  });
});

describe("D. Cierre de un mantenimiento CORRECTIVO", () => {
  it("devuelve el equipo a OPERATIONAL y el nodo padre a AVAILABLE", async () => {
    const networkNodeId = await createNodeFixture("D");
    const equipment1 = await createEquipmentFixture(networkNodeId, "D1");
    const equipment2 = await createEquipmentFixture(networkNodeId, "D2");

    const maintenanceId = await createMaintenanceFixture({
      type: "CORRECTIVE",
      equipmentId: equipment1,
    });

    const completeTask = await addChecklistTask(maintenanceId, "Cambiar fuente");

    await startMaintenance(maintenanceId);
    await completeTask();

    const response = await completeMaintenance(maintenanceId);

    expect(response.status).toBe(200);
    expect(response.body.data.maintenance.status).toBe("COMPLETED");

    expect(await readEquipmentStatus(equipment1)).toBe("OPERATIONAL");
    expect(await readNodeStatus(networkNodeId)).toBe("AVAILABLE");
    expect(await readEquipmentStatus(equipment2)).toBe("OPERATIONAL");
  });
});

describe("E. Varios mantenimientos activos sobre el mismo recurso", () => {
  it("dos preventivos sobre el mismo nodo: solo el ultimo cierre restaura", async () => {
    const networkNodeId = await createNodeFixture("E1");
    const equipmentId = await createEquipmentFixture(networkNodeId, "E1-1");

    const first = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });
    const second = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(first);
    await startMaintenance(second);

    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(equipmentId)).toBe("MAINTENANCE");

    expect((await completeMaintenance(first)).status).toBe(200);

    // Sigue habiendo un preventivo IN_PROGRESS sobre el nodo.
    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(equipmentId)).toBe("MAINTENANCE");

    expect((await completeMaintenance(second)).status).toBe(200);

    expect(await readNodeStatus(networkNodeId)).toBe("AVAILABLE");
    expect(await readEquipmentStatus(equipmentId)).toBe("OPERATIONAL");
  });

  it("preventivo + correctivo del mismo nodo: cada uno libera solo lo que ya nadie ocupa", async () => {
    const networkNodeId = await createNodeFixture("E2");
    const equipment1 = await createEquipmentFixture(networkNodeId, "E2-1");
    const equipment2 = await createEquipmentFixture(networkNodeId, "E2-2");

    const preventive = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });
    const corrective = await createMaintenanceFixture({
      type: "CORRECTIVE",
      equipmentId: equipment1,
    });

    await startMaintenance(preventive);
    await startMaintenance(corrective);

    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(equipment1)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(equipment2)).toBe("MAINTENANCE");

    expect((await completeMaintenance(preventive)).status).toBe(200);

    // El correctivo sigue activo: retiene su equipo y, por ser un recurso
    // del nodo, tambien al nodo. El equipo 2, en cambio, ya no lo ocupa
    // nadie y vuelve a OPERATIONAL.
    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(equipment1)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(equipment2)).toBe("OPERATIONAL");

    expect((await completeMaintenance(corrective)).status).toBe(200);

    expect(await readNodeStatus(networkNodeId)).toBe("AVAILABLE");
    expect(await readEquipmentStatus(equipment1)).toBe("OPERATIONAL");
  });

  it("dos correctivos sobre el mismo equipo: solo el ultimo cierre lo restaura", async () => {
    const networkNodeId = await createNodeFixture("E3");
    const equipmentId = await createEquipmentFixture(networkNodeId, "E3-1");

    const first = await createMaintenanceFixture({
      type: "CORRECTIVE",
      equipmentId,
    });
    const second = await createMaintenanceFixture({
      type: "CORRECTIVE",
      equipmentId,
    });

    await startMaintenance(first);
    await startMaintenance(second);

    expect((await completeMaintenance(first)).status).toBe(200);

    expect(await readEquipmentStatus(equipmentId)).toBe("MAINTENANCE");
    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");

    expect((await completeMaintenance(second)).status).toBe(200);

    expect(await readEquipmentStatus(equipmentId)).toBe("OPERATIONAL");
    expect(await readNodeStatus(networkNodeId)).toBe("AVAILABLE");
  });
});

describe("F. Concurrencia", () => {
  it("dos start simultaneos del mismo mantenimiento dejan un unico estado consistente", async () => {
    const networkNodeId = await createNodeFixture("F1");
    const equipmentId = await createEquipmentFixture(networkNodeId, "F1-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    const [first, second] = await Promise.all([
      startMaintenance(maintenanceId),
      startMaintenance(maintenanceId),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);

    expect(await readMaintenanceStatus(maintenanceId)).toBe("IN_PROGRESS");
    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(equipmentId)).toBe("MAINTENANCE");
  });

  it("dos complete simultaneos del mismo mantenimiento dejan un unico estado consistente", async () => {
    const networkNodeId = await createNodeFixture("F2");
    const equipmentId = await createEquipmentFixture(networkNodeId, "F2-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(maintenanceId);

    const [first, second] = await Promise.all([
      completeMaintenance(maintenanceId),
      completeMaintenance(maintenanceId),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);

    expect(await readMaintenanceStatus(maintenanceId)).toBe("COMPLETED");
    expect(await readNodeStatus(networkNodeId)).toBe("AVAILABLE");
    expect(await readEquipmentStatus(equipmentId)).toBe("OPERATIONAL");
  });

  it("cerrar una orden mientras se inicia otra sobre el mismo nodo nunca deja el nodo disponible con un mantenimiento activo", async () => {
    // Esta es la carrera que obliga a que startMaintenance corra tambien en
    // Serializable: bajo READ COMMITTED el conteo de "otras ordenes activas"
    // del complete puede ver cero justo antes de que el start confirme la
    // suya, y el nodo terminaria AVAILABLE con una orden IN_PROGRESS encima.
    const networkNodeId = await createNodeFixture("F3");
    const equipmentId = await createEquipmentFixture(networkNodeId, "F3-1");

    const running = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });
    const pending = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(running);

    await Promise.all([completeMaintenance(running), startMaintenance(pending)]);

    // El resultado depende de quien gane la carrera (e incluso el start
    // puede perderla y devolver 409), asi que no se fija un estado concreto:
    // lo que se exige es el INVARIANTE de negocio, que debe cumplirse en
    // cualquiera de los desenlaces posibles.
    const activeCount = await prisma.maintenance.count({
      where: {
        status: "IN_PROGRESS",
        OR: [{ networkNodeId }, { equipment: { networkNodeId } }],
      },
    });

    const expectedNodeStatus = activeCount > 0 ? "MAINTENANCE" : "AVAILABLE";
    const expectedEquipmentStatus = activeCount > 0 ? "MAINTENANCE" : "OPERATIONAL";

    expect(await readNodeStatus(networkNodeId)).toBe(expectedNodeStatus);
    expect(await readEquipmentStatus(equipmentId)).toBe(expectedEquipmentStatus);
  });
});

describe("G. Checklist pendiente", () => {
  it("no cierra la orden y tampoco libera el nodo ni los equipos", async () => {
    const networkNodeId = await createNodeFixture("G");
    const equipmentId = await createEquipmentFixture(networkNodeId, "G1");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await addChecklistTask(maintenanceId, "Tarea que queda pendiente");
    await startMaintenance(maintenanceId);

    const response = await completeMaintenance(maintenanceId);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);

    expect(await readMaintenanceStatus(maintenanceId)).toBe("IN_PROGRESS");
    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(equipmentId)).toBe("MAINTENANCE");
  });
});

describe("OUT_OF_SERVICE no se sobrescribe", () => {
  it("iniciar un preventivo no saca de OUT_OF_SERVICE al nodo ni a sus equipos", async () => {
    const networkNodeId = await createNodeFixture("OOS1", "OUT_OF_SERVICE");
    const brokenEquipment = await createEquipmentFixture(
      networkNodeId,
      "OOS1-BROKEN",
      "OUT_OF_SERVICE",
    );
    const healthyEquipment = await createEquipmentFixture(networkNodeId, "OOS1-OK");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    expect((await startMaintenance(maintenanceId)).status).toBe(200);

    expect(await readNodeStatus(networkNodeId)).toBe("OUT_OF_SERVICE");
    expect(await readEquipmentStatus(brokenEquipment)).toBe("OUT_OF_SERVICE");
    expect(await readEquipmentStatus(healthyEquipment)).toBe("MAINTENANCE");
  });

  it("completar un preventivo no convierte OUT_OF_SERVICE en AVAILABLE/OPERATIONAL", async () => {
    const networkNodeId = await createNodeFixture("OOS2");
    const equipmentId = await createEquipmentFixture(networkNodeId, "OOS2-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(maintenanceId);

    // Durante la ejecucion se detecta un dano real y se registra a mano.
    // OUT_OF_SERVICE SI puede asignarse con la orden en curso (tiene
    // prioridad sobre MAINTENANCE), y cerrar la orden no puede borrarlo.
    expect(
      (await putNode(networkNodeId, { status: "OUT_OF_SERVICE" })).status,
    ).toBe(200);
    expect(
      (await putEquipment(equipmentId, { status: "OUT_OF_SERVICE" })).status,
    ).toBe(200);

    expect((await completeMaintenance(maintenanceId)).status).toBe(200);

    expect(await readNodeStatus(networkNodeId)).toBe("OUT_OF_SERVICE");
    expect(await readEquipmentStatus(equipmentId)).toBe("OUT_OF_SERVICE");
  });

  it("completar un correctivo no saca de OUT_OF_SERVICE al equipo ni a su nodo", async () => {
    const networkNodeId = await createNodeFixture("OOS3");
    const equipmentId = await createEquipmentFixture(networkNodeId, "OOS3-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "CORRECTIVE",
      equipmentId,
    });

    await startMaintenance(maintenanceId);

    expect(
      (await putEquipment(equipmentId, { status: "OUT_OF_SERVICE" })).status,
    ).toBe(200);

    expect((await completeMaintenance(maintenanceId)).status).toBe(200);

    expect(await readEquipmentStatus(equipmentId)).toBe("OUT_OF_SERVICE");
    // El nodo si vuelve: ya nadie lo ocupa y su estado era MAINTENANCE.
    expect(await readNodeStatus(networkNodeId)).toBe("AVAILABLE");
  });
});

/* ---------------------------------------------------------------------------
   H. Rollback: un fallo dentro de la operacion no puede dejar la orden
   cambiada sin los recursos, ni al reves.

   La forma de provocarlo es ejecutar la transaccion REAL pero entregandole un
   cliente en el que una sola operacion falla. Se usa un Proxy y no una copia
   del objeto porque el cliente de Prisma expone sus delegados mediante
   getters: un spread perderia parte del cliente. */

function withFailingOperation(tx, model, operation) {
  return new Proxy(tx, {
    get(target, property) {
      const value = target[property];

      if (property !== model) {
        return typeof value === "function" ? value.bind(target) : value;
      }

      return new Proxy(value, {
        get(delegate, delegateProperty) {
          if (delegateProperty === operation) {
            return () =>
              Promise.reject(
                new Error(`Simulated ${model}.${operation} failure`),
              );
          }

          const delegateValue = delegate[delegateProperty];

          return typeof delegateValue === "function"
            ? delegateValue.bind(delegate)
            : delegateValue;
        },
      });
    },
  });
}

function failNextTransactionAt(model, operation) {
  vi.spyOn(
    serializableTransactionModule,
    "runSerializableTransaction",
  ).mockImplementationOnce((work) =>
    realRunSerializableTransaction((tx) =>
      work(withFailingOperation(tx, model, operation)),
    ),
  );
}

describe("H. Errores y rollback", () => {
  it("si falla la actualizacion de equipos al iniciar, ni la orden ni el nodo quedan cambiados", async () => {
    const networkNodeId = await createNodeFixture("H1");
    const equipmentId = await createEquipmentFixture(networkNodeId, "H1-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    // El fallo ocurre DESPUES de que la transaccion ya escribio la orden
    // (IN_PROGRESS) y el nodo (MAINTENANCE): si el rollback no funcionara,
    // ambos quedarian visibles.
    failNextTransactionAt("equipment", "updateMany");

    const response = await startMaintenance(maintenanceId);

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);

    vi.restoreAllMocks();

    expect(await readMaintenanceStatus(maintenanceId)).toBe("SCHEDULED");
    expect(await readNodeStatus(networkNodeId)).toBe("AVAILABLE");
    expect(await readEquipmentStatus(equipmentId)).toBe("OPERATIONAL");

    const persisted = await prisma.maintenance.findUnique({
      where: { id: maintenanceId },
      select: { startedAt: true, startedById: true },
    });
    expect(persisted.startedAt).toBeNull();
    expect(persisted.startedById).toBeNull();
  });

  it("si falla la restauracion de equipos al completar, la orden sigue IN_PROGRESS y los recursos en MAINTENANCE", async () => {
    const networkNodeId = await createNodeFixture("H2");
    const equipmentId = await createEquipmentFixture(networkNodeId, "H2-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(maintenanceId);

    failNextTransactionAt("equipment", "updateMany");

    const response = await completeMaintenance(maintenanceId);

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);

    vi.restoreAllMocks();

    expect(await readMaintenanceStatus(maintenanceId)).toBe("IN_PROGRESS");
    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(equipmentId)).toBe("MAINTENANCE");

    const persisted = await prisma.maintenance.findUnique({
      where: { id: maintenanceId },
      select: { completedAt: true, closedById: true },
    });
    expect(persisted.completedAt).toBeNull();
    expect(persisted.closedById).toBeNull();
  });

  it("si falla la actualizacion del nodo al iniciar, la orden no queda IN_PROGRESS", async () => {
    const networkNodeId = await createNodeFixture("H3");
    const equipmentId = await createEquipmentFixture(networkNodeId, "H3-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "CORRECTIVE",
      equipmentId,
    });

    failNextTransactionAt("networkNode", "updateMany");

    const response = await startMaintenance(maintenanceId);

    expect(response.status).toBe(500);

    vi.restoreAllMocks();

    expect(await readMaintenanceStatus(maintenanceId)).toBe("SCHEDULED");
    expect(await readEquipmentStatus(equipmentId)).toBe("OPERATIONAL");
    expect(await readNodeStatus(networkNodeId)).toBe("AVAILABLE");
  });
});

describe("I. El recurso de una orden en ejecucion es inmutable", () => {
  it("un preventivo IN_PROGRESS no puede reasignarse a otro nodo", async () => {
    const originalNodeId = await createNodeFixture("I1-ORIG");
    const originalEquipmentId = await createEquipmentFixture(originalNodeId, "I1-ORIG-1");
    const otherNodeId = await createNodeFixture("I1-OTRO");
    const otherEquipmentId = await createEquipmentFixture(otherNodeId, "I1-OTRO-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId: originalNodeId,
    });

    await startMaintenance(maintenanceId);

    const response = await updateMaintenance(maintenanceId, {
      title: "Intento de reasignacion de nodo",
      type: "PREVENTIVE",
      networkNodeId: otherNodeId,
    });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);

    // La orden conserva su nodo y NINGUN recurso cambio de estado: ni el
    // original queda liberado, ni el destino queda marcado.
    const persisted = await prisma.maintenance.findUnique({
      where: { id: maintenanceId },
      select: { networkNodeId: true, title: true, status: true },
    });
    expect(persisted.networkNodeId).toBe(originalNodeId);
    expect(persisted.status).toBe("IN_PROGRESS");
    expect(persisted.title).not.toBe("Intento de reasignacion de nodo");

    expect(await readNodeStatus(originalNodeId)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(originalEquipmentId)).toBe("MAINTENANCE");
    expect(await readNodeStatus(otherNodeId)).toBe("AVAILABLE");
    expect(await readEquipmentStatus(otherEquipmentId)).toBe("OPERATIONAL");
  });

  it("un correctivo IN_PROGRESS no puede reasignarse a otro equipo", async () => {
    const networkNodeId = await createNodeFixture("I2");
    const originalEquipmentId = await createEquipmentFixture(networkNodeId, "I2-1");
    const otherEquipmentId = await createEquipmentFixture(networkNodeId, "I2-2");

    const maintenanceId = await createMaintenanceFixture({
      type: "CORRECTIVE",
      equipmentId: originalEquipmentId,
    });

    await startMaintenance(maintenanceId);

    const response = await updateMaintenance(maintenanceId, {
      title: "Intento de reasignacion de equipo",
      type: "CORRECTIVE",
      equipmentId: otherEquipmentId,
    });

    expect(response.status).toBe(409);

    const persisted = await prisma.maintenance.findUnique({
      where: { id: maintenanceId },
      select: { equipmentId: true },
    });
    expect(persisted.equipmentId).toBe(originalEquipmentId);

    expect(await readEquipmentStatus(originalEquipmentId)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(otherEquipmentId)).toBe("OPERATIONAL");
  });

  it("un preventivo IN_PROGRESS tampoco puede convertirse en correctivo", async () => {
    const networkNodeId = await createNodeFixture("I3");
    const equipmentId = await createEquipmentFixture(networkNodeId, "I3-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(maintenanceId);

    const response = await updateMaintenance(maintenanceId, {
      title: "Intento de cambio de tipo",
      type: "CORRECTIVE",
      equipmentId,
    });

    expect(response.status).toBe(409);

    const persisted = await prisma.maintenance.findUnique({
      where: { id: maintenanceId },
      select: { type: true, networkNodeId: true, equipmentId: true },
    });
    expect(persisted.type).toBe("PREVENTIVE");
    expect(persisted.networkNodeId).toBe(networkNodeId);
    expect(persisted.equipmentId).toBeNull();
  });

  it("los demas campos de un preventivo IN_PROGRESS se siguen editando", async () => {
    // La restriccion es sobre el RECURSO, no sobre la orden: reenviar el
    // mismo nodo con otro titulo o descripcion tiene que seguir funcionando.
    const networkNodeId = await createNodeFixture("I4");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(maintenanceId);

    const response = await updateMaintenance(maintenanceId, {
      title: "Titulo editado en ejecucion",
      description: "Descripcion editada en ejecucion",
      type: "PREVENTIVE",
      networkNodeId,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.maintenance.title).toBe("Titulo editado en ejecucion");
    expect(response.body.data.maintenance.status).toBe("IN_PROGRESS");
    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");
  });

  it("una orden IN_PROGRESS no puede eliminarse y sus recursos quedan intactos", async () => {
    const networkNodeId = await createNodeFixture("I5");
    const equipmentId = await createEquipmentFixture(networkNodeId, "I5-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(maintenanceId);

    const response = await deleteMaintenance(maintenanceId);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);

    // La orden sigue existiendo (es la unica que puede liberar los recursos)
    // y ni el nodo ni el equipo cambiaron.
    expect(await readMaintenanceStatus(maintenanceId)).toBe("IN_PROGRESS");
    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");
    expect(await readEquipmentStatus(equipmentId)).toBe("MAINTENANCE");
  });

  it("una vez completada, la orden si puede eliminarse", async () => {
    const networkNodeId = await createNodeFixture("I6");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(maintenanceId);
    await completeMaintenance(maintenanceId);

    expect((await deleteMaintenance(maintenanceId)).status).toBe(200);
    expect(await readNodeStatus(networkNodeId)).toBe("AVAILABLE");
  });
});

describe("J. MAINTENANCE es un estado automatico, no asignable a mano", () => {
  it("no se puede crear un nodo directamente en MAINTENANCE", async () => {
    const response = await request(app)
      .post("/api/network-nodes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `ND-SYNC-${uniqueSuffix("J1")}`,
        name: "Nodo J1",
        status: "MAINTENANCE",
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("no se puede poner un nodo en MAINTENANCE a mano si no hay orden activa", async () => {
    const networkNodeId = await createNodeFixture("J2");

    const response = await putNode(networkNodeId, { status: "MAINTENANCE" });

    expect(response.status).toBe(409);
    expect(await readNodeStatus(networkNodeId)).toBe("AVAILABLE");
  });

  it("no se puede crear un equipo directamente en MAINTENANCE", async () => {
    const networkNodeId = await createNodeFixture("J3");

    const response = await request(app)
      .post("/api/equipment")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Equipo J3",
        category: "Router",
        serialNumber: `EQ-SYNC-${uniqueSuffix("J3")}`,
        status: "MAINTENANCE",
        networkNodeId,
      });

    expect(response.status).toBe(409);
  });

  it("no se puede poner un equipo en MAINTENANCE a mano si no hay orden activa", async () => {
    const networkNodeId = await createNodeFixture("J4");
    const equipmentId = await createEquipmentFixture(networkNodeId, "J4-1");

    const response = await putEquipment(equipmentId, { status: "MAINTENANCE" });

    expect(response.status).toBe(409);
    expect(await readEquipmentStatus(equipmentId)).toBe("OPERATIONAL");
  });

  it("un nodo con orden activa no puede marcarse AVAILABLE a mano", async () => {
    const networkNodeId = await createNodeFixture("J5");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(maintenanceId);

    const response = await putNode(networkNodeId, { status: "AVAILABLE" });

    expect(response.status).toBe(409);
    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");
  });

  it("un equipo con orden activa no puede marcarse OPERATIONAL a mano", async () => {
    const networkNodeId = await createNodeFixture("J6");
    const equipmentId = await createEquipmentFixture(networkNodeId, "J6-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "CORRECTIVE",
      equipmentId,
    });

    await startMaintenance(maintenanceId);

    const response = await putEquipment(equipmentId, { status: "OPERATIONAL" });

    expect(response.status).toBe(409);
    expect(await readEquipmentStatus(equipmentId)).toBe("MAINTENANCE");
  });

  it("un nodo padre ocupado por un correctivo tampoco puede marcarse AVAILABLE", async () => {
    // El nodo no es el objetivo directo de la orden, pero el correctivo de
    // uno de sus equipos lo mantiene ocupado igual.
    const networkNodeId = await createNodeFixture("J7");
    const equipmentId = await createEquipmentFixture(networkNodeId, "J7-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "CORRECTIVE",
      equipmentId,
    });

    await startMaintenance(maintenanceId);

    expect((await putNode(networkNodeId, { status: "AVAILABLE" })).status).toBe(409);
    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");
  });

  it("durante una orden activa SI se puede marcar OUT_OF_SERVICE, y eso persiste al completar", async () => {
    const networkNodeId = await createNodeFixture("J8");
    const equipmentId = await createEquipmentFixture(networkNodeId, "J8-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(maintenanceId);

    expect((await putNode(networkNodeId, { status: "OUT_OF_SERVICE" })).status).toBe(200);
    expect(
      (await putEquipment(equipmentId, { status: "OUT_OF_SERVICE" })).status,
    ).toBe(200);

    expect(await readNodeStatus(networkNodeId)).toBe("OUT_OF_SERVICE");
    expect(await readEquipmentStatus(equipmentId)).toBe("OUT_OF_SERVICE");

    expect((await completeMaintenance(maintenanceId)).status).toBe(200);

    expect(await readNodeStatus(networkNodeId)).toBe("OUT_OF_SERVICE");
    expect(await readEquipmentStatus(equipmentId)).toBe("OUT_OF_SERVICE");
  });

  it("editar otros campos reenviando el MAINTENANCE actual sigue funcionando", async () => {
    // Este es el caso que la regla NO puede romper: el formulario reenvia la
    // entidad completa, incluido el estado automatico que el recurso ya
    // tiene. Conservarlo es un no-op y debe permitirse; lo prohibido es
    // ASIGNAR MAINTENANCE a un recurso que no lo tiene.
    const networkNodeId = await createNodeFixture("J9");
    const equipmentId = await createEquipmentFixture(networkNodeId, "J9-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(maintenanceId);

    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");

    const nodeResponse = await putNode(networkNodeId, {
      name: "Nodo J9 renombrado",
      location: "Ubicacion nueva",
      status: "MAINTENANCE",
    });

    expect(nodeResponse.status).toBe(200);
    expect(nodeResponse.body.data.networkNode.name).toBe("Nodo J9 renombrado");
    expect(nodeResponse.body.data.networkNode.location).toBe("Ubicacion nueva");
    expect(nodeResponse.body.data.networkNode.status).toBe("MAINTENANCE");

    const equipmentResponse = await putEquipment(equipmentId, {
      name: "Equipo J9 renombrado",
      category: "Switch",
      status: "MAINTENANCE",
    });

    expect(equipmentResponse.status).toBe(200);
    expect(equipmentResponse.body.data.equipment.name).toBe("Equipo J9 renombrado");
    expect(equipmentResponse.body.data.equipment.category).toBe("Switch");
    expect(equipmentResponse.body.data.equipment.status).toBe("MAINTENANCE");
  });

  it("editar otros campos SIN enviar status tampoco altera el estado automatico", async () => {
    const networkNodeId = await createNodeFixture("J10");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(maintenanceId);

    const node = await prisma.networkNode.findUnique({ where: { id: networkNodeId } });

    const response = await request(app)
      .put(`/api/network-nodes/${networkNodeId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: node.code, name: "Nodo J10 sin status" });

    expect(response.status).toBe(200);
    expect(await readNodeStatus(networkNodeId)).toBe("MAINTENANCE");
  });

  it("un recurso ya liberado vuelve a aceptar los estados manuales normales", async () => {
    const networkNodeId = await createNodeFixture("J11");
    const equipmentId = await createEquipmentFixture(networkNodeId, "J11-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "PREVENTIVE",
      networkNodeId,
    });

    await startMaintenance(maintenanceId);
    await completeMaintenance(maintenanceId);

    expect((await putNode(networkNodeId, { status: "AVAILABLE" })).status).toBe(200);
    expect(
      (await putEquipment(equipmentId, { status: "OPERATIONAL" })).status,
    ).toBe(200);
    expect((await putNode(networkNodeId, { status: "OUT_OF_SERVICE" })).status).toBe(200);
  });
});

describe("K. Traslado de equipo durante una orden activa", () => {
  it("un equipo con orden activa no puede moverse a otro nodo", async () => {
    const originNodeId = await createNodeFixture("K1-ORIG");
    const destinationNodeId = await createNodeFixture("K1-DEST");
    const equipmentId = await createEquipmentFixture(originNodeId, "K1-1");

    const maintenanceId = await createMaintenanceFixture({
      type: "CORRECTIVE",
      equipmentId,
    });

    await startMaintenance(maintenanceId);

    const response = await putEquipment(equipmentId, {
      networkNodeId: destinationNodeId,
    });

    expect(response.status).toBe(409);

    // Nada se movio y ningun estado quedo descolgado.
    const persisted = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { networkNodeId: true },
    });
    expect(persisted.networkNodeId).toBe(originNodeId);
    expect(await readNodeStatus(originNodeId)).toBe("MAINTENANCE");
    expect(await readNodeStatus(destinationNodeId)).toBe("AVAILABLE");
  });

  it("sin orden activa el traslado de nodo sigue permitido", async () => {
    const originNodeId = await createNodeFixture("K2-ORIG");
    const destinationNodeId = await createNodeFixture("K2-DEST");
    const equipmentId = await createEquipmentFixture(originNodeId, "K2-1");

    const response = await putEquipment(equipmentId, {
      networkNodeId: destinationNodeId,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.equipment.networkNodeId).toBe(destinationNodeId);
  });
});
