import { describe, expect, it, vi } from "vitest";

import { runParityEngine } from "../src/engine/parityEngine.js";
import { BASELINE_METHOD_SPEC_COVERAGE } from "../src/guards/completenessBaseline.js";
import { getCspiceRunnerStatus } from "../src/runners/cspiceRunner.js";

// Increase timeout for parity tests.
vi.setConfig({ testTimeout: 10_000, hookTimeout: 30_000 });

describe.sequential("parity-checking engine (tspice vs raw CSPICE parity)", () => {
  it("runs full guard pipeline and parity execution", async () => {
    const status = getCspiceRunnerStatus();
    const summary = await runParityEngine();

    expect(summary.workflowCount).toBe(0);
    expect(summary.methodCount).toBe(BASELINE_METHOD_SPEC_COVERAGE);
    expect(summary.crossCuttingSpecCount).toBeGreaterThan(0);
    expect(summary.contractCount).toBe(162);
    expect(summary.coveredCount).toBe(BASELINE_METHOD_SPEC_COVERAGE);
    expect(summary.denylistCount).toBe(0);

    if (!status.ready) {
      expect(summary.skipped).toBe(true);
      expect(summary.skipReason).toMatch(/^cspice-runner unavailable:/);
      expect(summary.methodCaseCount).toBe(0);
      expect(summary.crossCuttingCaseCount).toBe(0);
      return;
    }

    expect(summary.skipped).toBe(false);
    expect(summary.methodCaseCount).toBeGreaterThan(0);
    expect(summary.crossCuttingCaseCount).toBeGreaterThan(0);
  });
});
