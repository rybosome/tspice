import { describe, expect, it } from "vitest";

import { runParityEngine } from "../src/engine/parityEngine.js";

describe.sequential("parity-checking engine (tspice vs raw CSPICE parity)", () => {
  it("runs full guard pipeline and parity execution", async () => {
    const summary = await runParityEngine();

    if (summary.skipped) {
      // eslint-disable-next-line no-console
      console.warn(`[parity-checking] cspice-runner unavailable; skipping parity execution: ${summary.skipReason}`);
      expect(summary.methodCount).toBeGreaterThan(0);
      return;
    }

    expect(summary.workflowCount).toBeGreaterThan(0);
    expect(summary.methodCount).toBe(73);
    expect(summary.crossCuttingSpecCount).toBeGreaterThan(0);
    expect(summary.contractCount).toBe(173);
    expect(summary.coveredCount).toBe(73);
    expect(summary.denylistCount).toBe(100);
    expect(summary.aliasCount).toBe(17);
    expect(summary.aliasGuardValidatedCount).toBe(17);
    expect(summary.methodCaseCount).toBeGreaterThan(0);
    expect(summary.crossCuttingCaseCount).toBeGreaterThan(0);
  });
});
