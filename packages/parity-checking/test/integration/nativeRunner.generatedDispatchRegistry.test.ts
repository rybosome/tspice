import * as fs from "node:fs";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  GENERATED_DISPATCH_UNAVAILABLE_CODE,
  GENERATED_DISPATCH_UNAVAILABLE_REASON,
} from "../../src/runners/generatedDispatchSeam.js";
import {
  getCspiceRunnerBinaryPath,
  readCspiceRunnerBuildState,
} from "../../src/runners/cspiceRunner.js";

type NativeRunResponse = {
  ok: boolean;
  result?: unknown;
  error?: {
    code?: string;
    message?: string;
    reason?: string;
    spiceShort?: string;
    details?: {
      registryMatched?: boolean;
      fn?: string;
    };
  };
};

function getBinaryPathOrSkip(): string | null {
  const state = readCspiceRunnerBuildState();
  if (!state?.available) {
    return null;
  }

  const binaryPath = state.binaryPath ?? getCspiceRunnerBinaryPath();
  expect(fs.existsSync(binaryPath)).toBe(true);
  return binaryPath;
}

function runNative(binaryPath: string, request: Record<string, unknown>) {
  return spawnSync(binaryPath, {
    input: `${JSON.stringify(request)}\n`,
    encoding: "utf8",
  });
}

function requestForFn(
  fn: string,
  payload: unknown,
  options?: {
    includeBasicTimeKernel?: boolean;
  },
): Record<string, unknown> {
  const manifestId = `methods/${fn.replaceAll(".", "/")}@v3`;

  return {
    schemaVersion: 3,
    manifest: {
      id: manifestId,
      kind: "method",
    },
    contract: {
      contractMethod: fn,
      canonicalMethod: fn,
    },
    ...(options?.includeBasicTimeKernel
      ? {
          setup: {
            kernels: ["$FIXTURES/basic-time"],
          },
        }
      : {}),
    args: {
      fn,
      payload,
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
  };
}

function requestForVectorFn(fn: string, payload: unknown): Record<string, unknown> {
  return requestForFn(fn, payload);
}

describe("native generated dispatch registry handoff", () => {
  it("marks registryMatched=true for modeled but non-promoted functions", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const run = runNative(binaryPath, requestForFn("time.et2utc", [0, "ISOC", 3]));

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);

    const parsed = JSON.parse(run.stdout) as NativeRunResponse;

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatchObject({
      code: GENERATED_DISPATCH_UNAVAILABLE_CODE,
      reason: GENERATED_DISPATCH_UNAVAILABLE_REASON,
    });
    expect(parsed.error?.details).toMatchObject({
      registryMatched: true,
      fn: "time.et2utc",
    });
  });

  it("marks registryMatched=false for unmodeled functions", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const run = runNative(binaryPath, requestForFn("time.__unmodeled__", []));

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);

    const parsed = JSON.parse(run.stdout) as NativeRunResponse;

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatchObject({
      code: GENERATED_DISPATCH_UNAVAILABLE_CODE,
      reason: GENERATED_DISPATCH_UNAVAILABLE_REASON,
    });
    expect(parsed.error?.details).toMatchObject({
      registryMatched: false,
      fn: "time.__unmodeled__",
    });
  });

  it("executes promoted time scalar methods through native generated dispatch", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const requests = [
      {
        fn: "time.str2et",
        payload: ["2010-01-02T03:04:05"],
      },
      {
        fn: "time.tparse",
        payload: ["2000 JAN 01 12:00:00"],
      },
      {
        fn: "time.deltet",
        payload: [0, "ET"],
      },
      {
        fn: "time.unitim",
        payload: [0, "ET", "TAI"],
      },
    ] as const;

    for (const request of requests) {
      const run = runNative(
        binaryPath,
        requestForFn(request.fn, [...request.payload], {
          includeBasicTimeKernel: true,
        }),
      );

      expect(run.error).toBeUndefined();
      expect(run.status).toBe(0);

      const parsed = JSON.parse(run.stdout) as NativeRunResponse;

      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        continue;
      }

      expect(typeof parsed.result).toBe("number");
      expect(Number.isFinite(parsed.result as number)).toBe(true);
    }
  });

  it("surfaces representative failure paths for promoted time scalar methods", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const failures = [
      {
        fn: "time.str2et",
        payload: ["not a time"],
        expectedCode: undefined,
        message: "SPICE error in time.str2et generated dispatch",
      },
      {
        fn: "time.tparse",
        payload: ["not a time"],
        expectedCode: "invalid_args",
        message: "generated dispatch time.tparse could not parse input",
      },
      {
        fn: "time.deltet",
        payload: [0, "NOT_A_SCALE"],
        expectedCode: undefined,
        message: "SPICE error in time.deltet generated dispatch",
      },
      {
        fn: "time.unitim",
        payload: [0, "ET", "NOT_A_SCALE"],
        expectedCode: undefined,
        message: "SPICE error in time.unitim generated dispatch",
      },
    ] as const;

    for (const failure of failures) {
      const run = runNative(
        binaryPath,
        requestForFn(failure.fn, [...failure.payload], {
          includeBasicTimeKernel: true,
        }),
      );

      expect(run.error).toBeUndefined();
      expect(run.status).toBe(1);

      const parsed = JSON.parse(run.stdout) as NativeRunResponse;

      expect(parsed.ok).toBe(false);
      expect(parsed.error?.message).toBe(failure.message);
      if (failure.expectedCode) {
        expect(parsed.error?.code).toBe(failure.expectedCode);
      }
    }
  });

  it("executes implemented coords-vectors.vdot through native generated dispatch", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const run = runNative(
      binaryPath,
      requestForVectorFn("coords-vectors.vdot", [
        [1, 2, 3],
        [4, 5, 6],
      ]),
    );

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(0);

    const parsed = JSON.parse(run.stdout) as NativeRunResponse;

    expect(parsed.ok).toBe(true);
    expect(parsed.result).toBe(32);
    expect(parsed.error).toBeUndefined();
  });

  it("executes implemented coords-vectors.vadd through native generated dispatch", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const run = runNative(
      binaryPath,
      requestForVectorFn("coords-vectors.vadd", [
        [1, 2, 3],
        [4, 5, 6],
      ]),
    );

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(0);

    const parsed = JSON.parse(run.stdout) as NativeRunResponse;

    expect(parsed.ok).toBe(true);
    expect(parsed.result).toEqual([5, 7, 9]);
    expect(parsed.error).toBeUndefined();
  });
});
