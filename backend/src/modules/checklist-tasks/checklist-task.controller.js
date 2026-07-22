import {
  listChecklistTasks,
  createChecklistTask,
  updateChecklistTask,
  deleteChecklistTask,
  setChecklistTaskStatus,
} from "./checklist-task.service.js";
import {
  createChecklistTaskSchema,
  updateChecklistTaskSchema,
  checklistTaskStatusSchema,
} from "./checklist-task.schema.js";

export async function list(req, res, next) {
  try {
    const checklistTasks = await listChecklistTasks(req.params.maintenanceId);

    return res.status(200).json({
      success: true,
      message: "Checklist tasks retrieved successfully",
      data: { checklistTasks },
    });
  } catch (error) {
    return next(error);
  }
}

export async function create(req, res, next) {
  try {
    const data = createChecklistTaskSchema.parse(req.body);
    const checklistTask = await createChecklistTask(
      req.params.maintenanceId,
      data,
    );

    return res.status(201).json({
      success: true,
      message: "Checklist task created successfully",
      data: { checklistTask },
    });
  } catch (error) {
    return next(error);
  }
}

export async function update(req, res, next) {
  try {
    const data = updateChecklistTaskSchema.parse(req.body);
    const checklistTask = await updateChecklistTask(
      req.params.maintenanceId,
      req.params.taskId,
      data,
    );

    return res.status(200).json({
      success: true,
      message: "Checklist task updated successfully",
      data: { checklistTask },
    });
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteChecklistTask(req.params.maintenanceId, req.params.taskId);

    return res.status(200).json({
      success: true,
      message: "Checklist task deleted successfully",
      data: null,
    });
  } catch (error) {
    return next(error);
  }
}

export async function setStatus(req, res, next) {
  try {
    const data = checklistTaskStatusSchema.parse(req.body);
    const checklistTask = await setChecklistTaskStatus(
      req.params.maintenanceId,
      req.params.taskId,
      data.isCompleted,
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      message: "Checklist task status updated successfully",
      data: { checklistTask },
    });
  } catch (error) {
    return next(error);
  }
}
