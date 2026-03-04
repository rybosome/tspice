import { afterEach, describe, expect, it, vi } from "vitest";

import type { RunCaseInputV2 } from "../../src/runners/types.js";

const { validateV2CasePreflightMock } = vi.hoisted(() => ({
  validateV2CasePreflightMock: vi.fn(),
}));

vi.mock("../../src/runners/v2Executor.js", () => ({
  validateV2CasePreflight: validateV2CasePreflightMock,
}));

import {
  CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV,
  createCspiceRunner,
} from "../../src/runners/cspiceRunner.js";

const originalCallContractDebugEnv = process.env[CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV];

function createCallContractInput(): RunCaseInputV2 {
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
    workflow: {
      steps: [{ op: "callContract" }],
    },
  };
}

function createNativeWorkflowInput(): RunCaseInputV2 {
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
      steps: [{ op: "projectResult", out: { size: "$args.size" } }],
    },
  };
}

afterEach(() => {
  if (originalCallContractDebugEnv === undefined) {
    delete process.env[CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV];
  } else {
    process.env[CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV] = originalCallContractDebugEnv;
  }

  validateV2CasePreflightMock.mockReset();
});

describe("createCspiceRunner native lane", () => {
  it("skips v3 object-args preflight for single-step callContract bridge workflows", async () => {
    delete process.env[CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV];

    const runner = await createCspiceRunner();

    try {
      const out = await runner.runCase(createCallContractInput());
      expect(out.ok).toBe(false);
      expect(validateV2CasePreflightMock).not.toHaveBeenCalled();
    } finally {
      await runner.dispose?.();
    }
  });

  it("still runs v3 preflight validation for non-callContract workflows", async () => {
    delete process.env[CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV];

    const runner = await createCspiceRunner();

    try {
      const out = await runner.runCase(createNativeWorkflowInput());
      expect(out.ok).toBe(false);
      expect(validateV2CasePreflightMock).toHaveBeenCalledTimes(1);
    } finally {
      await runner.dispose?.();
    }
  });

  it("rejects callContract node debug override so native parity lane stays cspice-runner only", async () => {
    process.env[CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV] = "1";

    const runner = await createCspiceRunner();

    try {
      const out = await runner.runCase(createCallContractInput());
      expect(out.ok).toBe(false);

      if (!out.ok) {
        expect(out.error.code).toBe("invalid_request");
        expect(out.error.message).toContain(CSPICE_CALL_CONTRACT_NODE_DEBUG_ENV);
        expect(out.error.spice).toEqual({ failed: false });
      }

      expect(validateV2CasePreflightMock).not.toHaveBeenCalled();
    } finally {
      await runner.dispose?.();
    }
  });
});
