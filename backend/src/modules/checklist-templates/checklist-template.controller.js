import {
  listChecklistTemplates,
  getChecklistTemplateById,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
} from "./checklist-template.service.js";
import {
  createChecklistTemplateSchema,
  updateChecklistTemplateSchema,
} from "./checklist-template.schema.js";

export async function list(req, res, next) {
  try {
    const checklistTemplates = await listChecklistTemplates();

    return res.status(200).json({
      success: true,
      message: "Checklist templates retrieved successfully",
      data: { checklistTemplates },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const checklistTemplate = await getChecklistTemplateById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Checklist template retrieved successfully",
      data: { checklistTemplate },
    });
  } catch (error) {
    return next(error);
  }
}

export async function create(req, res, next) {
  try {
    // El payload se toma SIEMPRE del schema parseado, nunca de req.body
    // directo: los schemas son .strict(), asi que un campo no declarado
    // (createdById, id, timestamps) hace fallar la validacion con 400 en vez
    // de colarse hasta Prisma. El createdById lo pone el servidor a partir
    // del token, nunca el cliente.
    const data = createChecklistTemplateSchema.parse(req.body);
    const checklistTemplate = await createChecklistTemplate(data, req.user.id);

    return res.status(201).json({
      success: true,
      message: "Checklist template created successfully",
      data: { checklistTemplate },
    });
  } catch (error) {
    return next(error);
  }
}

export async function update(req, res, next) {
  try {
    const data = updateChecklistTemplateSchema.parse(req.body);
    const checklistTemplate = await updateChecklistTemplate(
      req.params.id,
      data,
    );

    return res.status(200).json({
      success: true,
      message: "Checklist template updated successfully",
      data: { checklistTemplate },
    });
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteChecklistTemplate(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Checklist template deleted successfully",
      data: null,
    });
  } catch (error) {
    return next(error);
  }
}
