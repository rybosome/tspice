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

  it("frees a reused cell handle at case end after prior free in the same case", async () => {
    const freeCellMock = vi.fn((_cell: number) => {});
    const backend = {
      kind: "fake",
      newDoubleCell: vi.fn((_size: number): number => 23),
      newIntCell: vi.fn((_size: number): number => 101),
      newWindow: vi.fn((_maxIntervals: number): number => 0),
      card: vi.fn((_handle: number): number => 0),
      size: vi.fn((_handle: number): number => 0),
      freeCell: freeCellMock,
      freeWindow: vi.fn((_window: number) => {}),
    } as unknown as SpiceBackend;

    const input = createBaseInput();
    input.contract.args = [];
    input.args = {};
    input.contract.result = {
      type: "object",
      required: [],
      properties: {},
    };
    input.workflow.steps = [
      {
        op: "allocCell",
        as: "first",
        params: { kind: "double", size: 1 },
      },
      {
        op: "freeCell",
        target: "$refs.first",
      },
      {
        op: "allocCell",
        as: "second",
        params: { kind: "double", size: 1 },
      },
      {
        op: "projectResult",
        out: {},
      },
    ];
    input.workflow.cleanup = [];

    const result = await executeV2CaseWithBackend(backend, input);

    expect(result).toEqual({});
    expect(freeCellMock).toHaveBeenCalledTimes(2);
    expect(freeCellMock).toHaveBeenNthCalledWith(1, 23);
    expect(freeCellMock).toHaveBeenNthCalledWith(2, 23);
  });

  it("frees a reused window handle at case end after prior free in the same case", async () => {
    const freeWindowMock = vi.fn((_window: number) => {});
    const backend = {
      kind: "fake",
      newIntCell: vi.fn((_size: number): number => 101),
      newWindow: vi.fn((_maxIntervals: number): number => 19),
      card: vi.fn((_handle: number): number => 0),
      size: vi.fn((_handle: number): number => 0),
      freeCell: vi.fn((_cell: number) => {}),
      freeWindow: freeWindowMock,
    } as unknown as SpiceBackend;

    const input = createBaseInput();
    input.contract.args = [];
    input.args = {};
    input.contract.result = {
      type: "object",
      required: [],
      properties: {},
    };
    input.workflow.steps = [
      {
        op: "allocWindow",
        as: "first",
        params: { maxIntervals: 1 },
      },
      {
        op: "freeWindow",
        target: "$refs.first",
      },
      {
        op: "allocWindow",
        as: "second",
        params: { maxIntervals: 1 },
      },
      {
        op: "projectResult",
        out: {},
      },
    ];
    input.workflow.cleanup = [];

    const result = await executeV2CaseWithBackend(backend, input);

    expect(result).toEqual({});
    expect(freeWindowMock).toHaveBeenCalledTimes(2);
    expect(freeWindowMock).toHaveBeenNthCalledWith(1, 19);
    expect(freeWindowMock).toHaveBeenNthCalledWith(2, 19);
  });

  it("frees cell/window handles independently when identities collide", async () => {
    const freeCellMock = vi.fn((_cell: number) => {});
    const freeWindowMock = vi.fn((_window: number) => {});
    const backend = {
      kind: "fake",
      newIntCell: vi.fn((_size: number): number => 7),
      newWindow: vi.fn((_maxIntervals: number): number => 7),
      card: vi.fn((_handle: number): number => 0),
      size: vi.fn((_handle: number): number => 0),
      freeCell: freeCellMock,
      freeWindow: freeWindowMock,
    } as unknown as SpiceBackend;

    const input = createBaseInput();
    input.contract.args = [];
    input.args = {};
    input.contract.result = {
      type: "object",
      required: [],
      properties: {},
    };
    input.workflow.steps = [
      {
        op: "allocCell",
        as: "cell",
        params: { kind: "int", size: 1 },
      },
      {
        op: "allocWindow",
        as: "window",
        params: { maxIntervals: 1 },
      },
      {
        op: "projectResult",
        out: {},
      },
    ];
    input.workflow.cleanup = [
      {
        op: "freeCell",
        target: "$refs.cell",
      },
      {
        op: "freeWindow",
        target: "$refs.window",
      },
    ];

    const result = await executeV2CaseWithBackend(backend, input);

    expect(result).toEqual({});
    expect(freeCellMock).toHaveBeenCalledTimes(1);
    expect(freeWindowMock).toHaveBeenCalledTimes(1);
  });

  it("reports invalid_args when card_c is missing as in bypassed schema input", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps[1] = {
      op: "spiceCall",
      call: "card_c",
      in: ["$refs.cell"],
    } as unknown as RunCaseInputV2["workflow"]["steps"][number];

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_args",
      message: 'spiceCall card_c requires an "as" output ref',
    });
  });

  it("reports invalid_args when scard_c includes as in bypassed schema input", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps[1] = {
      op: "spiceCall",
      call: "scard_c",
      in: [0, "$refs.cell"],
      as: "ignored",
    } as unknown as RunCaseInputV2["workflow"]["steps"][number];

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_args",
      message: 'spiceCall scard_c does not allow an "as" output ref',
    });
  });

  it("executes EK fast-write spiceCall workflows and validates readback semantics", async () => {
    const ekopnMock = vi.fn((): number => 101);
    const ekifldMock = vi.fn(() => ({ segno: 5, rcptrs: [0, 0, 0] }));
    const ekacliMock = vi.fn(() => {});
    const ekacldMock = vi.fn(() => {});
    const ekaclcMock = vi.fn(() => {});
    const ekffldMock = vi.fn(() => {});
    const ekclsMock = vi.fn(() => {});
    const furnshMock = vi.fn(() => {});
    const unloadMock = vi.fn(() => {});
    const ekfindMock = vi.fn(() => ({ ok: true as const, nmrows: 3 }));
    const ekgiMock = vi.fn((_selidx: number, row: number) => ({
      found: true as const,
      isNull: false as const,
      value: [1, 2, 3][row] ?? -1,
    }));
    const ekgdMock = vi.fn((_selidx: number, row: number) => ({
      found: true as const,
      isNull: false as const,
      value: [10.5, 20.25, 30][row] ?? NaN,
    }));
    const ekgcMock = vi.fn((_selidx: number, row: number) => ({
      found: true as const,
      isNull: false as const,
      value: ["Alice", "Bob", "Carol"][row] ?? "",
    }));

    const backend = {
      kind: "fake",
      ekopn: ekopnMock,
      ekifld: ekifldMock,
      ekacli: ekacliMock,
      ekacld: ekacldMock,
      ekaclc: ekaclcMock,
      ekffld: ekffldMock,
      ekcls: ekclsMock,
      furnsh: furnshMock,
      unload: unloadMock,
      ekfind: ekfindMock,
      ekgi: ekgiMock,
      ekgd: ekgdMock,
      ekgc: ekgcMock,
    } as unknown as SpiceBackend;

    const input: RunCaseInputV2 = {
      schemaVersion: 2,
      manifest: {
        id: "methods/ek/ekffld@v2",
        kind: "method",
      },
      contract: {
        contractMethod: "ek.ekffld",
        canonicalMethod: "ek.ekffld",
        args: [],
        result: {
          type: "object",
          required: ["validated"],
          properties: {
            validated: { const: true },
          },
        },
      },
      args: {},
      workflow: {
        steps: [
          { op: "spiceCall", call: "ekifld_c", in: [] },
          { op: "spiceCall", call: "ekacli_c", in: [] },
          { op: "spiceCall", call: "ekacld_c", in: [] },
          { op: "spiceCall", call: "ekaclc_c", in: [] },
          { op: "spiceCall", call: "ekffld_c", in: [] },
          { op: "spiceCall", call: "ekfind_c", in: [3] },
          { op: "spiceCall", call: "ekgi_c", in: [0, 1] },
          { op: "spiceCall", call: "ekgd_c", in: [1, 20.25] },
          { op: "spiceCall", call: "ekgc_c", in: [2, "Carol"] },
          { op: "projectResult", out: { validated: true } },
        ],
      },
    };

    const result = await executeV2CaseWithBackend(backend, input);

    expect(result).toEqual({ validated: true });
    expect(ekopnMock).toHaveBeenCalledTimes(1);
    expect(ekifldMock).toHaveBeenCalledTimes(1);
    expect(ekacliMock).toHaveBeenCalledTimes(1);
    expect(ekacldMock).toHaveBeenCalledTimes(1);
    expect(ekaclcMock).toHaveBeenCalledTimes(1);
    expect(ekffldMock).toHaveBeenCalledTimes(1);
    expect(ekfindMock).toHaveBeenCalledTimes(1);
    expect(ekgiMock).toHaveBeenCalledTimes(1);
    expect(ekgdMock).toHaveBeenCalledTimes(1);
    expect(ekgcMock).toHaveBeenCalledTimes(1);
    expect(ekclsMock).toHaveBeenCalledTimes(1);
    expect(unloadMock).toHaveBeenCalledTimes(1);
  });

  it("cleans up EK state when semantic readback verification fails", async () => {
    const ekclsMock = vi.fn(() => {});
    const unloadMock = vi.fn(() => {});
    const backend = {
      kind: "fake",
      ekopn: vi.fn((): number => 101),
      ekifld: vi.fn(() => ({ segno: 5, rcptrs: [0, 0, 0] })),
      ekacli: vi.fn(() => {}),
      ekacld: vi.fn(() => {}),
      ekaclc: vi.fn(() => {}),
      ekffld: vi.fn(() => {}),
      ekcls: ekclsMock,
      furnsh: vi.fn(() => {}),
      unload: unloadMock,
      ekfind: vi.fn(() => ({ ok: true as const, nmrows: 3 })),
      ekgi: vi.fn(() => ({ found: true as const, isNull: false as const, value: 99 })),
    } as unknown as SpiceBackend;

    const input: RunCaseInputV2 = {
      schemaVersion: 2,
      manifest: {
        id: "methods/ek/ekacli@v2",
        kind: "method",
      },
      contract: {
        contractMethod: "ek.ekacli",
        canonicalMethod: "ek.ekacli",
        args: [],
        result: {
          type: "object",
          required: ["validated"],
          properties: {
            validated: { const: true },
          },
        },
      },
      args: {},
      workflow: {
        steps: [
          { op: "spiceCall", call: "ekifld_c", in: [] },
          { op: "spiceCall", call: "ekacli_c", in: [] },
          { op: "spiceCall", call: "ekacld_c", in: [] },
          { op: "spiceCall", call: "ekaclc_c", in: [] },
          { op: "spiceCall", call: "ekffld_c", in: [] },
          { op: "spiceCall", call: "ekfind_c", in: [3] },
          { op: "spiceCall", call: "ekgi_c", in: [0, 1] },
          { op: "projectResult", out: { validated: true } },
        ],
      },
    };

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_request",
      message: expect.stringContaining("spiceCall(ekgi_c) expected 1"),
    });

    expect(ekclsMock).toHaveBeenCalledTimes(1);
    expect(unloadMock).toHaveBeenCalledTimes(1);
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

  it("reports allocWindow.params.maxIntervals validation errors for negative values", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.contract.args = [{ name: "maxIntervals", type: "spiceInt" }];
    input.args = { maxIntervals: -1 };
    input.workflow.steps = [
      {
        op: "allocWindow",
        as: "window",
        params: { maxIntervals: "$args.maxIntervals" },
      },
      {
        op: "projectResult",
        out: {},
      },
    ];

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_args",
      message: "allocWindow.params.maxIntervals must be >= 0",
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
