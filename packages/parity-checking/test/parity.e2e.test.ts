import { describe, expect, it } from "vitest";

import { runParityEngine } from "../src/engine/parityEngine.js";
import { getCspiceRunnerStatus } from "../src/runners/cspiceRunner.js";

describe.sequential("parity-checking engine (tspice vs raw CSPICE parity)", () => {
  it("runs full guard pipeline and parity execution", async () => {
    const status = getCspiceRunnerStatus();
    const summary = await runParityEngine();

    expect(summary.workflowCount).toBeGreaterThan(0);
    expect(summary.methodCount).toBe(73);
    expect(summary.crossCuttingSpecCount).toBeGreaterThan(0);
    expect(summary.contractCount).toBe(173);
    expect(summary.coveredCount).toBe(73);
    expect(summary.denylistCount).toBe(100);
    expect(summary.aliasCount).toBe(17);

    if (!status.ready) {
      expect(summary.skipped).toBe(true);
      expect(summary.skipReason).toMatch(/^cspice-runner unavailable:/);
      expect(summary.aliasGuardValidatedCount).toBe(0);
      expect(summary.methodCaseCount).toBe(0);
      expect(summary.crossCuttingCaseCount).toBe(0);
      return;
    }

    expect(summary.skipped).toBe(false);
    expect(summary.aliasGuardValidatedCount).toBe(17);
    expect(summary.methodCaseCount).toBeGreaterThan(0);
    expect(summary.crossCuttingCaseCount).toBeGreaterThan(0);
  });
}, 10_000);
