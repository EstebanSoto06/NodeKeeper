import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../app.js";
import { prisma } from "../../config/prisma.js";

// Mismas dependencias que checklist-task.test.js / maintenance.test.js: los
// usuarios del seed (prisma/seed.js) y las variables SEED_ADMIN_PASSWORD /
// SEED_OPERATOR_PASSWORD.
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

const TEMPLATES_URL = "/api/checklist-templates";

const createdTemplateIds = [];

let adminToken;
let operatorToken;

async function loginAs(email, password) {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  return response.body.data.token;
}

function uniqueName(prefix = "Plantilla QA") {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createTemplate(overrides = {}, token = adminToken) {
  const response = await request(app)
    .post(TEMPLATES_URL)
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: uniqueName(),
      description: "Plantilla creada por pruebas automatizadas",
      items: [
        { description: "Revisar voltaje de entrada" },
        { description: "Revisar baterias" },
        { description: "Limpiar equipo" },
      ],
      ...overrides,
    });

  const id = response.body?.data?.checklistTemplate?.id;

  if (id) {
    createdTemplateIds.push(id);
  }

  return response;
}

beforeAll(async () => {
  adminToken = await loginAs(ADMIN_EMAIL, adminPassword);
  operatorToken = await loginAs(OPERATOR_EMAIL, operatorPassword);
});

afterAll(async () => {
  // Los ChecklistTemplateItem se eliminan en cascada con su plantilla.
  if (createdTemplateIds.length > 0) {
    await prisma.checklistTemplate.deleteMany({
      where: { id: { in: createdTemplateIds } },
    });
  }
});

describe("Checklist template routes", () => {
  describe("autenticacion y roles", () => {
    it("rechaza con 401 cualquier ruta sin token", async () => {
      const responses = await Promise.all([
        request(app).get(TEMPLATES_URL),
        request(app).get(`${TEMPLATES_URL}/some-id`),
        request(app).post(TEMPLATES_URL).send({ name: "X", items: [] }),
        request(app).put(`${TEMPLATES_URL}/some-id`).send({ name: "X", items: [] }),
        request(app).delete(`${TEMPLATES_URL}/some-id`),
      ]);

      responses.forEach((response) => {
        expect(response.status).toBe(401);
      });
    });

    it("rechaza con 403 a un OPERATOR en TODAS las rutas, incluidas las de lectura", async () => {
      const created = await createTemplate();
      const templateId = created.body.data.checklistTemplate.id;

      const [listResponse, detailResponse, createResponse, updateResponse, deleteResponse] =
        await Promise.all([
          request(app)
            .get(TEMPLATES_URL)
            .set("Authorization", `Bearer ${operatorToken}`),
          request(app)
            .get(`${TEMPLATES_URL}/${templateId}`)
            .set("Authorization", `Bearer ${operatorToken}`),
          request(app)
            .post(TEMPLATES_URL)
            .set("Authorization", `Bearer ${operatorToken}`)
            .send({ name: uniqueName(), items: [{ description: "Tarea" }] }),
          request(app)
            .put(`${TEMPLATES_URL}/${templateId}`)
            .set("Authorization", `Bearer ${operatorToken}`)
            .send({ name: uniqueName(), items: [{ description: "Tarea" }] }),
          request(app)
            .delete(`${TEMPLATES_URL}/${templateId}`)
            .set("Authorization", `Bearer ${operatorToken}`),
        ]);

      expect(listResponse.status).toBe(403);
      expect(detailResponse.status).toBe(403);
      expect(createResponse.status).toBe(403);
      expect(updateResponse.status).toBe(403);
      expect(deleteResponse.status).toBe(403);

      // El intento de borrado de un OPERATOR no debe haber surtido efecto.
      const stillThere = await prisma.checklistTemplate.findUnique({
        where: { id: templateId },
      });
      expect(stillThere).not.toBeNull();
    });
  });

  describe("creacion", () => {
    it("crea una plantilla con multiples tareas y las devuelve ordenadas", async () => {
      const name = uniqueName();
      const response = await createTemplate({
        name,
        items: [
          { description: "Primera" },
          { description: "Segunda" },
          { description: "Tercera" },
        ],
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      const template = response.body.data.checklistTemplate;
      expect(template.name).toBe(name);
      expect(template.items).toHaveLength(3);
      expect(template.items.map((item) => item.description)).toEqual([
        "Primera",
        "Segunda",
        "Tercera",
      ]);
      // El sortOrder lo deriva el servidor del indice del array.
      expect(template.items.map((item) => item.sortOrder)).toEqual([0, 1, 2]);
    });

    it("registra el usuario creador a partir del token, no del payload", async () => {
      const response = await createTemplate();

      expect(response.status).toBe(201);
      expect(response.body.data.checklistTemplate.createdBy.email).toBe(ADMIN_EMAIL);
    });

    it("no expone passwordHash en createdBy", async () => {
      const response = await createTemplate();

      expect(response.body.data.checklistTemplate.createdBy).not.toHaveProperty(
        "passwordHash",
      );
      expect(Object.keys(response.body.data.checklistTemplate.createdBy).sort()).toEqual([
        "email",
        "id",
        "name",
        "role",
      ]);
    });

    it("aplica trim al nombre y a las descripciones, conservando los acentos", async () => {
      const response = await createTemplate({
        name: `   ${uniqueName("Revisión Trimestral")}   `,
        items: [{ description: "   Revisar baterías   " }],
      });

      expect(response.status).toBe(201);

      const template = response.body.data.checklistTemplate;
      expect(template.name).not.toMatch(/^\s|\s$/);
      expect(template.name).toContain("Revisión Trimestral");
      expect(template.items[0].description).toBe("Revisar baterías");
    });
  });

  describe("validaciones", () => {
    it("rechaza un nombre ausente, vacio o solo espacios", async () => {
      const [missing, empty, blank] = await Promise.all([
        createTemplate({ name: undefined }),
        createTemplate({ name: "" }),
        createTemplate({ name: "    " }),
      ]);

      [missing, empty, blank].forEach((response) => {
        expect(response.status).toBe(400);
        expect(response.body.errors.some((e) => e.path === "name")).toBe(true);
      });
    });

    it("rechaza una plantilla sin ninguna tarea", async () => {
      const [emptyArray, missingItems] = await Promise.all([
        createTemplate({ items: [] }),
        createTemplate({ items: undefined }),
      ]);

      expect(emptyArray.status).toBe(400);
      expect(emptyArray.body.errors.some((e) => e.path === "items")).toBe(true);
      expect(missingItems.status).toBe(400);
    });

    it("rechaza una tarea con descripcion vacia o solo espacios", async () => {
      const response = await createTemplate({
        items: [{ description: "Valida" }, { description: "   " }],
      });

      expect(response.status).toBe(400);
      expect(
        response.body.errors.some((e) => e.path === "items.1.description"),
      ).toBe(true);
    });

    it("rechaza tareas duplicadas dentro de la misma plantilla tras normalizar", async () => {
      const response = await createTemplate({
        items: [
          { description: "Revisar baterías" },
          { description: "Limpiar equipo" },
          { description: "   revisar    BATERÍAS   " },
        ],
      });

      expect(response.status).toBe(400);
      expect(
        response.body.errors.some((e) => e.path === "items.2.description"),
      ).toBe(true);
    });

    it("permite tareas que solo difieren en acentos: son palabras distintas", async () => {
      const response = await createTemplate({
        items: [{ description: "Revisión general" }, { description: "Revision general" }],
      });

      expect(response.status).toBe(201);
      expect(response.body.data.checklistTemplate.items).toHaveLength(2);
    });

    it("rechaza campos desconocidos en el cuerpo (schemas strict)", async () => {
      const [extraOnTemplate, extraOnItem] = await Promise.all([
        createTemplate({ createdById: "intento-de-suplantacion" }),
        createTemplate({ items: [{ description: "Tarea", sortOrder: 99 }] }),
      ]);

      expect(extraOnTemplate.status).toBe(400);
      expect(extraOnItem.status).toBe(400);
    });
  });

  describe("unicidad del nombre", () => {
    it("rechaza con 409 un nombre exactamente duplicado", async () => {
      const name = uniqueName();
      const first = await createTemplate({ name });
      expect(first.status).toBe(201);

      const second = await createTemplate({ name });
      expect(second.status).toBe(409);
      expect(second.body.message).toMatch(/already exists/i);
    });

    it("rechaza con 409 un nombre duplicado ignorando mayusculas y minusculas", async () => {
      const name = uniqueName("Mantenimiento UPS");
      const first = await createTemplate({ name });
      expect(first.status).toBe(201);

      const second = await createTemplate({ name: name.toLowerCase() });
      expect(second.status).toBe(409);

      const third = await createTemplate({ name: name.toUpperCase() });
      expect(third.status).toBe(409);
    });

    it("permite conservar su propio nombre al editar una plantilla", async () => {
      const name = uniqueName();
      const created = await createTemplate({ name });
      const templateId = created.body.data.checklistTemplate.id;

      const response = await request(app)
        .put(`${TEMPLATES_URL}/${templateId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name, items: [{ description: "Unica tarea" }] });

      expect(response.status).toBe(200);
      expect(response.body.data.checklistTemplate.name).toBe(name);
    });

    it("rechaza con 409 al editar tomando el nombre de OTRA plantilla", async () => {
      const [first, second] = await Promise.all([createTemplate(), createTemplate()]);
      const firstName = first.body.data.checklistTemplate.name;
      const secondId = second.body.data.checklistTemplate.id;

      const response = await request(app)
        .put(`${TEMPLATES_URL}/${secondId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: firstName.toUpperCase(),
          items: [{ description: "Tarea" }],
        });

      expect(response.status).toBe(409);
    });
  });

  describe("lectura", () => {
    it("lista las plantillas con sus items", async () => {
      const created = await createTemplate();
      const templateId = created.body.data.checklistTemplate.id;

      const response = await request(app)
        .get(TEMPLATES_URL)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      const found = response.body.data.checklistTemplates.find(
        (template) => template.id === templateId,
      );
      expect(found).toBeDefined();
      expect(found.items).toHaveLength(3);
    });

    it("devuelve el detalle de una plantilla", async () => {
      const created = await createTemplate();
      const templateId = created.body.data.checklistTemplate.id;

      const response = await request(app)
        .get(`${TEMPLATES_URL}/${templateId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.checklistTemplate.id).toBe(templateId);
    });

    it("devuelve 404 para una plantilla inexistente en GET, PUT y DELETE", async () => {
      const missingId = "plantilla-que-no-existe";

      const [detail, update, remove] = await Promise.all([
        request(app)
          .get(`${TEMPLATES_URL}/${missingId}`)
          .set("Authorization", `Bearer ${adminToken}`),
        request(app)
          .put(`${TEMPLATES_URL}/${missingId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ name: uniqueName(), items: [{ description: "Tarea" }] }),
        request(app)
          .delete(`${TEMPLATES_URL}/${missingId}`)
          .set("Authorization", `Bearer ${adminToken}`),
      ]);

      expect(detail.status).toBe(404);
      expect(update.status).toBe(404);
      expect(remove.status).toBe(404);
    });
  });

  describe("edicion", () => {
    it("reemplaza el conjunto completo de items (agregar, quitar y reordenar)", async () => {
      const created = await createTemplate();
      const templateId = created.body.data.checklistTemplate.id;
      const name = created.body.data.checklistTemplate.name;

      const response = await request(app)
        .put(`${TEMPLATES_URL}/${templateId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name,
          description: null,
          items: [
            { description: "Limpiar equipo" },
            { description: "Tarea nueva" },
            { description: "Revisar voltaje de entrada" },
          ],
        });

      expect(response.status).toBe(200);

      const template = response.body.data.checklistTemplate;
      expect(template.items.map((item) => item.description)).toEqual([
        "Limpiar equipo",
        "Tarea nueva",
        "Revisar voltaje de entrada",
      ]);
      expect(template.items.map((item) => item.sortOrder)).toEqual([0, 1, 2]);

      // No deben quedar items huerfanos de la version anterior.
      const itemCount = await prisma.checklistTemplateItem.count({
        where: { templateId },
      });
      expect(itemCount).toBe(3);
    });

    it("rechaza dejar una plantilla sin tareas al editarla", async () => {
      const created = await createTemplate();
      const templateId = created.body.data.checklistTemplate.id;

      const response = await request(app)
        .put(`${TEMPLATES_URL}/${templateId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: created.body.data.checklistTemplate.name, items: [] });

      expect(response.status).toBe(400);

      // La plantilla conserva sus items originales: la edicion no se aplico.
      const itemCount = await prisma.checklistTemplateItem.count({
        where: { templateId },
      });
      expect(itemCount).toBe(3);
    });
  });

  describe("eliminacion", () => {
    it("elimina la plantilla y sus items en cascada", async () => {
      const created = await createTemplate();
      const templateId = created.body.data.checklistTemplate.id;

      const response = await request(app)
        .delete(`${TEMPLATES_URL}/${templateId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      const template = await prisma.checklistTemplate.findUnique({
        where: { id: templateId },
      });
      expect(template).toBeNull();

      const itemCount = await prisma.checklistTemplateItem.count({
        where: { templateId },
      });
      expect(itemCount).toBe(0);
    });
  });
});
