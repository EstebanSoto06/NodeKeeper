import { z } from "zod";

const MAINTENANCE_TYPES = ["PREVENTIVE", "CORRECTIVE"];

export const maintenanceSchema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .trim()
    .min(1, "Title is required"),
  description: z.string().trim().min(1).optional().nullable(),
  type: z.enum(MAINTENANCE_TYPES),
  scheduledDate: z.coerce.date().optional().nullable(),
  networkNodeId: z.string().trim().min(1).optional().nullable(),
  equipmentId: z.string().trim().min(1).optional().nullable(),
});

// checklistTemplateId solo existe al CREAR: aplicar una plantilla al editar
// una orden reinyectaria tareas en un checklist que el ADMIN ya organizo, y
// para eso existe la operacion explicita
// POST /maintenances/:id/checklist-tasks/apply-template.
//
// Se deja fuera de maintenanceSchema (que sigue rigiendo el PUT) en vez de
// hacerlo opcional en el schema compartido: asi el campo es imposible de
// aceptar por la ruta de actualizacion, no solo improbable.
//
// NOTA: maintenanceSchema no es .strict() -- igual que antes de este cambio
// -- de modo que un checklistTemplateId enviado por error en un PUT se
// ignora en silencio en vez de devolver 400. Es el comportamiento que ya
// tenia cualquier campo extra en esa ruta; documentado en docs/API.md.
export const createMaintenanceSchema = maintenanceSchema.extend({
  checklistTemplateId: z.string().trim().min(1).optional().nullable(),
});
