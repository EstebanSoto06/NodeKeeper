import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Pruebas unitarias con mocks: la logica de reintento de
// runSerializableTransaction se prueba en aislamiento, sin depender de
// generar contencion real de PostgreSQL. La cobertura de concurrencia real
// (Promise.all contra la base de datos) sigue viviendo en las pruebas de
// integracion de cada modulo (checklist-task.test.js, maintenance.test.js).
vi.mock("../config/prisma.js", () => ({
  prisma: { $transaction: vi.fn() },
}));

const { prisma } = await import("../config/prisma.js");
const { runSerializableTransaction } = await import(
  "./serializable-transaction.js"
);

// Simula el error tal como lo produce @prisma/adapter-pg (confirmado
// empiricamente, ver informe de estabilidad) ante un conflicto de
// serializacion real de PostgreSQL (SQLSTATE 40001).
function driverAdapterSerializationConflict() {
  const error = new Error("TransactionWriteConflict");
  error.name = "DriverAdapterError";
  error.cause = {
    originalCode: "40001",
    originalMessage:
      "could not serialize access due to read/write dependencies among transactions",
    kind: "TransactionWriteConflict",
  };
  return error;
}

// Simula la forma clasica que documenta Prisma para el motor sin driver
// adapter: PrismaClientKnownRequestError con codigo P2034. Se fuerza el
// prototipo para que `instanceof Prisma.PrismaClientKnownRequestError` sea
// verdadero sin depender del constructor interno de Prisma.
function classicP2034Conflict() {
  const error = new Error(
    "Transaction failed due to a write conflict or a deadlock. Please retry your transaction",
  );
  Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);
  error.code = "P2034";
  return error;
}

function unrelatedError() {
  return new Error("some other failure unrelated to serialization");
}

describe("runSerializableTransaction", () => {
  beforeEach(() => {
    prisma.$transaction.mockReset();
  });

  it("returns the result on the first attempt when there is no conflict", async () => {
    prisma.$transaction.mockResolvedValueOnce("ok");

    const result = await runSerializableTransaction(async () => "ignored");

    expect(result).toBe("ok");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    const [, options] = prisma.$transaction.mock.calls[0];
    expect(options.isolationLevel).toBe(
      Prisma.TransactionIsolationLevel.Serializable,
    );
  });

  it("retries when it receives a DriverAdapterError serialization conflict (the shape @prisma/adapter-pg actually throws)", async () => {
    prisma.$transaction
      .mockRejectedValueOnce(driverAdapterSerializationConflict())
      .mockResolvedValueOnce("ok-after-retry");

    const result = await runSerializableTransaction(async () => "ignored");

    expect(result).toBe("ok-after-retry");
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("also retries the classic PrismaClientKnownRequestError P2034 shape", async () => {
    prisma.$transaction
      .mockRejectedValueOnce(classicP2034Conflict())
      .mockResolvedValueOnce("ok-after-retry-classic");

    const result = await runSerializableTransaction(async () => "ignored");

    expect(result).toBe("ok-after-retry-classic");
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("succeeds if a later attempt works (fails twice, succeeds on the third)", async () => {
    prisma.$transaction
      .mockRejectedValueOnce(driverAdapterSerializationConflict())
      .mockRejectedValueOnce(driverAdapterSerializationConflict())
      .mockResolvedValueOnce("ok-on-third");

    const result = await runSerializableTransaction(async () => "ignored");

    expect(result).toBe("ok-on-third");
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry errors that are not a serialization conflict", async () => {
    const error = unrelatedError();
    prisma.$transaction.mockRejectedValueOnce(error);

    await expect(
      runSerializableTransaction(async () => "ignored"),
    ).rejects.toBe(error);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns an HTTP 409 after exhausting 3 serialization conflicts", async () => {
    prisma.$transaction
      .mockRejectedValueOnce(driverAdapterSerializationConflict())
      .mockRejectedValueOnce(driverAdapterSerializationConflict())
      .mockRejectedValueOnce(driverAdapterSerializationConflict());

    await expect(
      runSerializableTransaction(async () => "ignored"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('the final error message is exactly "Concurrent modification detected, please retry"', async () => {
    prisma.$transaction
      .mockRejectedValueOnce(driverAdapterSerializationConflict())
      .mockRejectedValueOnce(driverAdapterSerializationConflict())
      .mockRejectedValueOnce(driverAdapterSerializationConflict());

    await expect(
      runSerializableTransaction(async () => "ignored"),
    ).rejects.toThrow("Concurrent modification detected, please retry");
  });
});
