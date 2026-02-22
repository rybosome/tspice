import type { SpiceBackend } from "@rybosome/tspice";
import { describe, expect, it, vi } from "vitest";

import { executeV2CaseWithBackend, validateV2CasePreflight } from "../../src/runners/v2Executor.js";
import type { RunCaseInputV2 } from "../../src/runners/types.js";

type TestCell = {
  size: number;
  card: number;
};

type BackendStub = {
  backend: SpiceBackend;
  freeCellMock: ReturnType<typeof vi.fn>;
};

function createBackendStub(): BackendStub {
  const freeCellMock = vi.fn((_cell: TestCell) => {});
  const backend = {
    kind: "fake",
    newIntCell: vi.fn((size: number): TestCell => ({ size, card: 0 })),
    card: vi.fn((cell: TestCell): number => cell.card),
    size: vi.fn((cell: TestCell): number => cell.size),
    freeCell: freeCellMock,
  } as unknown as SpiceBackend;

  return { backend, freeCellMock };
}

function createBaseInput(): RunCaseInputV2 {
  return {
    schemaVersion: 2,
    manifest: {
      id: "methods/cells-windows/newIntCell@v2",
      kind: "method",
    },
    contract: {
      contractMethod: "cells-windows.newIntCell",
      canonicalMethod: "cells-windows.newIntCell",
      aliases: [],
      args: [{ name: "size", type: "spiceInt", constraints: { min: 0 } }],
      result: {
        type: "object",
        required: ["size"],
        properties: {
          size: { type: "spiceInt" },
        },
      },
      errors: [],
    },
    args: { size: 3 },
    workflow: {
      steps: [
        {
          op: "allocCell",
          as: "cell",
          params: { kind: "int", size: "$args.size" },
        },
        {
          op: "spiceCall",
          call: "size_c",
          in: ["$refs.cell"],
          as: "size",
        },
        {
          op: "projectResult",
          out: { size: "$refs.size" },
        },
      ],
      cleanup: [{ op: "freeCell", target: "$refs.cell" }],
    },
  };
}

describe("executeV2CaseWithBackend", () => {
  it("rejects duplicate v2 ref names", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps.splice(2, 0, {
      op: "spiceCall",
      call: "card_c",
      in: ["$refs.cell"],
      as: "size",
    });

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_request",
      message: expect.stringContaining("duplicate ref name"),
    });
  });

  it("allows reusing a ref name after freeCell", async () => {
    const { backend, freeCellMock } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps = [
      {
        op: "allocCell",
        as: "cell",
        params: { kind: "int", size: "$args.size" },
      },
      {
        op: "freeCell",
        target: "$refs.cell",
      },
      {
        op: "allocCell",
        as: "cell",
        params: { kind: "int", size: 2 },
      },
      {
        op: "spiceCall",
        call: "size_c",
        in: ["$refs.cell"],
        as: "size",
      },
      {
        op: "projectResult",
        out: { size: "$refs.size" },
      },
    ];

    const result = await executeV2CaseWithBackend(backend, input);

    expect(result).toEqual({ size: 2 });
    expect(freeCellMock).toHaveBeenCalledTimes(2);
  });

  it("rejects duplicate contract arg names", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.contract.args = [
      { name: "size", type: "spiceInt" },
      { name: "size", type: "spiceInt" },
    ];

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_request",
      message: expect.stringContaining("Duplicate contract arg name"),
    });
  });

  it("reports allocCell.params.size validation errors for negative sizes", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.contract.args = [{ name: "size", type: "spiceInt" }];
    input.args = { size: -1 };

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_args",
      message: "allocCell.params.size must be >= 0",
    });
  });

  it("rejects unknown v2 args during shared preflight validation", () => {
    const input = createBaseInput();
    input.args = {
      size: 3,
      extra: 1,
    };

    try {
      validateV2CasePreflight(input);
      throw new Error("Expected validateV2CasePreflight to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "invalid_args",
        message: expect.stringContaining("unknown key"),
      });
    }
  });
});
