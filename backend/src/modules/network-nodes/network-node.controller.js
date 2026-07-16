import {
  listNetworkNodes,
  getNetworkNodeMap,
  getNetworkNodeById,
  createNetworkNode,
  updateNetworkNode,
  deleteNetworkNode,
} from "./network-node.service.js";
import { networkNodeSchema } from "./network-node.schema.js";

export async function list(req, res, next) {
  try {
    const networkNodes = await listNetworkNodes();

    return res.status(200).json({
      success: true,
      message: "Network nodes retrieved successfully",
      data: { networkNodes },
    });
  } catch (error) {
    return next(error);
  }
}

export async function map(req, res, next) {
  try {
    const networkNodes = await getNetworkNodeMap();

    return res.status(200).json({
      success: true,
      message: "Network node map data retrieved successfully",
      data: { networkNodes },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const networkNode = await getNetworkNodeById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Network node retrieved successfully",
      data: { networkNode },
    });
  } catch (error) {
    return next(error);
  }
}

export async function create(req, res, next) {
  try {
    const data = networkNodeSchema.parse(req.body);
    const networkNode = await createNetworkNode(data);

    return res.status(201).json({
      success: true,
      message: "Network node created successfully",
      data: { networkNode },
    });
  } catch (error) {
    return next(error);
  }
}

export async function update(req, res, next) {
  try {
    const data = networkNodeSchema.parse(req.body);
    const networkNode = await updateNetworkNode(req.params.id, data);

    return res.status(200).json({
      success: true,
      message: "Network node updated successfully",
      data: { networkNode },
    });
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteNetworkNode(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Network node deleted successfully",
      data: null,
    });
  } catch (error) {
    return next(error);
  }
}
