import {
  createEvidence,
  deleteEvidence,
  getEvidenceFileForDownload,
  listEvidences,
} from "./evidence.service.js";
import { buildContentDisposition } from "../../utils/evidence-file.js";

export async function list(req, res, next) {
  try {
    const evidences = await listEvidences(req.params.maintenanceId);

    return res.status(200).json({
      success: true,
      message: "Evidences retrieved successfully",
      data: { evidences },
    });
  } catch (error) {
    return next(error);
  }
}

export async function upload(req, res, next) {
  try {
    const evidence = await createEvidence(
      req.params.maintenanceId,
      req.user.id,
      req.file,
    );

    return res.status(201).json({
      success: true,
      message: "Evidence uploaded successfully",
      data: { evidence },
    });
  } catch (error) {
    return next(error);
  }
}

export async function download(req, res, next) {
  try {
    const { filePath, mimeType, originalName, disposition } =
      await getEvidenceFileForDownload(
        req.params.maintenanceId,
        req.params.evidenceId,
      );

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      buildContentDisposition(disposition, originalName),
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        return next(error);
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteEvidence(req.params.maintenanceId, req.params.evidenceId);

    return res.status(200).json({
      success: true,
      message: "Evidence deleted successfully",
      data: null,
    });
  } catch (error) {
    return next(error);
  }
}
