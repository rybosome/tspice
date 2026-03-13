import { describe, expect, it, vi } from "vitest";

import { runParityEngine } from "../src/engine/parityEngine.js";
import { BASELINE_METHOD_SPEC_COVERAGE } from "../src/guards/completenessBaseline.js";

// Increase timeout for full parity run.
vi.setConfig({ testTimeout: 20_000, hookTimeout: 30_000 });

describe.sequential("parity-checking engine (canonical generated dispatch boundary)", () => {
  it("runs full guard pipeline on required cspice/node/wasm lanes", async () => {
    const summary = await runParityEngine();

    expect(summary.skipped).toBe(false);
    expect(summary.workflowCount).toBe(0);
    expect(summary.methodCount).toBe(BASELINE_METHOD_SPEC_COVERAGE);
    expect(summary.contractCount).toBe(162);
    expect(summary.coveredCount).toBe(BASELINE_METHOD_SPEC_COVERAGE);
    expect(summary.denylistCount).toBe(0);
    expect(summary.methodCaseCount).toBeGreaterThan(0);

    expect(summary.proof.marker).toBe("proof=generated-dispatch-boundary");
    expect(summary.proof.mode).toBe("generated-dispatch-boundary");
    expect(summary.proof.referenceVerification).toBe("generated-dispatch-seam");
    expect(summary.proof.laneVerification).toBe("strict-required-lanes-no-fallback");
    expect(summary.proof.fallbackDetected).toBe(false);
    expect(summary.proof.failingCases).toEqual([]);
    expect(summary.proof.perCaseReferenceRecords.length).toBeGreaterThan(0);
    expect(summary.proof.perLaneBackendRecords).toEqual([
      {
        lane: "node",
        requestedBackend: "node",
        actualBackend: "node",
        verified: true,
      },
      {
        lane: "wasm",
        requestedBackend: "wasm",
        actualBackend: "wasm",
        verified: true,
      },
    ]);
  });
});
