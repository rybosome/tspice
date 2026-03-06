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
    schemaVersion: 3,
    manifest: {
      id: "methods/cells-windows/newIntCell@v3",
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
          op: "call",
          fn: "cells-windows.size",
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
  it("fails explicitly on script workflow steps instead of treating them as regular call ops", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();

    input.workflow.steps = [
      {
        op: "script",
        in: {
          size: "$args.size",
        },
        code: "return { doubled: size * 2 };",
        as: "rawScriptResult",
        out: {
          doubled: "doubled",
        },
      },
      {
        op: "projectResult",
        out: {
          size: "$refs.doubled",
        },
      },
    ];
    input.workflow.cleanup = [];

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_request",
      message: expect.stringContaining("script"),
    });
  });

  it("rejects duplicate v2 ref names", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps.splice(2, 0, {
      op: "call",
      fn: "cells-windows.card",
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
        op: "call",
        fn: "cells-windows.size",
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

  it("executes generic DSK workflow ops with descriptor projection and named outs", async () => {
    const dskDescriptor = {
      surfce: 401,
      center: 499,
      dclass: 1,
      dtype: 2,
      frmcde: 10013,
      corsys: 1,
      corpar: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      co1min: 0,
      co1max: 1,
      co2min: 0,
      co2max: 1,
      co3min: 0,
      co3max: 1,
      start: 0,
      stop: 1,
    };

    const dlabfsDescr = {
      bwdptr: 0,
      fwdptr: 0,
      ibase: 0,
      isize: 1,
      dbase: 0,
      dsize: 1,
      cbase: 0,
      csize: 1,
    };

    const raw = {
      dskopn: vi.fn((_path: string, _ifname: string, _ncomch: number) => 12),
      dskmi2: vi.fn(() => ({ spaixd: [1], spaixi: [1] })),
      dskw02: vi.fn(() => {}),
      dascls: vi.fn((_handle: number) => {}),
      dasopr: vi.fn((_path: string) => 77),
      dlabfs: vi.fn((_handle: number) => ({ found: true as const, descr: dlabfsDescr })),
      dskgd: vi.fn((_handle: number, _descr: unknown) => dskDescriptor),
      dskb02: vi.fn((_handle: number, _descr: unknown) => ({
          nv: 8,
          np: 6,
          nvxtot: 8,
          vtxbds: [
            [0, 1],
            [0, 1],
            [0, 1],
          ],
          voxsiz: 1,
          voxori: [0, 0, 0],
          vgrext: [1, 1, 1],
          cgscal: 1,
          vtxnpl: 3,
          voxnpt: 4,
          voxnpl: 5,
        })),
    };
    const kit = {
      newIntCell: vi.fn((_size: number) => ({ size: 0, card: 0 })),
      newDoubleCell: vi.fn((_size: number) => ({ size: 0, card: 0 })),
      newCharCell: vi.fn((_size: number, _length: number) => ({ size: 0, card: 0 })),
      newWindow: vi.fn((_maxIntervals: number) => ({ card: 0 })),
      freeCell: vi.fn(() => {}),
      freeWindow: vi.fn(() => {}),
      readVirtualOutput: vi.fn((_output: { kind: string; path: string }) => new Uint8Array([1])),
    };

    const backend = {
      kind: "node",
      raw,
      kit,
    } as unknown as SpiceBackend;

    const input: RunCaseInputV2 = {
      schemaVersion: 3,
      manifest: {
        id: "methods/dsk/dskb02@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "dsk.dskb02",
        canonicalMethod: "dsk.dskb02",
        args: [],
        result: {
          type: "object",
          required: ["surfce", "nv"],
          properties: {
            surfce: { type: "spiceInt" },
            nv: { type: "spiceInt" },
          },
        },
      },
      args: {},
      workflow: {
        steps: [
          { op: "materialize", fixture: "minimalDsk", as: "dskPath" },
          { op: "dasOpen", path: "$refs.dskPath", as: "dasHandle" },
          { op: "dlaBeginForwardSearch", handle: "$refs.dasHandle", as: "dladsc" },
          { op: "call", fn: "dsk.dskgd", in: ["$refs.dasHandle", "$refs.dladsc"], as: "dskdsc" },
          { op: "project", out: { surfce: "$refs.dskdsc.surfce" } },
          {
            op: "call",
            fn: "dsk.dskb02",
            in: ["$refs.dasHandle", "$refs.dladsc"],
            out: { nv: "nv" },
          },
          { op: "projectResult", out: { surfce: "$refs.surfce", nv: "$refs.nv" } },
        ],
        cleanup: [
          { op: "dasClose", target: "$refs.dasHandle" },
          { op: "unlink", target: "$refs.dskPath" },
        ],
      },
    };

    const result = await executeV2CaseWithBackend(backend, input);

    expect(result).toEqual({ surfce: 401, nv: 8 });
    expect(raw.dskgd).toHaveBeenCalledTimes(1);
    expect(raw.dskb02).toHaveBeenCalledTimes(1);
    expect(raw.dascls).toHaveBeenCalled();
  });

  it("maps dskb02 named outputs for valid keys and rejects unsupported extras", async () => {
    const dlabfsDescr = {
      bwdptr: 0,
      fwdptr: 0,
      ibase: 0,
      isize: 1,
      dbase: 0,
      dsize: 1,
      cbase: 0,
      csize: 1,
    };

    const dskb02Bookkeeping = {
      nv: 8,
      np: 6,
      nvxtot: 8,
      vtxbds: [
        [0, 1],
        [0, 1],
        [0, 1],
      ],
      voxsiz: 1,
      voxori: [0, 0, 0],
      vgrext: [1, 1, 1],
      cgscal: 1,
      vtxnpl: 3,
      voxnpt: 4,
      voxnpl: 5,
    };

    const createBackend = (): SpiceBackend => {
      const raw = {
        dskopn: vi.fn((_path: string, _ifname: string, _ncomch: number) => 12),
        dskmi2: vi.fn(() => ({ spaixd: [1], spaixi: [1] })),
        dskw02: vi.fn(() => {}),
        dascls: vi.fn((_handle: number) => {}),
        dasopr: vi.fn((_path: string) => 77),
        dlabfs: vi.fn((_handle: number) => ({ found: true as const, descr: dlabfsDescr })),
        dskb02: vi.fn((_handle: number, _descr: unknown) => dskb02Bookkeeping),
      };
      const kit = {
        newIntCell: vi.fn((_size: number) => ({ size: 0, card: 0 })),
        newDoubleCell: vi.fn((_size: number) => ({ size: 0, card: 0 })),
        newCharCell: vi.fn((_size: number, _length: number) => ({ size: 0, card: 0 })),
        newWindow: vi.fn((_maxIntervals: number) => ({ card: 0 })),
        freeCell: vi.fn(() => {}),
        freeWindow: vi.fn(() => {}),
        readVirtualOutput: vi.fn((_output: { kind: string; path: string }) => new Uint8Array([1])),
      };

      return {
        kind: "node",
        raw,
        kit,
      } as SpiceBackend;
    };

    const createInput = (out: Record<string, string>): RunCaseInputV2 => ({
      schemaVersion: 3,
      manifest: {
        id: "methods/dsk/dskb02@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "dsk.dskb02",
        canonicalMethod: "dsk.dskb02",
        args: [],
        result: {
          type: "object",
          required: ["value"],
          properties: {
            value: { type: "spiceInt" },
          },
        },
      },
      args: {},
      workflow: {
        steps: [
          { op: "materialize", fixture: "minimalDsk", as: "dskPath" },
          { op: "dasOpen", path: "$refs.dskPath", as: "dasHandle" },
          { op: "dlaBeginForwardSearch", handle: "$refs.dasHandle", as: "dladsc" },
          {
            op: "call",
            fn: "dsk.dskb02",
            in: ["$refs.dasHandle", "$refs.dladsc"],
            out,
          },
          { op: "projectResult", out: { value: "$refs.value" } },
        ],
        cleanup: [
          { op: "dasClose", target: "$refs.dasHandle" },
          { op: "unlink", target: "$refs.dskPath" },
        ],
      },
    });

    const validProjectionCases = [
      { key: "nv", expected: dskb02Bookkeeping.nv },
      { key: "np", expected: dskb02Bookkeeping.np },
      { key: "nvxtot", expected: dskb02Bookkeeping.nvxtot },
      { key: "cgscal", expected: dskb02Bookkeeping.cgscal },
      { key: "vtxnpl", expected: dskb02Bookkeeping.vtxnpl },
      { key: "voxnpt", expected: dskb02Bookkeeping.voxnpt },
      { key: "voxnpl", expected: dskb02Bookkeeping.voxnpl },
    ] as const;

    for (const testCase of validProjectionCases) {
      const backend = createBackend();
      const result = await executeV2CaseWithBackend(backend, createInput({ [testCase.key]: "value" }));
      expect(result).toEqual({ value: testCase.expected });
    }

    const invalidProjectionCases = [
      {
        out: { vtxbds: "value" },
        rejectedKey: "vtxbds",
      },
      {
        out: { nv: "value", unexpectedExtra: "other" },
        rejectedKey: "unexpectedExtra",
      },
    ] as const;

    for (const testCase of invalidProjectionCases) {
      const backend = createBackend();
      await expect(executeV2CaseWithBackend(backend, createInput({ ...testCase.out }))).rejects.toMatchObject({
        code: "invalid_args",
        message: expect.stringContaining(`unsupported key ${JSON.stringify(testCase.rejectedKey)}`),
      });
    }
  });

  it("reports invalid_args when card_c is missing as in bypassed schema input", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps[1] = {
      op: "call",
      fn: "cells-windows.card",
      in: ["$refs.cell"],
    } as unknown as RunCaseInputV2["workflow"]["steps"][number];

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_args",
      message: 'call cells-windows.card requires an "as" output ref',
    });
  });

  it("reports invalid_args when scard_c includes as in bypassed schema input", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps[1] = {
      op: "call",
      fn: "cells-windows.scard",
      in: [0, "$refs.cell"],
      as: "ignored",
    } as unknown as RunCaseInputV2["workflow"]["steps"][number];

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_args",
      message: 'call cells-windows.scard does not allow an "as" output ref',
    });
  });

  it("reports invalid_args when scard_c includes out in bypassed schema input", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps[1] = {
      op: "call",
      fn: "cells-windows.scard",
      in: [0, "$refs.cell"],
      out: { ignored: "ignored" },
    } as unknown as RunCaseInputV2["workflow"]["steps"][number];

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_args",
      message: 'call cells-windows.scard does not allow an "out" map',
    });
  });

  it("reports invalid_args when size_c includes out in bypassed schema input", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps[1] = {
      op: "call",
      fn: "cells-windows.size",
      in: ["$refs.cell"],
      as: "size",
      out: { ignored: "ignored" },
    } as unknown as RunCaseInputV2["workflow"]["steps"][number];

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_args",
      message: 'call cells-windows.size does not allow an "out" map',
    });
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

  it("evaluates assert workflow steps and continues when assertions pass", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps.splice(2, 0, {
      op: "assert",
      test: {
        gte: ["$refs.size", 3],
      },
      error: {
        code: "assert_size_too_small",
        message: "size must be >= 3",
      },
    });

    await expect(executeV2CaseWithBackend(backend, input)).resolves.toEqual({
      size: 3,
    });
  });

  it("projects integer refs via project workflow steps", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps = [
      {
        op: "project",
        out: {
          selectedSize: "$args.size",
        },
      },
      {
        op: "projectResult",
        out: {
          size: "$refs.selectedSize",
        },
      },
    ];
    input.workflow.cleanup = [];

    await expect(executeV2CaseWithBackend(backend, input)).resolves.toEqual({
      size: 3,
    });
  });

  it("executes switch workflow branches and returns selected projectResult", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps = [
      {
        op: "project",
        out: {
          selectedSize: "$args.size",
        },
      },
      {
        op: "switch",
        on: "$refs.selectedSize",
        cases: {
          0: [
            {
              op: "projectResult",
              out: {
                size: 0,
              },
            },
          ],
        },
        default: [
          {
            op: "projectResult",
            out: {
              size: "$refs.selectedSize",
            },
          },
        ],
      },
    ];
    input.workflow.cleanup = [];

    await expect(executeV2CaseWithBackend(backend, input)).resolves.toEqual({
      size: 3,
    });
  });

  it("reports invalid_request for unmatched switch without default", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps = [
      {
        op: "switch",
        on: "$args.size",
        cases: {
          0: [
            {
              op: "projectResult",
              out: {
                size: 0,
              },
            },
          ],
        },
      },
    ];
    input.workflow.cleanup = [];

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_request",
      message: expect.stringContaining("no matching case"),
    });
  });

  it("rejects invalid assert.error fields even when assertions pass", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps.splice(2, 0, {
      op: "assert",
      test: {
        gte: ["$refs.size", 3],
      },
      error: {
        code: "",
        message: "size must be >= 3",
      },
    });

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "invalid_request",
      message: expect.stringContaining("assert.error.code must be a non-empty string"),
    });
  });

  it("returns provided assert error code/message when assertions fail", async () => {
    const { backend } = createBackendStub();
    const input = createBaseInput();
    input.workflow.steps.splice(2, 0, {
      op: "assert",
      test: {
        gt: ["$refs.size", 3],
      },
      error: {
        code: "assert_size_gt_three",
        message: "size must be > 3",
      },
    });

    await expect(executeV2CaseWithBackend(backend, input)).rejects.toMatchObject({
      code: "assert_size_gt_three",
      message: "size must be > 3",
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
