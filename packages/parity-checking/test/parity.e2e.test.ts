import { describe, expect, it, vi } from "vitest";

import { runParityEngine } from "../src/engine/parityEngine.js";
import { BASELINE_METHOD_SPEC_COVERAGE } from "../src/guards/completenessBaseline.js";
import { getCspiceRunnerStatus } from "../src/runners/cspiceRunner.js";

// Increase timeout for parity tests.
vi.setConfig({ testTimeout: 10_000, hookTimeout: 30_000 });

describe.sequential("parity-checking engine (tspice vs raw CSPICE parity)", () => {
  it("runs full guard pipeline and parity execution", async () => {
    const status = getCspiceRunnerStatus();

    if (!status.ready) {
      await expect(runParityEngine()).rejects.toThrow(/^cspice-runner unavailable:/);
      return;
    }

    const summary = await runParityEngine();

    expect(summary.workflowCount).toBe(0);
    expect(summary.methodCount).toBe(BASELINE_METHOD_SPEC_COVERAGE);
    expect(summary.contractCount).toBe(162);
    expect(summary.coveredCount).toBe(BASELINE_METHOD_SPEC_COVERAGE);
    expect(summary.denylistCount).toBe(0);
    expect(summary.proof.marker).toBe("proof=disabled");
    expect(summary.proof.mode).toBe("disabled");

    expect(summary.skipped).toBe(false);
    expect(summary.methodCaseCount).toBeGreaterThan(0);
  });
});
