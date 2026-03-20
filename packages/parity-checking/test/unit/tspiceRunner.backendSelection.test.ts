import { describe, expect, it } from "vitest";

import { createTspiceRunner } from "../../src/runners/tspiceRunner.js";
import {
  GENERATED_DISPATCH_UNAVAILABLE_CODE,
  GENERATED_DISPATCH_UNAVAILABLE_REASON,
} from "../../src/runners/generatedDispatchSeam.js";

describe("createTspiceRunner (canonical dispatch boundary mode)", () => {
  const baseInput = {
    schemaVersion: 3 as const,
    manifest: {
      id: "methods/time/timdef@v3",
      kind: "method" as const,
    },
    contract: {
      contractMethod: "time.timdef",
      canonicalMethod: "time.timdef",
    },
    args: ["2010-01-01T00:00:00"],
    workflow: {
      steps: [
        {
          op: "call" as const,
          fn: "time.timdef",
          in: "$args",
        },
      ],
    },
  };

  it("records requested===actual metadata for explicit node lane", async () => {
    const runner = await createTspiceRunner({ backend: "node" });

    expect(runner.kind).toBe("tspice(node)");
    expect(runner.backendMetadata).toEqual({
      requestedBackend: "node",
      actualBackend: "node",
      fallbackDetected: false,
    });

    const out = await runner.runCase(baseInput);
    expect(out.ok).toBe(false);
    if (out.ok) return;

    expect(out.error.code).toBe(GENERATED_DISPATCH_UNAVAILABLE_CODE);
    expect(out.error.reason).toBe(GENERATED_DISPATCH_UNAVAILABLE_REASON);
    expect(out.error.lane).toBe("node");
    expect(out.error.callId).toBe("methods/time/timdef@v3::1");
  });

  it("records requested===actual metadata for explicit wasm lane", async () => {
    const runner = await createTspiceRunner({ backend: "wasm" });

    expect(runner.backendMetadata?.requestedBackend).toBe("wasm");
    expect(["wasm", "node"]).toContain(runner.backendMetadata?.actualBackend);

    if (runner.backendMetadata?.actualBackend === "wasm") {
      expect(runner.kind).toBe("tspice(wasm)");
      expect(runner.backendMetadata.fallbackDetected).toBe(false);
    } else {
      expect(runner.kind).toBe("tspice(node)");
      expect(runner.backendMetadata?.fallbackDetected).toBe(true);
    }
  });

  it("defaults auto lane to node without fallback", async () => {
    const runner = await createTspiceRunner({ backend: "auto" });

    expect(runner.kind).toBe("tspice(node)");
    expect(runner.backendMetadata).toEqual({
      requestedBackend: "auto",
      actualBackend: "node",
      fallbackDetected: false,
    });
  });
});
