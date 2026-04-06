import { describe, expect, it } from "vitest";

import {
  GENERATED_DISPATCH_UNAVAILABLE_CODE,
  GENERATED_DISPATCH_UNAVAILABLE_REASON,
  promotedGeneratedDispatchMethods,
} from "../../src/runners/generatedDispatchSeam.js";
import { createTspiceRunner } from "../../src/runners/tspiceRunner.js";
import { executeCanonicalWorkflowCase } from "../../src/runners/workflowExecutor.js";

import type { RunCaseInputV3 } from "../../src/runners/types.js";

function buildInput(
  fn: string,
  args: unknown,
  setupKernels?: string[],
): RunCaseInputV3 {
  return {
    schemaVersion: 3,
    manifest: {
      id: `methods/${fn.replace(/\./g, "/")}@v3`,
      kind: "method",
    },
    ...(setupKernels === undefined
      ? {}
      : {
          setup: {
            kernels: setupKernels,
          },
        }),
    contract: {
      contractMethod: fn,
      canonicalMethod: fn,
      errors: [],
    },
    args,
    workflow: {
      steps: [
        {
          op: "call",
          fn,
          in: "$args",
        },
      ],
    },
  };
}

describe("canonical call-step dispatch boundary", () => {
  it("exposes the exact handwritten promotion set for slice #626 P1A", () => {
    expect(promotedGeneratedDispatchMethods()).toEqual([
      "time.str2et",
      "time.et2utc",
      "time.timdef",
      "ids-names.bodn2c",
      "coords-vectors.mxm",
      "coords-vectors.recgeo",
      "cells-windows.wninsd",
      "cells-windows.wnfetd",
      "kernel-pool.gcpool",
      "kernels.furnsh",
      "kernels.ktotal",
      "kernels.kdata",
      "kernels.kxtrct",
      "ek.ekfind",
      "ek.ekgc",
    ]);
  });

  it("executes promoted dispatch for a handwritten method on wasm lane", async () => {
    const runner = await createTspiceRunner({ backend: "wasm" });

    try {
      const out = await runner.runCase(
        buildInput("time.str2et", ["2010-01-02T03:04:05"], ["$FIXTURES/basic-time"]),
      );

      expect(out.ok).toBe(true);
      if (!out.ok) {
        throw new Error("expected promoted dispatch case to succeed");
      }

      expect(typeof out.result).toBe("number");
      expect(Number.isFinite(out.result as number)).toBe(true);
    } finally {
      await runner.dispose?.();
    }
  });

  it("keeps non-promoted methods fail-closed with stable boundary markers", async () => {
    const runner = await createTspiceRunner({ backend: "wasm" });

    try {
      const out = await runner.runCase(buildInput("time.tkvrsn", ["TOOLKIT"]));

      expect(out.ok).toBe(false);
      if (out.ok) {
        throw new Error("expected fail-closed boundary outcome");
      }

      expect(out.error.code).toBe(GENERATED_DISPATCH_UNAVAILABLE_CODE);
      expect(out.error.reason).toBe(GENERATED_DISPATCH_UNAVAILABLE_REASON);
      expect(out.error.details).toMatchObject({
        dispatchHandoffAttempted: true,
        fallbackUsed: false,
        stopPoint: GENERATED_DISPATCH_UNAVAILABLE_REASON,
        fn: "time.tkvrsn",
      });
    } finally {
      await runner.dispose?.();
    }
  });

  it("preserves unmatched-method boundary behavior when fn resolves via args token", () => {
    const input = {
      schemaVersion: 3,
      manifest: {
        id: "methods/time/str2et@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "time.str2et",
        canonicalMethod: "time.str2et",
        errors: [],
      },
      args: {
        fn: "unknown.method",
        payload: ["2010-01-01T00:00:00"],
      },
      workflow: {
        steps: [
          {
            op: "call",
            fn: "$args.fn",
            in: "$args.payload",
          },
        ],
      },
    } satisfies RunCaseInputV3;

    try {
      executeCanonicalWorkflowCase("node", input);
      throw new Error("expected executeCanonicalWorkflowCase to throw");
    } catch (error) {
      const withCode = error as Error & { code?: string; details?: Record<string, unknown> };
      expect(withCode.code).toBe(GENERATED_DISPATCH_UNAVAILABLE_CODE);
      expect(withCode.details).toMatchObject({
        dispatchHandoffAttempted: true,
        fallbackUsed: false,
        stopPoint: GENERATED_DISPATCH_UNAVAILABLE_REASON,
        fn: "unknown.method",
      });
    }
  });
});
