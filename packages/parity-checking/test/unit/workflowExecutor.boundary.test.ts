import { describe, expect, it } from "vitest";

import {
  GENERATED_DISPATCH_UNAVAILABLE_CODE,
  GENERATED_DISPATCH_UNAVAILABLE_REASON,
} from "../../src/runners/generatedDispatchSeam.js";
import { createCspiceRunner, getCspiceRunnerStatus } from "../../src/runners/cspiceRunner.js";
import { createTspiceRunner } from "../../src/runners/tspiceRunner.js";

describe("canonical call-step dispatch boundary", () => {
  function buildInput(fn: string, args: unknown = [1, 2, 3]) {
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
      args,
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

  it("routes promoted time.tparse through generated callable dispatch on TS lane", async () => {
    const runner = await createTspiceRunner({ backend: "node" });
    const out = await runner.runCase(buildInput("time.tparse", ["2000 JAN 01 12:00:00"]));

    expect(out.ok).toBe(true);
    if (!out.ok) {
      return;
    }

    expect(typeof out.result).toBe("number");
    expect(Number.isFinite(out.result as number)).toBe(true);
  });

  it("routes promoted time.tparse through generated callable dispatch on cspice lane", async () => {
    const runner = await createCspiceRunner();
    const out = await runner.runCase(buildInput("time.tparse", ["2000 JAN 01 12:00:00"]));

    expect(out.ok).toBe(true);
    if (!out.ok) {
      return;
    }

    expect(typeof out.result).toBe("number");
    expect(Number.isFinite(out.result as number)).toBe(true);
  });

  it("routes implemented TS call-step entries through generated callable dispatch", async () => {
    const runner = await createTspiceRunner({ backend: "node" });
    const out = await runner.runCase(
      buildInput("coords-vectors.vdot", [
        [1, 2, 3],
        [4, 5, 6],
      ]),
    );

    expect(out).toEqual({
      ok: true,
      result: 32,
    });
  });

  it("routes implemented cspice lane call-step entries through generated callable dispatch", async () => {
    const runner = await createCspiceRunner();
    const out = await runner.runCase(
      buildInput("coords-vectors.vadd", [
        [1, 2, 3],
        [4, 5, 6],
      ]),
    );

    expect(out).toEqual({
      ok: true,
      result: [5, 7, 9],
    });
  });

  it("uses one TS call-step path and fails closed at generated-dispatch boundary", async () => {
    const runner = await createTspiceRunner({ backend: "node" });
    const out = await runner.runCase(buildInput("time.et2utc"));

    expect(out.ok).toBe(false);
    if (out.ok) return;

    expect(out.error.code).toBe(GENERATED_DISPATCH_UNAVAILABLE_CODE);
    expect(out.error.reason).toBe(GENERATED_DISPATCH_UNAVAILABLE_REASON);
    expect(out.error.lane).toBe("node");
    expect(out.error.callId).toBe("methods/time.et2utc@v3::1");
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
    const out = await runner.runCase(buildInput("time.et2utc"));

    expect(out.ok).toBe(false);
    if (out.ok) return;

    expect(out.error).toMatchObject({
      code: GENERATED_DISPATCH_UNAVAILABLE_CODE,
      lane: "cspice",
      callId: "methods/time.et2utc@v3::1",
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
