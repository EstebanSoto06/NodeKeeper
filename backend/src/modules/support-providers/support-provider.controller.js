import {
  listSupportProviders,
  getSupportProviderById,
  createSupportProvider,
  updateSupportProvider,
  deleteSupportProvider,
} from "./support-provider.service.js";
import { supportProviderSchema } from "./support-provider.schema.js";

export async function list(req, res, next) {
  try {
    const supportProviders = await listSupportProviders();

    return res.status(200).json({
      success: true,
      message: "Support providers retrieved successfully",
      data: { supportProviders },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const supportProvider = await getSupportProviderById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Support provider retrieved successfully",
      data: { supportProvider },
    });
  } catch (error) {
    return next(error);
  }
}

export async function create(req, res, next) {
  try {
    const data = supportProviderSchema.parse(req.body);
    const supportProvider = await createSupportProvider(data);

    return res.status(201).json({
      success: true,
      message: "Support provider created successfully",
      data: { supportProvider },
    });
  } catch (error) {
    return next(error);
  }
}

export async function update(req, res, next) {
  try {
    const data = supportProviderSchema.parse(req.body);
    const supportProvider = await updateSupportProvider(req.params.id, data);

    return res.status(200).json({
      success: true,
      message: "Support provider updated successfully",
      data: { supportProvider },
    });
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteSupportProvider(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Support provider deleted successfully",
      data: null,
    });
  } catch (error) {
    return next(error);
  }
}
