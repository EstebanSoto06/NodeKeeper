import {
  listEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from "./equipment.service.js";
import { equipmentSchema } from "./equipment.schema.js";

export async function list(req, res, next) {
  try {
    const equipment = await listEquipment();

    return res.status(200).json({
      success: true,
      message: "Equipment retrieved successfully",
      data: { equipment },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const equipment = await getEquipmentById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Equipment retrieved successfully",
      data: { equipment },
    });
  } catch (error) {
    return next(error);
  }
}

export async function create(req, res, next) {
  try {
    const data = equipmentSchema.parse(req.body);
    const equipment = await createEquipment(data);

    return res.status(201).json({
      success: true,
      message: "Equipment created successfully",
      data: { equipment },
    });
  } catch (error) {
    return next(error);
  }
}

export async function update(req, res, next) {
  try {
    const data = equipmentSchema.parse(req.body);
    const equipment = await updateEquipment(req.params.id, data);

    return res.status(200).json({
      success: true,
      message: "Equipment updated successfully",
      data: { equipment },
    });
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteEquipment(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Equipment deleted successfully",
      data: null,
    });
  } catch (error) {
    return next(error);
  }
}
