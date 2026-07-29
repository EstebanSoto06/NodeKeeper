import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ALLOWED_EVIDENCE_TYPES,
  buildContentDisposition,
  deleteEvidenceFileIfExists,
  deleteEvidenceFromQuarantine,
  detectRealFileType,
  finalizeUploadedFile,
  getEvidenceFilePath,
  getQuarantineFilePath,
  moveEvidenceToQuarantine,
  restoreEvidenceFromQuarantine,
} from "./evidence-file.js";
import {
  getFakeExecutableBuffer,
  getGenericZipBuffer,
  getMinimalDocxBuffer,
  getMinimalJpegBuffer,
  getMinimalPdfBuffer,
  getMinimalPngBuffer,
} from "../tests/fixtures/file-fixtures.js";

const createdFileNames = [];

async function writeTempFile(buffer) {
  const fileName = `test-${crypto.randomUUID()}`;
  const filePath = getEvidenceFilePath(fileName);
  await fs.writeFile(filePath, buffer);
  createdFileNames.push(fileName);
  return fileName;
}

afterEach(async () => {
  while (createdFileNames.length > 0) {
    const fileName = createdFileNames.pop();
    await deleteEvidenceFileIfExists(fileName);
    await deleteEvidenceFromQuarantine(fileName).catch(() => {});
  }
});

describe("evidence-file utils", () => {
  describe("deteccion real de tipo", () => {
    it("detects a real JPEG", async () => {
      const fileName = await writeTempFile(getMinimalJpegBuffer());
      const result = await detectRealFileType(getEvidenceFilePath(fileName));

      expect(result?.mime).toBe("image/jpeg");
      expect(ALLOWED_EVIDENCE_TYPES[result.mime]).toBeDefined();
    });

    it("detects a real PNG", async () => {
      const fileName = await writeTempFile(getMinimalPngBuffer());
      const result = await detectRealFileType(getEvidenceFilePath(fileName));

      expect(result?.mime).toBe("image/png");
    });

    it("detects a real PDF", async () => {
      const fileName = await writeTempFile(getMinimalPdfBuffer());
      const result = await detectRealFileType(getEvidenceFilePath(fileName));

      expect(result?.mime).toBe("application/pdf");
    });

    it("detects a real DOCX", async () => {
      const fileName = await writeTempFile(getMinimalDocxBuffer());
      const result = await detectRealFileType(getEvidenceFilePath(fileName));

      expect(result?.mime).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
    });

    it("does not detect a generic ZIP as DOCX", async () => {
      const fileName = await writeTempFile(getGenericZipBuffer());
      const result = await detectRealFileType(getEvidenceFilePath(fileName));

      expect(result?.mime).not.toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      expect(ALLOWED_EVIDENCE_TYPES[result?.mime]).toBeUndefined();
    });

    it("does not recognize a fake executable renamed as jpg", async () => {
      const fileName = await writeTempFile(getFakeExecutableBuffer());
      const result = await detectRealFileType(getEvidenceFilePath(fileName));

      expect(ALLOWED_EVIDENCE_TYPES[result?.mime]).toBeUndefined();
    });
  });

  describe("generacion de nombres fisicos", () => {
    it("finalizeUploadedFile renames using a random name plus the controlled extension", async () => {
      const tempFileName = await writeTempFile(getMinimalPdfBuffer());

      const storedName = await finalizeUploadedFile(tempFileName, "pdf");
      createdFileNames.push(storedName);

      expect(storedName).toMatch(
        /^[0-9a-f-]{36}\.pdf$/i,
      );
      expect(storedName).not.toContain(tempFileName);

      const finalContents = await fs.readFile(getEvidenceFilePath(storedName));
      expect(finalContents.equals(getMinimalPdfBuffer())).toBe(true);

      await expect(
        fs.access(getEvidenceFilePath(tempFileName)),
      ).rejects.toThrow();
    });

    it("never derives the stored name from user-controlled input", async () => {
      const tempFileName = await writeTempFile(getMinimalJpegBuffer());
      const storedName = await finalizeUploadedFile(tempFileName, "jpg");
      createdFileNames.push(storedName);

      expect(storedName).not.toMatch(/\.\./);
      expect(storedName).not.toMatch(/[\\/]/);
    });
  });

  describe("Content-Disposition seguro", () => {
    it("builds an inline disposition with a sanitized ascii fallback", () => {
      const header = buildContentDisposition("inline", 'evidence "one".jpg');

      expect(header).toMatch(/^inline;/);
      expect(header).toContain('filename="evidence _one_.jpg"');
      expect(header).toContain("filename*=UTF-8''");
    });

    it("strips path components from a traversal-style original name", () => {
      const header = buildContentDisposition(
        "attachment",
        "../../../etc/passwd",
      );

      expect(header).not.toContain("../");
      expect(header).toContain('filename="passwd"');
    });

    it("strips path components from an absolute path original name", () => {
      const header = buildContentDisposition(
        "attachment",
        "C:\\Windows\\System32\\evil.docx",
      );

      expect(header).not.toContain("C:\\Windows");
    });

    it("encodes non-ascii characters for the UTF-8 filename* variant", () => {
      const header = buildContentDisposition("inline", "informe-año.pdf");

      expect(header).toContain("filename*=UTF-8''informe-a%C3%B1o.pdf");
    });
  });

  describe("cuarentena", () => {
    it("moves a file to quarantine and restores it back", async () => {
      const fileName = await writeTempFile(getMinimalPngBuffer());

      await moveEvidenceToQuarantine(fileName);
      await expect(fs.access(getEvidenceFilePath(fileName))).rejects.toThrow();
      await expect(fs.access(getQuarantineFilePath(fileName))).resolves.toBeUndefined();

      await restoreEvidenceFromQuarantine(fileName);
      await expect(fs.access(getEvidenceFilePath(fileName))).resolves.toBeUndefined();
      await expect(fs.access(getQuarantineFilePath(fileName))).rejects.toThrow();
    });

    it("permanently deletes a quarantined file", async () => {
      const fileName = await writeTempFile(getMinimalPngBuffer());

      await moveEvidenceToQuarantine(fileName);
      await deleteEvidenceFromQuarantine(fileName);

      await expect(fs.access(getQuarantineFilePath(fileName))).rejects.toThrow();
    });

    it("propagates ENOENT when the source file does not exist", async () => {
      await expect(
        moveEvidenceToQuarantine("does-not-exist-evidence-file"),
      ).rejects.toMatchObject({ code: "ENOENT" });
    });

    it("resolves quarantine paths to a distinct location that getEvidenceFilePath never returns", () => {
      const quarantinePath = getQuarantineFilePath("some-file.pdf");
      const evidencePath = getEvidenceFilePath("some-file.pdf");

      // El endpoint de descarga solo llama a getEvidenceFilePath(storedName);
      // esto confirma que, para el mismo storedName, jamas coincide con la
      // ruta fisica real de cuarentena.
      expect(quarantinePath).not.toBe(evidencePath);
      expect(path.basename(path.dirname(quarantinePath))).toBe(".quarantine");
      expect(path.basename(path.dirname(evidencePath))).not.toBe(".quarantine");
    });
  });

  describe("limpieza idempotente", () => {
    it("deleteEvidenceFileIfExists does not throw when the file is already gone", async () => {
      await expect(
        deleteEvidenceFileIfExists("already-gone-evidence-file"),
      ).resolves.toBeUndefined();
    });
  });
});
