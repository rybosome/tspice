import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { KernelEntry, RunCaseInputV2 } from "../../src/runners/types.js";

const { toSyncMock, executeV2CaseWithBackendMock, validateV2CasePreflightMock } = vi.hoisted(() => ({
  toSyncMock: vi.fn(),
  executeV2CaseWithBackendMock: vi.fn(),
  validateV2CasePreflightMock: vi.fn(),
}));

vi.mock("@rybosome/tspice", () => ({
  spiceClients: {
    toSync: toSyncMock,
  },
}));

vi.mock("../../src/runners/v2Executor.js", () => ({
  executeV2CaseWithBackend: executeV2CaseWithBackendMock,
  validateV2CasePreflight: validateV2CasePreflightMock,
}));

import {
  CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV,
  createCspiceRunner,
} from "../../src/runners/cspiceRunner.js";

const originalCallContractDebugEnv = process.env[CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV];

function createFastPathInput(kernels: KernelEntry[] = []): RunCaseInputV2 {
  return {
    schemaVersion: 3,
    manifest: {
      id: "methods/time/tkvrsn@v3",
      kind: "method",
    },
    contract: {
      contractMethod: "time.tkvrsn",
      canonicalMethod: "time.tkvrsn",
      aliases: [],
      result: { const: null },
      errors: [{ code: "invalid_args" }, { code: "spice_error" }],
    },
    args: ["TOOLKIT"],
    setup: kernels.length > 0 ? { kernels } : undefined,
    workflow: {
      steps: [{ op: "callContract" }],
    },
  };
}

afterEach(() => {
  if (originalCallContractDebugEnv === undefined) {
    delete process.env[CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV];
  } else {
    process.env[CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV] = originalCallContractDebugEnv;
  }

  toSyncMock.mockReset();
  executeV2CaseWithBackendMock.mockReset();
  validateV2CasePreflightMock.mockReset();
});

describe("createCspiceRunner fast path", () => {
  it("does not initialize node backend for single-step callContract by default", async () => {
    delete process.env[CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV];

    const runner = await createCspiceRunner();

    try {
      await runner.runCase(createFastPathInput());

      expect(toSyncMock).not.toHaveBeenCalled();
      expect(executeV2CaseWithBackendMock).not.toHaveBeenCalled();
    } finally {
      await runner.dispose?.();
    }
  });

  it("applies setup.kernels and isolates state before/after each fast-path case", async () => {
    process.env[CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV] = "1";

    const raw = {
      kind: "node",
      kclear: vi.fn(),
      reset: vi.fn(),
      furnsh: vi.fn(),
    };

    toSyncMock.mockResolvedValueOnce({
      spice: { raw, kit: {} },
    });

    executeV2CaseWithBackendMock
      .mockResolvedValueOnce({ run: 1 })
      .mockResolvedValueOnce({ run: 2 });

    const runner = await createCspiceRunner();

    try {
      const firstInput = createFastPathInput(["./kernels/first.bsp", { path: "./kernels/second.bsp" }]);
      const secondInput = createFastPathInput(["./kernels/third.bsp"]);

      await expect(runner.runCase(firstInput)).resolves.toEqual({ ok: true, result: { run: 1 } });
      await expect(runner.runCase(secondInput)).resolves.toEqual({ ok: true, result: { run: 2 } });

      expect(raw.furnsh).toHaveBeenNthCalledWith(1, path.resolve("./kernels/first.bsp"));
      expect(raw.furnsh).toHaveBeenNthCalledWith(2, path.resolve("./kernels/second.bsp"));
      expect(raw.furnsh).toHaveBeenNthCalledWith(3, path.resolve("./kernels/third.bsp"));

      expect(raw.kclear).toHaveBeenCalledTimes(4);
      expect(raw.reset).toHaveBeenCalledTimes(4);

      const kclearOrder = raw.kclear.mock.invocationCallOrder;
      const resetOrder = raw.reset.mock.invocationCallOrder;
      const furnshOrder = raw.furnsh.mock.invocationCallOrder;
      const executeOrder = executeV2CaseWithBackendMock.mock.invocationCallOrder;

      expect(kclearOrder[0]).toBeLessThan(resetOrder[0]);
      expect(resetOrder[0]).toBeLessThan(furnshOrder[0]!);
      expect(furnshOrder[1]!).toBeLessThan(executeOrder[0]!);
      expect(executeOrder[0]!).toBeLessThan(kclearOrder[1]!);

      expect(kclearOrder[2]!).toBeLessThan(resetOrder[2]!);
      expect(resetOrder[2]!).toBeLessThan(furnshOrder[2]!);
      expect(furnshOrder[2]!).toBeLessThan(executeOrder[1]!);
      expect(executeOrder[1]!).toBeLessThan(kclearOrder[3]!);

      expect(executeV2CaseWithBackendMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ raw }),
        firstInput,
      );
      expect(executeV2CaseWithBackendMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ raw }),
        secondInput,
      );

      expect(toSyncMock).toHaveBeenCalledTimes(1);

      expect(validateV2CasePreflightMock).not.toHaveBeenCalled();
    } finally {
      await runner.dispose?.();
    }
  });

  it("still performs post-case isolation when fast-path execution fails", async () => {
    process.env[CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV] = "1";

    const raw = {
      kind: "node",
      kclear: vi.fn(),
      reset: vi.fn(),
      furnsh: vi.fn(),
    };

    toSyncMock.mockResolvedValueOnce({
      spice: { raw, kit: {} },
    });

    executeV2CaseWithBackendMock.mockRejectedValueOnce(new Error("boom"));

    const runner = await createCspiceRunner();

    try {
      const out = await runner.runCase(createFastPathInput(["./kernels/fail.bsp"]));

      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect(out.error.message).toBe("boom");
      }

      expect(raw.furnsh).toHaveBeenCalledWith(path.resolve("./kernels/fail.bsp"));
      expect(raw.kclear).toHaveBeenCalledTimes(2);
      expect(raw.reset).toHaveBeenCalledTimes(2);
    } finally {
      await runner.dispose?.();
    }
  });
});
