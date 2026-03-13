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

describe("native runner generated-dispatch seam boundary", () => {
  it("emits the canonical fail-closed boundary payload", () => {
    const state = readCspiceRunnerBuildState();
    if (!state?.available) {
      return;
    }

    const binaryPath = state.binaryPath ?? getCspiceRunnerBinaryPath();
    expect(fs.existsSync(binaryPath)).toBe(true);

    const request = {
      schemaVersion: 3,
      manifest: {
        id: "methods/time.str2et@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "time.str2et",
        canonicalMethod: "time.str2et",
      },
      args: {
        fn: "time.str2et",
      },
      workflow: {
        steps: [
          {
            op: "call",
            fn: "$args.fn",
            in: "$args",
          },
        ],
      },
    };

    const run = spawnSync(binaryPath, {
      input: `${JSON.stringify(request)}\n`,
      encoding: "utf8",
    });

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);

    const parsed = JSON.parse(run.stdout) as {
      ok: boolean;
      error?: {
        code?: string;
        lane?: string;
        callId?: string;
        reason?: string;
        details?: Record<string, unknown>;
      };
    };

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatchObject({
      code: GENERATED_DISPATCH_UNAVAILABLE_CODE,
      lane: "cspice",
      callId: "methods/time.str2et@v3::1",
      reason: GENERATED_DISPATCH_UNAVAILABLE_REASON,
    });
    expect(parsed.error?.details).toMatchObject({
      dispatchHandoffAttempted: true,
      fallbackUsed: false,
      stopPoint: GENERATED_DISPATCH_UNAVAILABLE_REASON,
      fn: "time.str2et",
    });
  });
});
