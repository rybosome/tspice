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

function requestForFn(fn: string): Record<string, unknown> {
  return {
    schemaVersion: 3,
    manifest: {
      id: "methods/time/str2et@v3",
      kind: "method",
    },
    contract: {
      contractMethod: "time.str2et",
      canonicalMethod: "time.str2et",
    },
    args: {
      fn,
      payload: ["2010-01-02T03:04:05"],
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

describe("native generated dispatch registry handoff", () => {
  it("marks registryMatched=true for modeled functions", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const run = runNative(binaryPath, requestForFn("time.str2et"));

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);

    const parsed = JSON.parse(run.stdout) as {
      ok: boolean;
      error?: {
        code?: string;
        reason?: string;
        details?: {
          registryMatched?: boolean;
          fn?: string;
        };
      };
    };

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatchObject({
      code: GENERATED_DISPATCH_UNAVAILABLE_CODE,
      reason: GENERATED_DISPATCH_UNAVAILABLE_REASON,
    });
    expect(parsed.error?.details).toMatchObject({
      registryMatched: true,
      fn: "time.str2et",
    });
  });

  it("marks registryMatched=false for unmodeled functions", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const run = runNative(binaryPath, requestForFn("time.__unmodeled__"));

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);

    const parsed = JSON.parse(run.stdout) as {
      ok: boolean;
      error?: {
        code?: string;
        reason?: string;
        details?: {
          registryMatched?: boolean;
          fn?: string;
        };
      };
    };

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
});
