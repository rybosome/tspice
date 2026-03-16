import { describe, expect, it } from "vitest";

import {
  GENERATED_DISPATCH_UNAVAILABLE_CODE,
  GENERATED_DISPATCH_UNAVAILABLE_REASON,
} from "../../src/runners/generatedDispatchSeam.js";
import { createCspiceRunner, getCspiceRunnerStatus } from "../../src/runners/cspiceRunner.js";
import { createTspiceRunner } from "../../src/runners/tspiceRunner.js";

describe("canonical call-step dispatch boundary", () => {
  function buildInput(fn: string) {
    return {
      schemaVersion: 3 as const,
      manifest: {
        id: `methods/${fn}@v3`,
        kind: "method" as const,
      },
      contract: {
        contractMethod: fn,
        canonicalMethod: fn,
      },
      args: [1, 2, 3],
      workflow: {
        steps: [
          {
            op: "call" as const,
            fn,
            in: "$args",
          },
        ],
      },
    };
  }

  it("uses one TS call-step path and fails closed at generated-dispatch boundary", async () => {
    const runner = await createTspiceRunner({ backend: "node" });
    const out = await runner.runCase(buildInput("time.str2et"));

    expect(out.ok).toBe(false);
    if (out.ok) return;

    expect(out.error.code).toBe(GENERATED_DISPATCH_UNAVAILABLE_CODE);
    expect(out.error.reason).toBe(GENERATED_DISPATCH_UNAVAILABLE_REASON);
    expect(out.error.lane).toBe("node");
    expect(out.error.callId).toBe("methods/time.str2et@v3::1");
    expect(out.error.details).toMatchObject({
      dispatchHandoffAttempted: true,
      fallbackUsed: false,
      stopPoint: GENERATED_DISPATCH_UNAVAILABLE_REASON,
      registryMatched: true,
      behaviorClass: "input-mapping-scalar-output",
    });
  });

  it("uses one native lane call-step path and fails closed with normalized boundary fields", async () => {
    const status = getCspiceRunnerStatus();
    expect(status.ready).toBe(true);

    const runner = await createCspiceRunner();
    const out = await runner.runCase(buildInput("time.str2et"));

    expect(out.ok).toBe(false);
    if (out.ok) return;

    expect(out.error).toMatchObject({
      code: GENERATED_DISPATCH_UNAVAILABLE_CODE,
      lane: "cspice",
      callId: "methods/time.str2et@v3::1",
      reason: GENERATED_DISPATCH_UNAVAILABLE_REASON,
    });
  });

  it("does not route through legacy manual wrapper/table dispatch aliases", async () => {
    const runner = await createTspiceRunner({ backend: "wasm" });

    // `bodn2c` used to be reachable via bespoke dispatch aliases.
    const out = await runner.runCase(buildInput("bodn2c"));

    expect(out.ok).toBe(false);
    if (out.ok) return;

    expect(out.error.code).toBe(GENERATED_DISPATCH_UNAVAILABLE_CODE);
    expect(out.error.reason).toBe(GENERATED_DISPATCH_UNAVAILABLE_REASON);
    expect(out.error.details?.fallbackUsed).toBe(false);
    expect(out.error.details?.registryMatched).toBe(false);
  });
});
