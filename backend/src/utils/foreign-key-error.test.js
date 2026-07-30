import { describe, expect, it } from "vitest";

import { isForeignKeyConstraintError } from "./foreign-key-error.js";

describe("isForeignKeyConstraintError", () => {
  it("reconoce el codigo clasico de Prisma P2003", () => {
    expect(isForeignKeyConstraintError({ code: "P2003" })).toBe(true);
  });

  it("reconoce un DriverAdapterError-like con cause.originalCode 23001 (restrict_violation)", () => {
    const error = { message: "adapter error", cause: { originalCode: "23001" } };
    expect(isForeignKeyConstraintError(error)).toBe(true);
  });

  it("reconoce un DriverAdapterError-like con cause.code 23001", () => {
    const error = { message: "adapter error", cause: { code: "23001" } };
    expect(isForeignKeyConstraintError(error)).toBe(true);
  });

  it("reconoce SQLSTATE 23503 (foreign_key_violation) via cause.originalCode", () => {
    const error = { cause: { originalCode: "23503" } };
    expect(isForeignKeyConstraintError(error)).toBe(true);
  });

  it("reconoce SQLSTATE 23503 via cause.code", () => {
    const error = { cause: { code: "23503" } };
    expect(isForeignKeyConstraintError(error)).toBe(true);
  });

  it("reconoce el SQLSTATE expuesto directamente en el error, sin cause", () => {
    expect(isForeignKeyConstraintError({ originalCode: "23001" })).toBe(true);
    expect(isForeignKeyConstraintError({ code: "23503" })).toBe(true);
  });

  it("no confunde un error normal con una violacion referencial", () => {
    expect(isForeignKeyConstraintError(new Error("algo distinto fallo"))).toBe(false);
  });

  it("no confunde P2025 (registro no encontrado) con una violacion referencial", () => {
    expect(isForeignKeyConstraintError({ code: "P2025" })).toBe(false);
  });

  it("no confunde un conflicto de serializacion (SQLSTATE 40001) con una violacion referencial", () => {
    expect(isForeignKeyConstraintError({ cause: { originalCode: "40001" } })).toBe(false);
  });

  it("devuelve false para undefined o null sin lanzar", () => {
    expect(isForeignKeyConstraintError(undefined)).toBe(false);
    expect(isForeignKeyConstraintError(null)).toBe(false);
  });
});
