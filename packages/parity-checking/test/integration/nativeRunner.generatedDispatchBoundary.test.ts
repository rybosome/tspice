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

function runNative(binaryPath: string, input: string) {
  return spawnSync(binaryPath, {
    input,
    encoding: "utf8",
  });
}

describe("native runner generated-dispatch seam boundary", () => {
  it("emits the canonical fail-closed boundary payload", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const request = {
      schemaVersion: 3,
      manifest: {
        id: "methods/time.et2utc@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "time.et2utc",
        canonicalMethod: "time.et2utc",
      },
      args: {
        fn: "time.et2utc",
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

    const run = runNative(binaryPath, `${JSON.stringify(request)}\n`);

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);

    const parsed = JSON.parse(run.stdout) as {
      ok: boolean;
      error?: {
        code?: string;
        message?: string;
        lane?: string;
        callId?: string;
        reason?: string;
        details?: Record<string, unknown>;
      };
    };

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatchObject({
      code: GENERATED_DISPATCH_UNAVAILABLE_CODE,
      message: "Generated dispatch unavailable",
      lane: "cspice",
      callId: "methods/time.et2utc@v3::1",
      reason: GENERATED_DISPATCH_UNAVAILABLE_REASON,
    });
    expect(parsed.error?.details).toMatchObject({
      dispatchHandoffAttempted: true,
      fallbackUsed: false,
      stopPoint: GENERATED_DISPATCH_UNAVAILABLE_REASON,
      registryMatched: true,
      fn: "time.et2utc",
    });
  });

  it("resolves workflow step input references before seam handoff", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const request = {
      schemaVersion: 3,
      manifest: {
        id: "methods/time.et2utc@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "time.et2utc",
        canonicalMethod: "time.et2utc",
      },
      args: {
        fn: "time.et2utc",
      },
      workflow: {
        steps: [
          {
            op: "call",
            fn: "$args.fn",
            in: "$args.missing",
          },
        ],
      },
    };

    const run = runNative(binaryPath, `${JSON.stringify(request)}\n`);

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);

    const parsed = JSON.parse(run.stdout) as {
      ok: boolean;
      error?: {
        code?: string;
        message?: string;
        detail?: string;
      };
    };

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatchObject({
      code: "invalid_args",
      message: "Reference path is missing property",
      detail: "workflow.steps[0].in",
    });
  });

  it("rejects trailing-dot $args. for workflow fn references", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const request = {
      schemaVersion: 3,
      manifest: {
        id: "methods/time.et2utc@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "time.et2utc",
        canonicalMethod: "time.et2utc",
      },
      args: {
        fn: "time.et2utc",
      },
      workflow: {
        steps: [
          {
            op: "call",
            fn: "$args.",
            in: "$args",
          },
        ],
      },
    };

    const run = runNative(binaryPath, `${JSON.stringify(request)}\n`);

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);

    const parsed = JSON.parse(run.stdout) as {
      ok: boolean;
      error?: {
        code?: string;
        message?: string;
        detail?: string;
      };
    };

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatchObject({
      code: "invalid_request",
      message: "Invalid reference expression",
      detail: "workflow.steps[0].fn",
    });
  });

  it("rejects trailing-dot $args. for workflow input references", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const request = {
      schemaVersion: 3,
      manifest: {
        id: "methods/time.et2utc@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "time.et2utc",
        canonicalMethod: "time.et2utc",
      },
      args: {
        fn: "time.et2utc",
      },
      workflow: {
        steps: [
          {
            op: "call",
            fn: "$args.fn",
            in: "$args.",
          },
        ],
      },
    };

    const run = runNative(binaryPath, `${JSON.stringify(request)}\n`);

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);

    const parsed = JSON.parse(run.stdout) as {
      ok: boolean;
      error?: {
        code?: string;
        message?: string;
        detail?: string;
      };
    };

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatchObject({
      code: "invalid_request",
      message: "Invalid reference expression",
      detail: "workflow.steps[0].in",
    });
  });

  it("uses explicit unsupported messaging for $refs workflow fn", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const request = {
      schemaVersion: 3,
      manifest: {
        id: "methods/time.et2utc@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "time.et2utc",
        canonicalMethod: "time.et2utc",
      },
      args: {
        fn: "time.et2utc",
      },
      workflow: {
        steps: [
          {
            op: "call",
            fn: "$refs.cachedFn",
            in: "$args",
          },
        ],
      },
    };

    const run = runNative(binaryPath, `${JSON.stringify(request)}\n`);

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);

    const parsed = JSON.parse(run.stdout) as {
      ok: boolean;
      error?: {
        code?: string;
        message?: string;
        detail?: string;
      };
    };

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatchObject({
      code: "invalid_request",
      message:
        "workflow call step fn does not support $refs in native canonical execution",
      detail: "workflow.steps[0].fn",
    });
  });

  it("distinguishes incomplete JSON parse failures", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const run = runNative(binaryPath, '{"schemaVersion":3,');

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);

    const parsed = JSON.parse(run.stdout) as {
      ok: boolean;
      error?: {
        code?: string;
        message?: string;
      };
    };

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatchObject({
      code: "invalid_request",
      message: "Invalid JSON: incomplete payload",
    });
  });

  it("rejects trailing top-level JSON tokens after the request object", () => {
    const binaryPath = getBinaryPathOrSkip();
    if (!binaryPath) {
      return;
    }

    const request = {
      schemaVersion: 3,
      manifest: {
        id: "methods/time.et2utc@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "time.et2utc",
        canonicalMethod: "time.et2utc",
      },
      args: {
        fn: "time.et2utc",
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

    const run = runNative(binaryPath, `${JSON.stringify(request)}\ntrue`);

    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);

    const parsed = JSON.parse(run.stdout) as {
      ok: boolean;
      error?: {
        code?: string;
        message?: string;
      };
    };

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatchObject({
      code: "invalid_request",
      message: "Invalid JSON: trailing top-level tokens",
    });
  });
});
