import {
  listMaintenances,
  getMaintenanceById,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
  startMaintenance,
  completeMaintenance,
} from "./maintenance.service.js";
import { maintenanceSchema } from "./maintenance.schema.js";

export async function list(req, res, next) {
  try {
    const maintenances = await listMaintenances();

    return res.status(200).json({
      success: true,
      message: "Maintenances retrieved successfully",
      data: { maintenances },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const maintenance = await getMaintenanceById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Maintenance retrieved successfully",
      data: { maintenance },
    });
  } catch (error) {
    return next(error);
  }
}

export async function create(req, res, next) {
  try {
    const data = maintenanceSchema.parse(req.body);
    const maintenance = await createMaintenance(data, req.user.id);

    return res.status(201).json({
      success: true,
      message: "Maintenance created successfully",
      data: { maintenance },
    });
  } catch (error) {
    return next(error);
  }
}

export async function update(req, res, next) {
  try {
    const data = maintenanceSchema.parse(req.body);
    const maintenance = await updateMaintenance(req.params.id, data);

    return res.status(200).json({
      success: true,
      message: "Maintenance updated successfully",
      data: { maintenance },
    });
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteMaintenance(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Maintenance deleted successfully",
      data: null,
    });
  } catch (error) {
    return next(error);
  }
}

export async function start(req, res, next) {
  try {
    const maintenance = await startMaintenance(req.params.id, req.user.id);

    return res.status(200).json({
      success: true,
      message: "Maintenance started successfully",
      data: { maintenance },
    });
  } catch (error) {
    return next(error);
  }
}

export async function complete(req, res, next) {
  try {
    const maintenance = await completeMaintenance(req.params.id, req.user.id);

    return res.status(200).json({
      success: true,
      message: "Maintenance completed successfully",
      data: { maintenance },
    });
  } catch (error) {
    return next(error);
  }
}
