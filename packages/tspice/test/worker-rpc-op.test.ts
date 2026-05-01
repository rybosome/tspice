import { describe, expect, it } from "vitest";

import {
  type WorkerRpcAllowlist,
  resolveWorkerRpcInvocation,
} from "../src/worker/browser/workerRpcOp.js";

const blockedStringKeys = new Set<string>([
  "then",
  "__proto__",
  "prototype",
  "constructor",
]);

const isSafeRpcKey = (key: string): boolean => /^[A-Za-z_$][\w$]*$/.test(key);

const makeError = (fn: () => unknown): Error => {
  try {
    fn();
  } catch (error) {
    return error as Error;
  }
  throw new Error("Expected function to throw");
};

const makeInputs = (allowlist: WorkerRpcAllowlist = {}) => ({
  allowlist,
  surfaces: {
    raw: {
      furnsh: () => "ok",
    },
    kit: {
      toolkitVersion: () => "TSPICE_TEST",
      kclear: () => undefined,
    },
  },
  isSafeRpcKey,
  blockedStringKeys,
});

describe("worker RPC operation resolution", () => {
  it("reports invalid operation format as caller-actionable", () => {
    const error = makeError(() =>
      resolveWorkerRpcInvocation({
        op: "raw",
        ...makeInputs(),
      }),
    );

    expect(error.message).toContain("Invalid worker RPC operation");
    expect(error.message).toContain("Expected:");
    expect(error.message).toContain("Got:");
    expect(error.message).toContain("Hint:");
    expect(error.message).toContain('op="raw"');
  });

  it("reports unknown namespace with namespace/method context", () => {
    const error = makeError(() =>
      resolveWorkerRpcInvocation({
        op: "unknown.toolkitVersion",
        ...makeInputs(),
      }),
    );

    expect(error.message).toContain("Unknown worker RPC namespace");
    expect(error.message).toContain('op="unknown.toolkitVersion"');
    expect(error.message).toContain('namespace="unknown"');
    expect(error.message).toContain('method="toolkitVersion"');
    expect(error.message).toContain('Expected: "raw" or "kit"');
  });

  it("reports disallowed operations with remediation guidance", () => {
    const error = makeError(() =>
      resolveWorkerRpcInvocation({
        op: "kit.kclear",
        ...makeInputs({
          kit: new Set(["toolkitVersion"]),
        }),
      }),
    );

    expect(error.message).toContain("Disallowed worker RPC operation");
    expect(error.message).toContain('op="kit.kclear"');
    expect(error.message).toContain('namespace="kit"');
    expect(error.message).toContain('method="kclear"');
    expect(error.message).toContain("Expected: an allowlisted");
    expect(error.message).toContain("meta.surfaceMethodKeys");
  });

  it("reports unknown operations with operation context", () => {
    const error = makeError(() =>
      resolveWorkerRpcInvocation({
        op: "raw.missingMethod",
        ...makeInputs(),
      }),
    );

    expect(error.message).toContain("Unknown worker RPC operation");
    expect(error.message).toContain('op="raw.missingMethod"');
    expect(error.message).toContain('namespace="raw"');
    expect(error.message).toContain('method="missingMethod"');
    expect(error.message).toContain("Expected: an existing");
  });

  it("rejects inherited methods and only allows own properties", () => {
    const inheritedSurface = Object.create({
      inheritedMethod: () => "nope",
    }) as Record<string, unknown>;

    const error = makeError(() =>
      resolveWorkerRpcInvocation({
        op: "raw.inheritedMethod",
        allowlist: {},
        surfaces: {
          raw: inheritedSurface,
          kit: {
            toolkitVersion: () => "TSPICE_TEST",
          },
        },
        isSafeRpcKey,
        blockedStringKeys,
      }),
    );

    expect(error.message).toContain("Unknown worker RPC operation");
    expect(error.message).toContain("Expected: an existing own");
  });
});
